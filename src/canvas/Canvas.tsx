// Canvas — root container for the workflow editor's interactive surface.
//
// Architecture invariants (CLAUDE.md §4):
//   - Pan via `transform: translate3d(...)` on the inner content layer
//     with `will-change: transform`; never `top`/`left` for pan.
//   - Pointer events with `setPointerCapture` for drag interactions —
//     no document-level listeners.
//   - Hybrid HTML+SVG canvas: HTML divs for nodes (rendered inside
//     this container in commit 4), SVG overlay for edges (Phase 3).
//
// Pan handler is currently direct (no rAF throttle). Commit 5 wraps
// it in the rAF pointer hook (src/utils/pointer.ts) once the utility
// ships.

import { type JSX, type PointerEvent, useCallback, useRef } from 'react';

import { useUiStore } from '@/state/ui/uiStore';

interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  startVx: number;
  startVy: number;
}

export function Canvas(): JSX.Element {
  const viewport = useUiStore((s) => s.viewport);
  const setViewport = useUiStore((s) => s.setViewport);
  const panRef = useRef<PanState | null>(null);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      // Pan only when the down event hits the canvas itself; nodes will
      // mount in commit 4 and stop propagation to start their own drag.
      if (event.target !== event.currentTarget) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startVx: viewport.x,
        startVy: viewport.y,
      };
    },
    [viewport.x, viewport.y],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const state = panRef.current;
      if (state?.pointerId !== event.pointerId) return;
      setViewport({
        x: state.startVx + (event.clientX - state.startX),
        y: state.startVy + (event.clientY - state.startY),
      });
    },
    [setViewport],
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const state = panRef.current;
    if (state?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    panRef.current = null;
  }, []);

  return (
    <div
      role="application"
      aria-label="Workflow canvas"
      className="relative h-full w-full cursor-grab overflow-hidden bg-neutral-50"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        data-testid="canvas-content"
        className="absolute inset-0 will-change-transform"
        // Dynamic transform value cannot be a static Tailwind class.
        style={{ transform: `translate3d(${String(viewport.x)}px, ${String(viewport.y)}px, 0)` }}
      >
        {/* Nodes mount here in commit 4; SVG edge overlay in Phase 3. */}
      </div>
      <EmptyState />
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
