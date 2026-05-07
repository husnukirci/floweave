import { describe, expect, it } from 'vitest';

import { createWorkflowStore } from './factory';

describe('createWorkflowStore', () => {
  it('produces independent stores per call (ADR-019 multi-instance)', () => {
    const a = createWorkflowStore({ name: 'a', persistEnabled: false });
    const b = createWorkflowStore({ name: 'b', persistEnabled: false });

    a.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });

    expect(Object.keys(a.getState().nodes)).toHaveLength(1);
    expect(Object.keys(b.getState().nodes)).toHaveLength(0);
  });

  it('exposes the full slice surface (nodes + edges + io)', () => {
    const store = createWorkflowStore({ persistEnabled: false });
    const state = store.getState();

    // Sanity: every action that PLAN.md §6 Phase 1 requires.
    expect(typeof state.addNode).toBe('function');
    expect(typeof state.updateNode).toBe('function');
    expect(typeof state.moveNode).toBe('function');
    expect(typeof state.removeNode).toBe('function');
    expect(typeof state.connectNodes).toBe('function');
    expect(typeof state.removeEdge).toBe('function');
    expect(typeof state.removeEdgesForNode).toBe('function');
    expect(typeof state.exportJSON).toBe('function');
    expect(typeof state.importJSON).toBe('function');
    expect(typeof state.applyMutations).toBe('function');
    expect(typeof state.clear).toBe('function');
  });

  it('builds a store with persist enabled (default) without throwing', () => {
    // happy-dom mocks localStorage so persistence works in tests; just
    // exercise the persist=true branch of the factory.
    const store = createWorkflowStore({ name: 'persist-test' });

    const added = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
    expect(added.ok).toBe(true);
    expect(Object.keys(store.getState().nodes)).toHaveLength(1);
  });

  it('round-trips a workflow through the full middleware stack', () => {
    const store = createWorkflowStore({ persistEnabled: false });

    const a = store.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
    const b = store.getState().addNode({ kind: 'task', position: { x: 100, y: 0 } });
    if (!a.ok || !b.ok) throw new Error('setup failed');
    const edge = store.getState().connectNodes({ source: a.value.id, target: b.value.id });
    if (!edge.ok) throw new Error('setup failed');

    const exported = store.getState().exportJSON();

    const fresh = createWorkflowStore({ persistEnabled: false });
    const importResult = fresh.getState().importJSON(exported);

    expect(importResult.ok).toBe(true);
    expect(fresh.getState().exportJSON()).toBe(exported);
  });
});
