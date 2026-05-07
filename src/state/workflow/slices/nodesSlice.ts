// Nodes slice — owns state.nodes (Record<id, WorkflowNode>) and the
// node-level actions: addNode, updateNode, moveNode, removeNode. The
// removeNode action is cascade-aware — it also clears any edges where
// the node was source or target — but the cascade only takes effect once
// edgesSlice ships (PLAN.md §6 Phase 1 commit 4).
//
// Stub for TDD: actions throw so this commit's tests fail loudly. Real
// implementation lands in the next commit per the alternating
// test → impl sequence.

import type { StateCreator } from 'zustand';

import type { AddNodeInput, NodePosition, Result, UpdateNodePatch, WorkflowNode } from '../types';

export interface NodesSlice {
  nodes: Record<string, WorkflowNode>;
  addNode: (input: AddNodeInput) => Result<WorkflowNode>;
  updateNode: (id: string, patch: UpdateNodePatch) => Result<WorkflowNode>;
  moveNode: (id: string, position: NodePosition) => Result<WorkflowNode>;
  removeNode: (
    id: string,
  ) => Result<{ removedNode: WorkflowNode; removedEdgeIds: readonly string[] }>;
}

const NOT_IMPLEMENTED = (action: string): Error =>
  new Error(`nodesSlice.${action}: not implemented (stub for TDD test commit)`);

export const createNodesSlice: StateCreator<
  NodesSlice,
  [['zustand/immer', never]],
  [],
  NodesSlice
> = () => ({
  nodes: {},
  addNode: () => {
    throw NOT_IMPLEMENTED('addNode');
  },
  updateNode: () => {
    throw NOT_IMPLEMENTED('updateNode');
  },
  moveNode: () => {
    throw NOT_IMPLEMENTED('moveNode');
  },
  removeNode: () => {
    throw NOT_IMPLEMENTED('removeNode');
  },
});
