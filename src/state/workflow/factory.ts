// Workflow store factory — produces a fresh, fully-middleware-wrapped
// store per call. Each Web Component instance owns its own store
// (ADR-019 multi-instance support).
//
// Middleware stack (ADR-012, outside-in):
//   subscribeWithSelector → devtools → persist → temporal (zundo) → immer
//
// - immer:                mutator-style updates inside slices
// - temporal:             undo/redo history (kept to 50 entries; only
//                         domain state, no functions)
// - persist:              localStorage hydration of nodes + edges only
// - devtools:             Redux DevTools integration (named per instance)
// - subscribeWithSelector: selective subscriptions for cross-store reads
//
// In tests, set { persistEnabled: false } so the store does not touch
// localStorage and instances stay isolated across test runs.

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';

import type { WorkflowStoreState } from './storeState';
import { createWorkflowSlices } from './workflowStore';

export type WorkflowStore = UseBoundStore<StoreApi<WorkflowStoreState>>;

export interface CreateWorkflowStoreOptions {
  /** devtools + persist key. Defaults to 'floweave-workflow'. */
  name?: string;
  /** Toggle persist middleware. Defaults to true; set false in tests. */
  persistEnabled?: boolean;
}

const partializeDomain = (
  state: WorkflowStoreState,
): Pick<WorkflowStoreState, 'nodes' | 'edges'> => ({
  nodes: state.nodes,
  edges: state.edges,
});

export function createWorkflowStore(options: CreateWorkflowStoreOptions = {}): WorkflowStore {
  const name = options.name ?? 'floweave-workflow';
  const persistEnabled = options.persistEnabled ?? true;

  const withTemporal = temporal(immer(createWorkflowSlices), {
    limit: 50,
    partialize: partializeDomain,
  });

  if (!persistEnabled) {
    return create<WorkflowStoreState>()(subscribeWithSelector(devtools(withTemporal, { name })));
  }

  const withPersist = persist(withTemporal, {
    name,
    partialize: partializeDomain,
  });

  return create<WorkflowStoreState>()(subscribeWithSelector(devtools(withPersist, { name })));
}
