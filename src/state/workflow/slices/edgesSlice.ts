// Edges slice — owns state.edges (Record<id, WorkflowEdge>) and the
// edge-level actions: connectNodes (validated via canConnect),
// removeEdge, and removeEdgesForNode (called by nodesSlice.removeNode
// to cascade-clean edges when a node is deleted).
//
// removeEdgesForNode does not return a Result — it cannot fail
// (idempotent over an empty match set). It returns the IDs of removed
// edges so callers (removeNode) can include them in their own return.

import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import type { WorkflowStoreState } from '../storeState';
import type { ConnectNodesInput, Result, StoreError, WorkflowEdge } from '../types';
import { canConnect, type ConnectionFailureReason } from '../validators';

export type { ConnectNodesInput };

export interface EdgesSlice {
  edges: Record<string, WorkflowEdge>;
  connectNodes: (input: ConnectNodesInput) => Result<WorkflowEdge>;
  removeEdge: (id: string) => Result<WorkflowEdge>;
  removeEdgesForNode: (nodeId: string) => readonly string[];
}

function edgeNotFound(id: string): StoreError {
  return {
    code: 'EDGE_NOT_FOUND',
    message: `Edge ${id} not found`,
    details: { id },
  };
}

function cannotConnect(
  reason: ConnectionFailureReason,
  source: string,
  target: string,
): StoreError {
  return {
    code: 'CANNOT_CONNECT',
    message: `Cannot connect ${source} → ${target}: ${reason}`,
    details: { reason, source, target },
  };
}

export const createEdgesSlice: StateCreator<
  WorkflowStoreState,
  [['zustand/immer', never]],
  [],
  EdgesSlice
> = (set, get) => ({
  edges: {},

  connectNodes: ({ source, target }) => {
    const validation = canConnect(source, target, get());
    if (!validation.ok) {
      return { ok: false, error: cannotConnect(validation.reason, source, target) };
    }
    const edge: WorkflowEdge = { id: nanoid(), source, target };
    set((state) => {
      state.edges[edge.id] = edge;
    });
    return { ok: true, value: edge };
  },

  removeEdge: (id) => {
    const edge = get().edges[id];
    if (!edge) {
      return { ok: false, error: edgeNotFound(id) };
    }
    set((state) => {
      delete state.edges[id];
    });
    return { ok: true, value: edge };
  },

  removeEdgesForNode: (nodeId) => {
    const removedIds: string[] = [];
    for (const edge of Object.values(get().edges)) {
      if (edge.source === nodeId || edge.target === nodeId) {
        removedIds.push(edge.id);
      }
    }
    if (removedIds.length === 0) return [];
    set((state) => {
      for (const id of removedIds) {
        delete state.edges[id];
      }
    });
    return removedIds;
  },
});
