import { describe, expect, it } from 'vitest';

import { buildEdge, buildNode, buildWorkflow } from '@/test/factories';

import { canConnect } from './validators';

describe('canConnect', () => {
  it('allows a task → task connection', () => {
    const a = buildNode({ id: 'a', kind: 'task' });
    const b = buildNode({ id: 'b', kind: 'task' });
    const state = buildWorkflow({ nodes: { a, b } });

    expect(canConnect('a', 'b', state)).toEqual({ ok: true });
  });

  it('rejects self-loops', () => {
    const a = buildNode({ id: 'a', kind: 'task' });
    const state = buildWorkflow({ nodes: { a } });

    expect(canConnect('a', 'a', state)).toEqual({ ok: false, reason: 'self-loop' });
  });

  it('rejects targeting a start node', () => {
    const start = buildNode({ id: 'start', kind: 'start' });
    const task = buildNode({ id: 'task', kind: 'task' });
    const state = buildWorkflow({ nodes: { start, task } });

    expect(canConnect('task', 'start', state)).toEqual({
      ok: false,
      reason: 'start-cannot-be-target',
    });
  });

  it('rejects sourcing from an end node', () => {
    const end = buildNode({ id: 'end', kind: 'end' });
    const task = buildNode({ id: 'task', kind: 'task' });
    const state = buildWorkflow({ nodes: { end, task } });

    expect(canConnect('end', 'task', state)).toEqual({
      ok: false,
      reason: 'end-cannot-be-source',
    });
  });

  it('rejects duplicate edges', () => {
    const a = buildNode({ id: 'a', kind: 'task' });
    const b = buildNode({ id: 'b', kind: 'task' });
    const existing = buildEdge({ id: 'e1', source: 'a', target: 'b' });
    const state = buildWorkflow({ nodes: { a, b }, edges: { e1: existing } });

    expect(canConnect('a', 'b', state)).toEqual({ ok: false, reason: 'duplicate-edge' });
  });

  it('reports source-not-found when the source node is missing', () => {
    const b = buildNode({ id: 'b', kind: 'task' });
    const state = buildWorkflow({ nodes: { b } });

    expect(canConnect('missing', 'b', state)).toEqual({
      ok: false,
      reason: 'source-not-found',
    });
  });

  it('reports target-not-found when the target node is missing', () => {
    const a = buildNode({ id: 'a', kind: 'task' });
    const state = buildWorkflow({ nodes: { a } });

    expect(canConnect('a', 'missing', state)).toEqual({
      ok: false,
      reason: 'target-not-found',
    });
  });

  it('allows a start → task → end chain', () => {
    const start = buildNode({ id: 'start', kind: 'start' });
    const task = buildNode({ id: 'task', kind: 'task' });
    const end = buildNode({ id: 'end', kind: 'end' });
    const state = buildWorkflow({ nodes: { start, task, end } });

    expect(canConnect('start', 'task', state)).toEqual({ ok: true });
    expect(canConnect('task', 'end', state)).toEqual({ ok: true });
  });

  it('allows the reverse direction of an existing edge', () => {
    // Edges are directed; a→b existing should not block b→a.
    const a = buildNode({ id: 'a', kind: 'task' });
    const b = buildNode({ id: 'b', kind: 'task' });
    const existing = buildEdge({ id: 'e1', source: 'a', target: 'b' });
    const state = buildWorkflow({ nodes: { a, b }, edges: { e1: existing } });

    expect(canConnect('b', 'a', state)).toEqual({ ok: true });
  });
});
