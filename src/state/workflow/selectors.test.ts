import { describe, expect, it } from 'vitest';

import { selectEdgesByNode, selectEdgesForNode, selectNodeById, selectNodeIds } from './selectors';
import { buildEdge, buildNode, buildWorkflow } from '@/test/factories';

describe('workflow selectors', () => {
  describe('selectNodeById', () => {
    it('returns the node when present', () => {
      const node = buildNode({ id: 'n1' });
      const state = buildWorkflow({ nodes: { n1: node } });

      expect(selectNodeById('n1')(stateAsStoreState(state))).toEqual(node);
    });

    it('returns undefined when absent', () => {
      const state = buildWorkflow();

      expect(selectNodeById('missing')(stateAsStoreState(state))).toBeUndefined();
    });
  });

  describe('selectNodeIds', () => {
    it('returns the array of node IDs', () => {
      const state = buildWorkflow({
        nodes: { a: buildNode({ id: 'a' }), b: buildNode({ id: 'b' }) },
      });

      expect([...selectNodeIds(stateAsStoreState(state))].sort()).toEqual(['a', 'b']);
    });

    it('returns an empty array for an empty workflow', () => {
      expect(selectNodeIds(stateAsStoreState(buildWorkflow()))).toEqual([]);
    });
  });

  describe('selectEdgesForNode', () => {
    it('returns edges where the node is source', () => {
      const e1 = buildEdge({ id: 'e1', source: 'a', target: 'b' });
      const e2 = buildEdge({ id: 'e2', source: 'a', target: 'c' });
      const state = buildWorkflow({ edges: { e1, e2 } });

      const edges = selectEdgesForNode('a')(stateAsStoreState(state));
      expect(edges.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    });

    it('returns edges where the node is target', () => {
      const e1 = buildEdge({ id: 'e1', source: 'a', target: 'b' });
      const e2 = buildEdge({ id: 'e2', source: 'c', target: 'b' });
      const state = buildWorkflow({ edges: { e1, e2 } });

      const edges = selectEdgesForNode('b')(stateAsStoreState(state));
      expect(edges.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    });

    it('returns an empty array when no edges reference the node', () => {
      const e1 = buildEdge({ id: 'e1', source: 'b', target: 'c' });
      const state = buildWorkflow({ edges: { e1 } });

      expect(selectEdgesForNode('lonely')(stateAsStoreState(state))).toEqual([]);
    });
  });

  describe('selectEdgesByNode', () => {
    it('groups edges by both source and target IDs', () => {
      const e1 = buildEdge({ id: 'e1', source: 'a', target: 'b' });
      const e2 = buildEdge({ id: 'e2', source: 'b', target: 'c' });
      const state = buildWorkflow({ edges: { e1, e2 } });

      const grouped = selectEdgesByNode(stateAsStoreState(state));

      expect(grouped.a?.map((e) => e.id)).toEqual(['e1']);
      expect(grouped.b?.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
      expect(grouped.c?.map((e) => e.id)).toEqual(['e2']);
    });

    it('returns an empty object when there are no edges', () => {
      expect(selectEdgesByNode(stateAsStoreState(buildWorkflow()))).toEqual({});
    });
  });
});

// Selectors operate on WorkflowStoreState (NodesSlice & EdgesSlice & IoSlice).
// For unit tests, only `nodes` and `edges` are read; cast a domain
// WorkflowState fixture to the wider type so tests don't need to plumb
// the action methods they will not exercise.
import type { WorkflowStoreState } from './storeState';
import type { WorkflowState } from './types';

function stateAsStoreState(state: WorkflowState): WorkflowStoreState {
  return state as WorkflowStoreState;
}
