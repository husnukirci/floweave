// Nodes slice — owns state.nodes (Record<id, WorkflowNode>) and the
// node-level actions: addNode, updateNode, moveNode, removeNode.
//
// removeNode is cascade-aware in shape — it returns `removedEdgeIds` —
// but the cascade itself only takes effect once edgesSlice ships in
// commit 4, when the StateCreator is widened to know about state.edges.

import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import type {
  AddNodeInput,
  NodeData,
  NodePosition,
  Result,
  StoreError,
  UpdateNodePatch,
  WorkflowNode,
} from '../types';

export interface NodesSlice {
  nodes: Record<string, WorkflowNode>;
  addNode: (input: AddNodeInput) => Result<WorkflowNode>;
  updateNode: (id: string, patch: UpdateNodePatch) => Result<WorkflowNode>;
  moveNode: (id: string, position: NodePosition) => Result<WorkflowNode>;
  removeNode: (
    id: string,
  ) => Result<{ removedNode: WorkflowNode; removedEdgeIds: readonly string[] }>;
}

function nodeNotFound(id: string): StoreError {
  return {
    code: 'NODE_NOT_FOUND',
    message: `Node ${id} not found`,
    details: { id },
  };
}

function defaultLabel(input: AddNodeInput): string {
  switch (input.kind) {
    case 'start':
      return 'Start';
    case 'end':
      return 'End';
    case 'task':
      return 'Task';
    case 'custom':
      return input.customType;
  }
}

function buildNodeFromInput(input: AddNodeInput): WorkflowNode {
  const id = nanoid();
  const data: NodeData = {
    label: input.data?.label ?? defaultLabel(input),
    variables: input.data?.variables ?? {},
  };
  if (input.kind === 'custom') {
    return { id, kind: 'custom', customType: input.customType, position: input.position, data };
  }
  return { id, kind: input.kind, position: input.position, data };
}

export const createNodesSlice: StateCreator<
  NodesSlice,
  [['zustand/immer', never]],
  [],
  NodesSlice
> = (set, get) => ({
  nodes: {},

  addNode: (input) => {
    const node = buildNodeFromInput(input);
    set((state) => {
      state.nodes[node.id] = node;
    });
    return { ok: true, value: node };
  },

  updateNode: (id, patch) => {
    if (!get().nodes[id]) {
      return { ok: false, error: nodeNotFound(id) };
    }
    set((state) => {
      const target = state.nodes[id];
      // Existence verified above; this guard satisfies noUncheckedIndexedAccess.
      if (!target) return;
      if (patch.data) {
        target.data = {
          label: patch.data.label ?? target.data.label,
          variables: patch.data.variables ?? target.data.variables,
        };
      }
      if (patch.position) {
        target.position = patch.position;
      }
    });
    const updated = get().nodes[id];
    if (!updated) {
      return { ok: false, error: nodeNotFound(id) };
    }
    return { ok: true, value: updated };
  },

  moveNode: (id, position) => {
    if (!get().nodes[id]) {
      return { ok: false, error: nodeNotFound(id) };
    }
    set((state) => {
      const target = state.nodes[id];
      if (!target) return;
      target.position = position;
    });
    const updated = get().nodes[id];
    if (!updated) {
      return { ok: false, error: nodeNotFound(id) };
    }
    return { ok: true, value: updated };
  },

  removeNode: (id) => {
    const node = get().nodes[id];
    if (!node) {
      return { ok: false, error: nodeNotFound(id) };
    }
    set((state) => {
      delete state.nodes[id];
    });
    // Edge cascade lands in commit 4 (when edgesSlice exists and the
    // StateCreator is widened to include state.edges).
    return { ok: true, value: { removedNode: node, removedEdgeIds: [] } };
  },
});
