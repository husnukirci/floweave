import { beforeEach, describe, expect, it } from 'vitest';

import { buildEdge, createTestWorkflowStore, type TestWorkflowStore } from '@/test/factories';

describe('edgesSlice', () => {
  let store: TestWorkflowStore;

  beforeEach(() => {
    store = createTestWorkflowStore();
  });

  describe('connectNodes', () => {
    it('creates an edge between two nodes and returns Result.ok', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup failed');

      const result = store.getState().connectNodes({
        source: a.value.id,
        target: b.value.id,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.source).toBe(a.value.id);
      expect(result.value.target).toBe(b.value.id);
      expect(result.value.id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(store.getState().edges[result.value.id]).toEqual(result.value);
    });

    it('rejects self-loops with the validator reason in error.details', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok) throw new Error('setup failed');

      const result = store.getState().connectNodes({ source: a.value.id, target: a.value.id });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CANNOT_CONNECT');
      expect(result.error.details?.reason).toBe('self-loop');
    });

    it('rejects targeting a start node', () => {
      const start = store.getState().addNode({ kind: 'start', position: { x: 0, y: 0 } });
      const task = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!start.ok || !task.ok) throw new Error('setup failed');

      const result = store
        .getState()
        .connectNodes({ source: task.value.id, target: start.value.id });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.details?.reason).toBe('start-cannot-be-target');
    });

    it('rejects sourcing from an end node', () => {
      const end = store.getState().addNode({ kind: 'end', position: { x: 0, y: 0 } });
      const task = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!end.ok || !task.ok) throw new Error('setup failed');

      const result = store.getState().connectNodes({ source: end.value.id, target: task.value.id });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.details?.reason).toBe('end-cannot-be-source');
    });

    it('rejects duplicate edges', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup failed');
      const first = store.getState().connectNodes({ source: a.value.id, target: b.value.id });
      if (!first.ok) throw new Error('setup failed');

      const result = store.getState().connectNodes({ source: a.value.id, target: b.value.id });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.details?.reason).toBe('duplicate-edge');
    });

    it('reports source-not-found when the source id is missing', () => {
      const b = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!b.ok) throw new Error('setup failed');

      const result = store.getState().connectNodes({ source: 'missing', target: b.value.id });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.details?.reason).toBe('source-not-found');
    });

    it('reports target-not-found when the target id is missing', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok) throw new Error('setup failed');

      const result = store.getState().connectNodes({ source: a.value.id, target: 'missing' });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.details?.reason).toBe('target-not-found');
    });
  });

  describe('removeEdge', () => {
    it('removes the edge from state and returns Result.ok with the removed edge', () => {
      const edge = buildEdge({ id: 'e1', source: 'a', target: 'b' });
      store.setState((state) => ({ edges: { ...state.edges, [edge.id]: edge } }));

      const result = store.getState().removeEdge(edge.id);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual(edge);
      expect(store.getState().edges[edge.id]).toBeUndefined();
    });

    it('returns Result.err EDGE_NOT_FOUND when the id does not exist', () => {
      const result = store.getState().removeEdge('missing');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('EDGE_NOT_FOUND');
    });
  });

  describe('removeEdgesForNode', () => {
    it('removes edges where the node is source or target and returns the IDs', () => {
      const e1 = buildEdge({ id: 'e1', source: 'a', target: 'b' });
      const e2 = buildEdge({ id: 'e2', source: 'c', target: 'a' });
      const e3 = buildEdge({ id: 'e3', source: 'd', target: 'e' });
      store.setState({ edges: { e1, e2, e3 } });

      const removed = store.getState().removeEdgesForNode('a');

      expect([...removed].sort()).toEqual(['e1', 'e2']);
      expect(store.getState().edges.e1).toBeUndefined();
      expect(store.getState().edges.e2).toBeUndefined();
      expect(store.getState().edges.e3).toEqual(e3);
    });

    it('returns an empty array when no edges reference the node', () => {
      const e1 = buildEdge({ id: 'e1', source: 'b', target: 'c' });
      store.setState({ edges: { e1 } });

      const removed = store.getState().removeEdgesForNode('lonely');

      expect(removed).toEqual([]);
      expect(store.getState().edges.e1).toEqual(e1);
    });

    it('returns an empty array when state.edges is empty', () => {
      const removed = store.getState().removeEdgesForNode('any');

      expect(removed).toEqual([]);
    });
  });
});
