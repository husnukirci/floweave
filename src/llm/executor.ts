// LLM tool executor — translates an Anthropic tool_use block into a
// workflow store mutation, applies it via applyMutations (single-call
// batch per CLAUDE.md §4 invariant), and returns a tool_result block
// the agent loop sends back to the LLM in the next turn.
//
// All inputs are re-validated here even though the LLM's tool call
// went through Anthropic's schema validation — the LLM occasionally
// produces malformed input. Validation failures return structured
// tool_results so the LLM can recover within the agent loop iteration
// cap (ADR-010).
//
// Stub for TDD: throws until commit 3 lands the real impl.

import type { StoreApi } from 'zustand';

import type { WorkflowStoreState } from '@/state/workflow/storeState';

import type { ToolResultBlock, ToolUseBlock } from './tools';

export function applyToolCall(
  _toolCall: ToolUseBlock,
  _store: StoreApi<WorkflowStoreState>,
): ToolResultBlock {
  throw new Error('applyToolCall: not implemented (stub for TDD test commit)');
}
