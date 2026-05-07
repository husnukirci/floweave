// Edges slice — owns state.edges (Record<id, WorkflowEdge>) and the
// edge-level actions: connectNodes (validated via canConnect),
// removeEdge, and removeEdgesForNode (called by nodesSlice.removeNode
// to cascade-clean edges when a node is deleted).
//
// removeEdgesForNode does not return a Result — it cannot fail (idempotent
// over an empty match set), and CLAUDE.md §3's Result requirement is for
// "non-trivial" actions; bulk no-op-on-no-match doesn't qualify. It
// returns the IDs of removed edges so callers (removeNode) can include
// them in their own return value.
//
// Stub for TDD: actions throw so this commit's tests fail loudly. Real
// implementation lands in commit 4.

import type { StateCreator } from 'zustand';

import type { WorkflowStoreState } from '../storeState';
import type { Result, WorkflowEdge } from '../types';

export interface ConnectNodesInput {
  source: string;
  target: string;
}

export interface EdgesSlice {
  edges: Record<string, WorkflowEdge>;
  connectNodes: (input: ConnectNodesInput) => Result<WorkflowEdge>;
  removeEdge: (id: string) => Result<WorkflowEdge>;
  removeEdgesForNode: (nodeId: string) => readonly string[];
}

const NOT_IMPLEMENTED = (action: string): Error =>
  new Error(`edgesSlice.${action}: not implemented (stub for TDD test commit)`);

export const createEdgesSlice: StateCreator<
  WorkflowStoreState,
  [['zustand/immer', never]],
  [],
  EdgesSlice
> = () => ({
  edges: {},
  connectNodes: () => {
    throw NOT_IMPLEMENTED('connectNodes');
  },
  removeEdge: () => {
    throw NOT_IMPLEMENTED('removeEdge');
  },
  removeEdgesForNode: () => {
    throw NOT_IMPLEMENTED('removeEdgesForNode');
  },
});
