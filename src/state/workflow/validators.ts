// Workflow validators — pure functions over WorkflowState; never mutate.
// Validation rules (PLAN.md §4): no self-loops, no duplicate edges, start
// nodes cannot be a target, end nodes cannot be a source. Source/target
// existence is also checked so callers get a precise reason code.

import type { WorkflowState } from './types';

export type ConnectionFailureReason =
  | 'self-loop'
  | 'duplicate-edge'
  | 'start-cannot-be-target'
  | 'end-cannot-be-source'
  | 'source-not-found'
  | 'target-not-found';

export type ValidationResult = { ok: true } | { ok: false; reason: ConnectionFailureReason };

export function canConnect(
  sourceId: string,
  targetId: string,
  state: WorkflowState,
): ValidationResult {
  if (sourceId === targetId) {
    return { ok: false, reason: 'self-loop' };
  }

  const source = state.nodes[sourceId];
  if (!source) {
    return { ok: false, reason: 'source-not-found' };
  }

  const target = state.nodes[targetId];
  if (!target) {
    return { ok: false, reason: 'target-not-found' };
  }

  if (target.kind === 'start') {
    return { ok: false, reason: 'start-cannot-be-target' };
  }

  if (source.kind === 'end') {
    return { ok: false, reason: 'end-cannot-be-source' };
  }

  const isDuplicate = Object.values(state.edges).some(
    (edge) => edge.source === sourceId && edge.target === targetId,
  );
  if (isDuplicate) {
    return { ok: false, reason: 'duplicate-edge' };
  }

  return { ok: true };
}
