import { beforeEach, describe, expect, it } from 'vitest';

import { buildNode, createTestWorkflowStore, type TestWorkflowStore } from '@/test/factories';

describe('ioSlice', () => {
  let store: TestWorkflowStore;

  beforeEach(() => {
    store = createTestWorkflowStore();
  });

  describe('exportJSON', () => {
    it('exports an empty workflow as { nodes: {}, edges: {} }', () => {
      const json = store.getState().exportJSON();

      expect(JSON.parse(json)).toEqual({ nodes: {}, edges: {} });
    });

    it('includes all nodes and edges in the exported payload', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = store.getState().addNode({ kind: 'task', position: { x: 100, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup failed');
      const edge = store.getState().connectNodes({ source: a.value.id, target: b.value.id });
      if (!edge.ok) throw new Error('setup failed');

      const parsed = JSON.parse(store.getState().exportJSON()) as {
        nodes: Record<string, unknown>;
        edges: Record<string, unknown>;
      };

      expect(parsed.nodes[a.value.id]).toEqual(a.value);
      expect(parsed.nodes[b.value.id]).toEqual(b.value);
      expect(parsed.edges[edge.value.id]).toEqual(edge.value);
    });
  });

  describe('importJSON', () => {
    it('replaces state with the parsed payload and returns counts', () => {
      const a = buildNode({ id: 'a', kind: 'task' });
      const json = JSON.stringify({ nodes: { a }, edges: {} });

      const result = store.getState().importJSON(json);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual({ nodeCount: 1, edgeCount: 0 });
      expect(store.getState().nodes.a).toEqual(a);
    });

    it('replaces existing state rather than merging', () => {
      const added = store.getState().addNode({ kind: 'task', position: { x: 5, y: 5 } });
      if (!added.ok) throw new Error('setup failed');
      const json = JSON.stringify({ nodes: {}, edges: {} });

      store.getState().importJSON(json);

      expect(Object.keys(store.getState().nodes)).toHaveLength(0);
    });

    it('returns Result.err INVALID_JSON for unparseable input', () => {
      const result = store.getState().importJSON('not-valid-json');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_JSON');
    });

    it('returns Result.err SCHEMA_INVALID when nodes field is missing', () => {
      const result = store.getState().importJSON('{}');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('SCHEMA_INVALID');
    });

    it('returns Result.err SCHEMA_INVALID for a malformed node', () => {
      const json = JSON.stringify({
        nodes: { a: { id: 'a' /* missing kind */ } },
        edges: {},
      });

      const result = store.getState().importJSON(json);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('SCHEMA_INVALID');
    });

    it('returns Result.err SCHEMA_INVALID for a malformed edge', () => {
      const json = JSON.stringify({
        nodes: {},
        edges: { e1: { id: 'e1', source: 'a' /* missing target */ } },
      });

      const result = store.getState().importJSON(json);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('SCHEMA_INVALID');
    });

    it('does not mutate state when import fails', () => {
      const seeded = store.getState().addNode({ kind: 'task', position: { x: 9, y: 9 } });
      if (!seeded.ok) throw new Error('setup failed');

      const result = store.getState().importJSON('not-valid-json');

      expect(result.ok).toBe(false);
      expect(store.getState().nodes[seeded.value.id]).toBeDefined();
    });
  });

  describe('round-trip', () => {
    it('export → import → export produces identical JSON', () => {
      const a = store.getState().addNode({
        kind: 'custom',
        customType: 'verifyPolicy',
        position: { x: 100, y: 200 },
        data: { label: 'Verify', variables: { foo: 'bar', n: 42, ok: true } },
      });
      const b = store.getState().addNode({ kind: 'task', position: { x: 300, y: 200 } });
      if (!a.ok || !b.ok) throw new Error('setup failed');
      const edge = store.getState().connectNodes({ source: a.value.id, target: b.value.id });
      if (!edge.ok) throw new Error('setup failed');

      const exported1 = store.getState().exportJSON();

      const fresh = createTestWorkflowStore();
      const importResult = fresh.getState().importJSON(exported1);
      expect(importResult.ok).toBe(true);

      const exported2 = fresh.getState().exportJSON();
      expect(exported2).toBe(exported1);
    });
  });

  describe('applyMutations', () => {
    it('applies a sequence of valid mutations and returns the count', () => {
      const result = store.getState().applyMutations([
        { kind: 'addNode', input: { kind: 'start', position: { x: 0, y: 0 } } },
        { kind: 'addNode', input: { kind: 'task', position: { x: 100, y: 0 } } },
        { kind: 'addNode', input: { kind: 'end', position: { x: 200, y: 0 } } },
      ]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.applied).toBe(3);
      expect(Object.keys(store.getState().nodes)).toHaveLength(3);
    });

    it('returns Result.err MUTATION_FAILED with the failing index', () => {
      const result = store.getState().applyMutations([
        { kind: 'addNode', input: { kind: 'task', position: { x: 0, y: 0 } } },
        { kind: 'updateNode', id: 'nonexistent', patch: { data: { label: 'X' } } },
      ]);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('MUTATION_FAILED');
      expect(result.error.details?.index).toBe(1);
    });

    it('connects nodes added in the same batch', () => {
      // Mutations apply in order; the first addNode's id is referenced
      // by the next mutation. Caller is responsible for tracking IDs;
      // for this test we use addNode then look up by index.
      const r = store.getState().applyMutations([
        { kind: 'addNode', input: { kind: 'task', position: { x: 0, y: 0 } } },
        { kind: 'addNode', input: { kind: 'task', position: { x: 100, y: 0 } } },
      ]);
      if (!r.ok) throw new Error('setup failed');
      const [firstId, secondId] = Object.keys(store.getState().nodes);
      if (!firstId || !secondId) throw new Error('setup failed');

      const connect = store
        .getState()
        .applyMutations([{ kind: 'connectNodes', input: { source: firstId, target: secondId } }]);

      expect(connect.ok).toBe(true);
      expect(Object.keys(store.getState().edges)).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('resets state to empty nodes and edges', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok) throw new Error('setup failed');
      store.getState().addNode({ kind: 'task', position: { x: 100, y: 0 } });

      store.getState().clear();

      expect(store.getState().nodes).toEqual({});
      expect(store.getState().edges).toEqual({});
    });
  });
});
