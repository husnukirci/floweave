// Agent loop — orchestrates a single chat turn against the LLM proxy.
//
// Per ADR-010 the loop has a hard cap of 5 iterations. Each iteration:
//   1. POST {messages, system, tools} to the proxy endpoint.
//   2. If the response has no tool_use blocks, extract the assistant
//      text and return.
//   3. Otherwise run each tool_use through applyToolCall, append the
//      assistant message + a user message of tool_results, loop.
//
// The loop honors AbortController, surfaces network/server errors
// without throwing, and serializes the current workflow state into the
// system prompt on every iteration so the LLM always sees the latest
// state after applying its own tool calls.

import type { StoreApi } from 'zustand';

import type { WorkflowStoreState } from '@/state/workflow/storeState';

import type { Mutation } from '@/state/workflow/types';

import { buildToolMutations } from './executor';
import { buildSystemPrompt } from './systemPrompt';
import { TOOL_SCHEMAS, type ToolResultBlock, type ToolUseBlock } from './tools';

export const MAX_ITERATIONS_DEFAULT = 5;

// Wire-format content blocks shared with the proxy. Mirrors the subset
// of Anthropic's Messages API we actually consume/produce.
export type ProxyContentBlock = { type: 'text'; text: string } | ToolUseBlock | ToolResultBlock;

export interface ProxyMessage {
  role: 'user' | 'assistant';
  content: string | ProxyContentBlock[];
}

