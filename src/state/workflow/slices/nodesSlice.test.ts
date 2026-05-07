import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { beforeEach, describe, expect, it } from 'vitest';

import { createNodesSlice, type NodesSlice } from './nodesSlice';

type TestStore = UseBoundStore<StoreApi<NodesSlice>>;

const createTestStore = (): TestStore => create<NodesSlice>()(immer(createNodesSlice));

describe('nodesSlice', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('addNode', () => {
    it('adds a basic node and stores it under a generated ID', () => {
      const result = store.getState().addNode({
        kind: 'task',
        position: { x: 100, y: 200 },
        data: { label: 'Process' },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.kind).toBe('task');
      expect(result.value.position).toEqual({ x: 100, y: 200 });
      expect(result.value.data.label).toBe('Process');
      expect(result.value.id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(store.getState().nodes[result.value.id]).toEqual(result.value);
    });

    it('adds a custom node carrying its customType discriminant', () => {
      const result = store.getState().addNode({
        kind: 'custom',
        customType: 'verifyPolicy',
        position: { x: 0, y: 0 },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.kind).toBe('custom');
      if (result.value.kind !== 'custom') return;
      expect(result.value.customType).toBe('verifyPolicy');
    });

    it('initializes label and variables when not supplied', () => {
      const result = store.getState().addNode({
        kind: 'start',
        position: { x: 0, y: 0 },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.data.label).toBe('Start');
      expect(result.value.data.variables).toEqual({});
    });

    it('generates unique IDs for sequential adds', () => {
      const r1 = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const r2 = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });

      expect(r1.ok && r2.ok).toBe(true);
      if (!r1.ok || !r2.ok) return;
      expect(r1.value.id).not.toBe(r2.value.id);
      expect(Object.keys(store.getState().nodes)).toHaveLength(2);
    });
  });

  describe('updateNode', () => {
    it('updates the data payload', () => {
      const added = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!added.ok) throw new Error('setup failed');

      const result = store.getState().updateNode(added.value.id, {
        data: { label: 'Updated', variables: { isUrgent: true } },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.data.label).toBe('Updated');
      expect(result.value.data.variables).toEqual({ isUrgent: true });
    });

    it('returns Result.err NODE_NOT_FOUND when the id does not exist', () => {
      const result = store.getState().updateNode('missing', { data: { label: 'x' } });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NODE_NOT_FOUND');
    });

    it('preserves position when only data is patched', () => {
      const added = store.getState().addNode({ kind: 'task', position: { x: 50, y: 60 } });
      if (!added.ok) throw new Error('setup failed');

      store.getState().updateNode(added.value.id, { data: { label: 'X' } });

      expect(store.getState().nodes[added.value.id]?.position).toEqual({ x: 50, y: 60 });
    });

    it('updates position via the patch when supplied', () => {
      const added = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!added.ok) throw new Error('setup failed');

      const result = store.getState().updateNode(added.value.id, { position: { x: 11, y: 22 } });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.position).toEqual({ x: 11, y: 22 });
    });
  });

  describe('moveNode', () => {
    it('updates only the position, leaving data untouched', () => {
      const added = store.getState().addNode({
        kind: 'task',
        position: { x: 0, y: 0 },
        data: { label: 'A', variables: { foo: 1 } },
      });
      if (!added.ok) throw new Error('setup failed');

      const result = store.getState().moveNode(added.value.id, { x: 999, y: 888 });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.position).toEqual({ x: 999, y: 888 });
      expect(result.value.data).toEqual({ label: 'A', variables: { foo: 1 } });
    });

    it('returns Result.err NODE_NOT_FOUND when the id does not exist', () => {
      const result = store.getState().moveNode('missing', { x: 0, y: 0 });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NODE_NOT_FOUND');
    });
  });

  describe('removeNode', () => {
    it('removes the node from state and returns Result.ok', () => {
      const added = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!added.ok) throw new Error('setup failed');

      const result = store.getState().removeNode(added.value.id);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.removedNode.id).toBe(added.value.id);
      expect(result.value.removedEdgeIds).toEqual([]);
      expect(store.getState().nodes[added.value.id]).toBeUndefined();
    });

    it('returns Result.err NODE_NOT_FOUND when the id does not exist', () => {
      const result = store.getState().removeNode('missing');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NODE_NOT_FOUND');
    });

    // Cascade-delete tests with edges land in commit 3 (test edges + cascade).
  });
});
