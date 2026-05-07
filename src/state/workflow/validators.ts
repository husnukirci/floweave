// Workflow validators — pure functions over WorkflowState; never mutate.
// Validation rules (PLAN.md §4): no self-loops, no duplicate edges, start
// nodes cannot be a target, end nodes cannot be a source. Source/target
// existence is also checked so callers get a precise reason code.
//
// Stub for TDD: this file ships with throws so the test commit's tests
// fail loudly. Real implementation lands in the next commit per
// PLAN.md §6 Phase 1 commit sequence.

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
  _sourceId: string,
  _targetId: string,
  _state: WorkflowState,
): ValidationResult {
  throw new Error('canConnect: not implemented (stub for TDD test commit)');
}