export interface ProxyResponse {
  content: ProxyContentBlock[];
  stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

export interface AppliedToolCall {
  name: string;
  input: unknown;
  isError: boolean;
  resultContent: string;
}

export interface AgentLoopParams {
  userMessage: string;
  previousMessages?: readonly ProxyMessage[];
  store: StoreApi<WorkflowStoreState>;
  endpoint: string;
  signal?: AbortSignal;
  maxIterations?: number;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export type AgentLoopResult =
  | {
      ok: true;
      finalText: string;
      iterations: number;
      toolCalls: AppliedToolCall[];
      stopReason: 'end_turn' | 'max_iterations';
    }
  | {
      ok: false;
      error: string;
      iterations: number;
      toolCalls: AppliedToolCall[];
    };

function isTextBlock(block: ProxyContentBlock): block is { type: 'text'; text: string } {
  return block.type === 'text';
}

function isToolUseBlock(block: ProxyContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use';
}

function joinText(blocks: ProxyContentBlock[]): string {
  return blocks
    .filter(isTextBlock)
    .map((b) => b.text)
    .join('\n');
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if (error.message.toLowerCase().includes('abort')) return true;
  }
  return false;
}

// Builds mutations for every tool_use in a turn, applies them through
// a single applyMutations() call (CLAUDE.md §4: "LLM-driven mutations
// use applyMutations() as a single batched call. Never call individual
// actions in a loop from the agent loop."), and produces tool_results
// in the same order as the input tool_uses.
//
// Failure semantics: if a tool_use's input is malformed, its slot in
// the result list is is_error and its mutations are not contributed to
// the batch. If the batch itself fails mid-sequence, every tool_use
// whose mutations participated in (or after) the failed mutation is
// marked is_error with the underlying validator reason; tool_uses that
// failed validation upfront keep their original error.
function batchApplyToolUses(
  toolUses: readonly ToolUseBlock[],
  store: StoreApi<WorkflowStoreState>,
): ToolResultBlock[] {
  const results: ToolResultBlock[] = new Array<ToolResultBlock>(toolUses.length);
  const allMutations: Mutation[] = [];
  // For each tool_use index, the [start, end) slice of allMutations it
  // contributed. Used to map a batch failure back to the responsible
  // tool_use(s).
  const ranges = new Array<{ start: number; end: number } | null>(toolUses.length);

  for (let i = 0; i < toolUses.length; i += 1) {
    const toolUse = toolUses[i];
    /* c8 ignore next 4 -- defensive guard for noUncheckedIndexedAccess; bounded loop never produces undefined */
    if (!toolUse) {
      ranges[i] = null;
      continue;
    }
    const built = buildToolMutations(toolUse, store);
    if (!built.ok) {
      results[i] = {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: built.errorContent,
        is_error: true,
      };
      ranges[i] = null;
      continue;
    }
    const start = allMutations.length;
    for (const m of built.mutations) allMutations.push(m);
    ranges[i] = { start, end: allMutations.length };
    // Provisionally mark success — overwritten below if the batch fails.
    results[i] = {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: built.successContent,
    };
  }

  if (allMutations.length === 0) return results;

  const batch = store.getState().applyMutations(allMutations);
  if (batch.ok) return results;

  const failedIndex = (() => {
    const v = batch.error.details?.index;
    return typeof v === 'number' ? v : -1;
  })();
  const reason = ((): string | undefined => {
    const cause = batch.error.details?.cause;
    if (typeof cause !== 'object' || cause === null) return undefined;
    const causeDetails = (cause as { details?: unknown }).details;
    if (typeof causeDetails !== 'object' || causeDetails === null) return undefined;
    const r = (causeDetails as { reason?: unknown }).reason;
    return typeof r === 'string' ? r : undefined;
  })();

  for (let i = 0; i < toolUses.length; i += 1) {
    const range = ranges[i];
    const toolUse = toolUses[i];
    if (!range || !toolUse) continue;
    // The tool_use's mutations either include the failing index or run
    // after it (so they were never applied). Either way the LLM should
    // see this as an error.
    if (failedIndex < 0 || range.end > failedIndex) {
      results[i] = {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: reason ? `Tool failed: ${reason}` : `Tool failed: ${batch.error.message}`,
        is_error: true,
      };
    }
  }

  return results;
}

export async function runAgentLoop(params: AgentLoopParams): Promise<AgentLoopResult> {
  const {
    userMessage,
    previousMessages = [],
    store,
    endpoint,
    signal,
    maxIterations = MAX_ITERATIONS_DEFAULT,
    fetchImpl = fetch,
  } = params;

  const toolCalls: AppliedToolCall[] = [];
  const messages: ProxyMessage[] = [...previousMessages, { role: 'user', content: userMessage }];

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    if (signal?.aborted) {
      return { ok: false, error: 'Aborted before iteration', iterations: iteration - 1, toolCalls };
    }

    // Build system prompt with the latest store state every iteration —
    // the LLM should see the effects of its own previous tool calls.
    const system = buildSystemPrompt(store.getState());

    let response: ProxyResponse;
    try {
      const httpResp = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, system, tools: TOOL_SCHEMAS }),
        signal,
      });
      if (!httpResp.ok) {
        return {
          ok: false,
          error: `Proxy responded with status ${String(httpResp.status)}`,
          iterations: iteration,
          toolCalls,
        };
      }
      // Trust the proxy contract — the server validates and shapes the
      // payload before forwarding it. Mis-shaped responses surface as
      // runtime errors caught below.
      response = (await httpResp.json()) as ProxyResponse;
    } catch (caught: unknown) {
      if (isAbortError(caught)) {
        return { ok: false, error: 'Aborted', iterations: iteration, toolCalls };
      }
      const message = caught instanceof Error ? caught.message : String(caught);
      return {
        ok: false,
        error: `Network error: ${message}`,
        iterations: iteration,
        toolCalls,
      };
    }

    const toolUseBlocks = response.content.filter(isToolUseBlock);

    if (toolUseBlocks.length === 0) {
      return {
        ok: true,
        finalText: joinText(response.content),
        iterations: iteration,
        toolCalls,
        stopReason: 'end_turn',
      };
    }

    const toolResults = batchApplyToolUses(toolUseBlocks, store);
    for (let i = 0; i < toolUseBlocks.length; i += 1) {
      const toolUse = toolUseBlocks[i];
      const result = toolResults[i];
      // Indices line up by construction; the guards satisfy
      // noUncheckedIndexedAccess.
      if (!toolUse || !result) continue;
      toolCalls.push({
        name: toolUse.name,
        input: toolUse.input,
        isError: result.is_error === true,
        resultContent: result.content,
      });
    }

    // Append the assistant turn (its tool_use blocks) and the user
    // turn (the matching tool_results) so the next iteration's prompt
    // mirrors the real Messages API conversation shape.
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
  }

  // Hit the iteration cap with tool_use still pending. Synthesize a
  // final text from the last assistant text block, or a generic fallback.
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const finalText =
    lastAssistant && typeof lastAssistant.content !== 'string'
      ? joinText(lastAssistant.content) ||
        'Reached the maximum number of iterations without a final answer.'
      : 'Reached the maximum number of iterations without a final answer.';

  return {
    ok: true,
    finalText,
    iterations: maxIterations,
    toolCalls,
    stopReason: 'max_iterations',
  };
}
