// IO slice — workflow-level actions that don't fit nodes or edges:
// exportJSON, importJSON (with schema validation), applyMutations
// (single-batch driver for LLM-driven changes), and clear.
//
// importJSON validates the parsed input against the WorkflowState
// schema before any state mutation. State is replaced atomically only
// when validation passes; on failure the existing state is untouched.
//
// applyMutations applies operations in order; if one fails, returns
// Result.err with the failed index in details. Previously-applied
// mutations are not rolled back (partial application is acceptable —
// the LLM agent loop sees the failure and decides next steps). True
// atomic rollback is a Tier 2 add-on.
//
// Stub for TDD: actions throw so the test commit's tests fail loudly.
// Real implementation lands in commit 6.

import type { StateCreator } from 'zustand';

import type { WorkflowStoreState } from '../storeState';
import type { Mutation, Result } from '../types';

export interface IoSlice {
  exportJSON: () => string;
  importJSON: (json: string) => Result<{ nodeCount: number; edgeCount: number }>;
  applyMutations: (mutations: readonly Mutation[]) => Result<{ applied: number }>;
  clear: () => void;
}

const NOT_IMPLEMENTED = (action: string): Error =>
  new Error(`ioSlice.${action}: not implemented (stub for TDD test commit)`);

export const createIoSlice: StateCreator<
  WorkflowStoreState,
  [['zustand/immer', never]],
  [],
  IoSlice
> = () => ({
  exportJSON: () => {
    throw NOT_IMPLEMENTED('exportJSON');
  },
  importJSON: () => {
    throw NOT_IMPLEMENTED('importJSON');
  },
  applyMutations: () => {
    throw NOT_IMPLEMENTED('applyMutations');
  },
  clear: () => {
    throw NOT_IMPLEMENTED('clear');
  },
});
