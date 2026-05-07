// Workflow selectors — minimal, focused readers over WorkflowStoreState.
// Per CLAUDE.md §4: "Zustand selectors subscribe to the minimum slice.
// Never useStore(s => s). Use useShallow for derived data."
//
// Selectors that return primitives or stable references can be used
// with useStore directly. Selectors that derive new arrays/objects
// (selectNodeIds, selectEdgesForNode, selectEdgesByNode) should be
// wrapped in useShallow at the call site, e.g.
//   const ids = useStore(useShallow(selectNodeIds));

import type { WorkflowStoreState } from './storeState';
import type { WorkflowEdge, WorkflowNode } from './types';

export const selectNodeById =
  (id: string) =>
  (state: WorkflowStoreState): WorkflowNode | undefined =>
    state.nodes[id];

export const selectNodeIds = (state: WorkflowStoreState): readonly string[] =>
  Object.keys(state.nodes);

export const selectEdgesForNode =
  (nodeId: string) =>
  (state: WorkflowStoreState): readonly WorkflowEdge[] =>
    Object.values(state.edges).filter((edge) => edge.source === nodeId || edge.target === nodeId);

export const selectEdgesByNode = (
  state: WorkflowStoreState,
): Readonly<Record<string, readonly WorkflowEdge[]>> => {
  const byNode: Record<string, WorkflowEdge[]> = {};
  for (const edge of Object.values(state.edges)) {
    (byNode[edge.source] ??= []).push(edge);
    (byNode[edge.target] ??= []).push(edge);
  }
  return byNode;
};
