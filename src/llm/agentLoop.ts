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

import type { ToolResultBlock, ToolUseBlock } from './tools';

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

export function runAgentLoop(_params: AgentLoopParams): Promise<AgentLoopResult> {
  return Promise.resolve({
    ok: false,
    error: 'runAgentLoop: not implemented (stub for TDD test commit)',
    iterations: 0,
    toolCalls: [],
  });
}
