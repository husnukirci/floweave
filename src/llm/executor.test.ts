// Tests for the LLM tool executor — verifies that each of the five
// atomic tools (ADR-009) translates correctly to a store mutation,
// surfaces success and validation failures as proper tool_result
// blocks, and that input validation catches malformed LLM output.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyToolCall } from './executor';
import type { ToolUseBlock } from './tools';
import { createTestWorkflowStore, type TestWorkflowStore } from '@/test/factories';

const toolUse = (name: string, input: unknown, id = 'toolu_test'): ToolUseBlock => ({
  type: 'tool_use',
  id,
  name,
  input,
});

describe('applyToolCall', () => {
  let store: TestWorkflowStore;

  beforeEach(() => {
    store = createTestWorkflowStore();
  });

  afterEach(() => {
    store.getState().clear();
  });

  describe('add_node', () => {
    it('adds a basic task node and returns a success tool_result', () => {
      const result = applyToolCall(
        toolUse('add_node', { kind: 'task', position: { x: 100, y: 200 } }),
        store,
      );

      expect(result.type).toBe('tool_result');
      expect(result.tool_use_id).toBe('toolu_test');
      expect(result.is_error).toBeFalsy();
      expect(Object.keys(store.getState().nodes)).toHaveLength(1);
    });

    it('adds a custom node carrying its customType', () => {
      const result = applyToolCall(
        toolUse('add_node', {
          kind: 'custom',
          customType: 'verifyPolicy',
          position: { x: 0, y: 0 },
          data: { label: 'Verify Coverage' },
        }),
        store,
      );

      expect(result.is_error).toBeFalsy();
      const node = Object.values(store.getState().nodes)[0];
      expect(node?.kind).toBe('custom');
      if (node?.kind !== 'custom') return;
      expect(node.customType).toBe('verifyPolicy');
      expect(node.data.label).toBe('Verify Coverage');
    });

    it('returns is_error tool_result when kind is invalid', () => {
      const result = applyToolCall(
        toolUse('add_node', { kind: 'invalid', position: { x: 0, y: 0 } }),
        store,
      );

      expect(result.is_error).toBe(true);
      expect(result.content.toLowerCase()).toContain('kind');
      expect(Object.keys(store.getState().nodes)).toHaveLength(0);
    });

    it('returns is_error when custom kind is missing customType', () => {
      const result = applyToolCall(
        toolUse('add_node', { kind: 'custom', position: { x: 0, y: 0 } }),
        store,
      );

      expect(result.is_error).toBe(true);
      expect(result.content.toLowerCase()).toContain('customtype');
    });
  });

  describe('connect_nodes', () => {
    it('connects two existing nodes', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = store.getState().addNode({ kind: 'task', position: { x: 100, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup');

      const result = applyToolCall(
        toolUse('connect_nodes', { source: a.value.id, target: b.value.id }),
        store,
      );

      expect(result.is_error).toBeFalsy();
      expect(Object.keys(store.getState().edges)).toHaveLength(1);
    });

    it('returns is_error tool_result for a duplicate edge', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = store.getState().addNode({ kind: 'task', position: { x: 100, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup');
      store.getState().connectNodes({ source: a.value.id, target: b.value.id });

      const result = applyToolCall(
        toolUse('connect_nodes', { source: a.value.id, target: b.value.id }),
        store,
      );

      expect(result.is_error).toBe(true);
      expect(result.content.toLowerCase()).toContain('duplicate');
    });
  });

  describe('update_node', () => {
    it('updates a node label and variables', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      if (!a.ok) throw new Error('setup');

      const result = applyToolCall(
        toolUse('update_node', {
          id: a.value.id,
          data: { label: 'Updated', variables: { isUrgent: true } },
        }),
        store,
      );

      expect(result.is_error).toBeFalsy();
      expect(store.getState().nodes[a.value.id]?.data.label).toBe('Updated');
      expect(store.getState().nodes[a.value.id]?.data.variables).toEqual({ isUrgent: true });
    });

    it('returns is_error for an unknown node id', () => {
      const result = applyToolCall(
        toolUse('update_node', { id: 'missing', data: { label: 'x' } }),
        store,
      );

      expect(result.is_error).toBe(true);
      expect(result.content.toLowerCase()).toContain('not found');
    });
  });

  describe('remove_node', () => {
    it('removes a node and reports the removed edge ids', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = store.getState().addNode({ kind: 'task', position: { x: 100, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup');
      store.getState().connectNodes({ source: a.value.id, target: b.value.id });

      const result = applyToolCall(toolUse('remove_node', { id: a.value.id }), store);

      expect(result.is_error).toBeFalsy();
      expect(store.getState().nodes[a.value.id]).toBeUndefined();
      expect(Object.keys(store.getState().edges)).toHaveLength(0);
    });

    it('returns is_error for an unknown node id', () => {
      const result = applyToolCall(toolUse('remove_node', { id: 'missing' }), store);

      expect(result.is_error).toBe(true);
    });
  });

  describe('insert_between', () => {
    it('removes the original edge, adds a node, and reconnects through it', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = store.getState().addNode({ kind: 'task', position: { x: 200, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup');
      store.getState().connectNodes({ source: a.value.id, target: b.value.id });

      const result = applyToolCall(
        toolUse('insert_between', {
          source: a.value.id,
          target: b.value.id,
          kind: 'custom',
          customType: 'verifyPolicy',
          data: { label: 'Verify Coverage' },
        }),
        store,
      );

      expect(result.is_error).toBeFalsy();
      const nodes = Object.values(store.getState().nodes);
      expect(nodes).toHaveLength(3);
      const edges = Object.values(store.getState().edges);
      expect(edges).toHaveLength(2);
      // The new node should be in the middle: A → mid → B
      const inserted = nodes.find((n) => n.kind === 'custom' && n.data.label === 'Verify Coverage');
      expect(inserted).toBeDefined();
      expect(edges.some((e) => e.source === a.value.id && e.target === inserted?.id)).toBe(true);
      expect(edges.some((e) => e.source === inserted?.id && e.target === b.value.id)).toBe(true);
    });

    it('returns is_error when source and target are not directly connected', () => {
      const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
      const b = store.getState().addNode({ kind: 'task', position: { x: 200, y: 0 } });
      if (!a.ok || !b.ok) throw new Error('setup');
      // No edge created between them.

      const result = applyToolCall(
        toolUse('insert_between', {
          source: a.value.id,
          target: b.value.id,
          kind: 'task',
        }),
        store,
      );

      expect(result.is_error).toBe(true);
      expect(result.content.toLowerCase()).toContain('not connected');
    });
  });

  describe('unknown tool name', () => {
    it('returns is_error for an unrecognized tool name', () => {
      const result = applyToolCall(toolUse('do_something_weird', {}), store);

      expect(result.is_error).toBe(true);
      expect(result.content.toLowerCase()).toContain('unknown tool');
    });
  });
});
