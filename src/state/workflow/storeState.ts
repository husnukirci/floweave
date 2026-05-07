// Composed shape of the full workflow store state. Each slice's
// StateCreator declares this as its first generic so that cross-slice
// access (e.g. removeNode calling removeEdgesForNode) is type-safe.
//
// IoSlice joins this union in commit 6.

import type { EdgesSlice } from './slices/edgesSlice';
import type { NodesSlice } from './slices/nodesSlice';

export type WorkflowStoreState = NodesSlice & EdgesSlice;
