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

import { applyToolCall } from './executor';
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

    const toolResults: ToolResultBlock[] = [];
    for (const toolUse of toolUseBlocks) {
      const result = applyToolCall(toolUse, store);
      toolResults.push(result);
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
