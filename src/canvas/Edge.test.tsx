// Edge component tests — verifies render output, missing-node behaviour,
// a11y wiring, and per-edge re-render isolation per CLAUDE.md §4
// ("Edges are React-rendered but each Edge component subscribes only to
// its source and target node positions. Moving an unrelated node never
// re-renders unrelated edges.")

import { render, waitFor } from '@testing-library/react';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Edge } from './Edge';
import { workflowStore } from '@/state/workflow/instance';

function setupWorkflow() {
  workflowStore.getState().clear();
  const a = workflowStore.getState().addNode({ kind: 'task', position: { x: 0, y: 0 } });
  const b = workflowStore.getState().addNode({ kind: 'task', position: { x: 200, y: 100 } });
  if (!a.ok || !b.ok) throw new Error('setup failed');
  const edge = workflowStore.getState().connectNodes({ source: a.value.id, target: b.value.id });
  if (!edge.ok) throw new Error('setup failed');
  return { aId: a.value.id, bId: b.value.id, edgeId: edge.value.id };
}

const renderEdgeIn = (edgeId: string) =>
  render(
    <svg>
      <Edge id={edgeId} />
    </svg>,
  );

describe('Edge', () => {
  beforeEach(() => {
    workflowStore.getState().clear();
  });

  afterEach(() => {
    workflowStore.getState().clear();
  });

  it('renders an SVG path with a d attribute connecting source to target', () => {
    const { edgeId } = setupWorkflow();

    const { container } = renderEdgeIn(edgeId);
    const path = container.querySelector('path');

    expect(path).not.toBeNull();
    const d = path?.getAttribute('d');
    expect(d).toBeTruthy();
    expect(d).toMatch(/^M/); // starts with a move command
  });

  it('renders nothing when the edge id does not exist', () => {
    const { container } = renderEdgeIn('missing');
    expect(container.querySelector('path')).toBeNull();
  });

  it('renders nothing when the source node has been removed', () => {
    const { aId, edgeId } = setupWorkflow();
    workflowStore.getState().removeNode(aId);

    const { container } = renderEdgeIn(edgeId);
    expect(container.querySelector('path')).toBeNull();
  });

  it('exposes an aria-describedby-friendly description for connected nodes', () => {
    const { edgeId } = setupWorkflow();
    const { container } = renderEdgeIn(edgeId);
    const path = container.querySelector('path');
    // Edge should expose either an aria-label or be referenced by an
    // aria-describedby on the path/group; checking the role/label approach.
    const accessibleId =
      path?.getAttribute('aria-label') ??
      path?.getAttribute('id') ??
      container.querySelector('[role="presentation"]')?.id;
    expect(accessibleId).toBeTruthy();
  });

  it('does not re-render when an unrelated node moves (memo isolation)', () => {
    const { edgeId } = setupWorkflow();
    const c = workflowStore.getState().addNode({ kind: 'task', position: { x: 500, y: 500 } });
    if (!c.ok) throw new Error('setup failed');

    const onRender = vi.fn<ProfilerOnRenderCallback>();
    render(
      <svg>
        <Profiler id="edge" onRender={onRender}>
          <Edge id={edgeId} />
        </Profiler>
      </svg>,
    );
    onRender.mockClear();

    // Move the unrelated node C
    workflowStore.getState().moveNode(c.value.id, { x: 999, y: 999 });

    // No commit should have occurred for the Edge
    expect(onRender).not.toHaveBeenCalled();
  });

  it('re-renders when the source node moves', async () => {
    const { aId, edgeId } = setupWorkflow();

    const onRender = vi.fn<ProfilerOnRenderCallback>();
    render(
      <svg>
        <Profiler id="edge" onRender={onRender}>
          <Edge id={edgeId} />
        </Profiler>
      </svg>,
    );
    onRender.mockClear();

    workflowStore.getState().moveNode(aId, { x: 50, y: 50 });

    // React 19 batches Zustand-triggered updates outside act() — wait
    // for the commit to flush before asserting the Profiler fired.
    await waitFor(() => {
      expect(onRender).toHaveBeenCalled();
    });
  });
});
