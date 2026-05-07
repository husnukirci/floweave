// Canvas — root container for the workflow editor's interactive surface.
//
// Architecture invariants (CLAUDE.md §4):
//   - Pan via `transform: translate3d(...)` on the inner content layer
//     with `will-change: transform`; never `top`/`left` for pan.
//   - Pointer events with `setPointerCapture` for drag interactions
//     (via usePointerDrag hook) — no document-level listeners.
//   - Hybrid HTML+SVG canvas: HTML divs for nodes (rendered inside this
//     container), SVG overlay for edges (Phase 3).

import { type JSX, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { workflowStore } from '@/state/workflow/instance';
import { selectNodeIds } from '@/state/workflow/selectors';
import { useUiStore } from '@/state/ui/uiStore';
import { usePointerDrag } from '@/utils/pointer';
import type { ViewportOffset } from '@/state/ui/uiStore';

import { ConnectionLayer } from './ConnectionLayer';
import { ErrorBanner } from './ErrorBanner';
import { Node } from './Node';

const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

interface PanStartData {
  initialViewport: ViewportOffset;
}

export function Canvas(): JSX.Element {
  const viewport = useUiStore((s) => s.viewport);
  const setViewport = useUiStore((s) => s.setViewport);
  const selectNode = useUiStore((s) => s.selectNode);
  const selectEdge = useUiStore((s) => s.selectEdge);
  const nodeIds = workflowStore(useShallow(selectNodeIds));

  // Window-level Delete listener for the currently selected edge. Edges
  // are not natively focusable in a way that survives panning; routing
  // the keystroke through the store keeps the contract simple.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const active = document.activeElement;
      if (active && FORM_TAGS.has(active.tagName.toUpperCase())) return;
      const { selectedEdgeId } = useUiStore.getState();
      if (selectedEdgeId === null) return;
      event.preventDefault();
      workflowStore.getState().removeEdge(selectedEdgeId);
      useUiStore.getState().selectEdge(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Pan handlers — usePointerDrag wires setPointerCapture and rAF
  // throttling. onDragStart returns null when the pointer down landed
  // on a child (a Node) so node drags don't also trigger a pan.
  const panHandlers = useMemo<Parameters<typeof usePointerDrag<PanStartData>>[0]>(
    () => ({
      onDragStart: (event) => {
        if (event.target !== event.currentTarget) return null;
        // Pointerdown on the empty canvas: clear any selection.
        selectNode(null);
        selectEdge(null);
        return { initialViewport: useUiStore.getState().viewport };
      },
      onDrag: (_event, delta, startData) => {
        setViewport({
          x: startData.initialViewport.x + delta.totalDx,
          y: startData.initialViewport.y + delta.totalDy,
        });
      },
    }),
    [selectEdge, selectNode, setViewport],
  );
  const pointerHandlers = usePointerDrag<PanStartData>(panHandlers);

  return (
    <div
      role="application"
      aria-label="Workflow canvas"
      className="relative h-full w-full cursor-grab overflow-hidden bg-neutral-50"
      onPointerDown={pointerHandlers.onPointerDown}
      onPointerMove={pointerHandlers.onPointerMove}
      onPointerUp={pointerHandlers.onPointerUp}
      onPointerCancel={pointerHandlers.onPointerCancel}
    >
      <div
        data-testid="canvas-content"
        className="absolute inset-0 will-change-transform"
        // Dynamic transform value cannot be a static Tailwind class.
        style={{ transform: `translate3d(${String(viewport.x)}px, ${String(viewport.y)}px, 0)` }}
      >
        <ConnectionLayer />
        {nodeIds.map((id) => (
          <Node key={id} id={id} />
        ))}
      </div>
      {nodeIds.length === 0 && <EmptyState />}
      <ErrorBanner />
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
      Add a node from the toolbar to get started
    </div>
  );
}
