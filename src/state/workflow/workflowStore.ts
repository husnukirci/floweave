// Workflow store — slice composition. The single source of truth for
// how nodes + edges + io combine into one store. The factory in
// factory.ts wraps this with the full middleware stack per ADR-012.

import type { StateCreator } from 'zustand';

import { createEdgesSlice } from './slices/edgesSlice';
import { createIoSlice } from './slices/ioSlice';
import { createNodesSlice } from './slices/nodesSlice';
import type { WorkflowStoreState } from './storeState';

export const createWorkflowSlices: StateCreator<
  WorkflowStoreState,
  [['zustand/immer', never]],
  [],
  WorkflowStoreState
> = (...args) => ({
  ...createNodesSlice(...args),
  ...createEdgesSlice(...args),
  ...createIoSlice(...args),
});
