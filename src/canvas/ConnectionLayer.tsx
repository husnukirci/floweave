// ConnectionLayer — full-canvas SVG overlay that hosts every Edge plus
// the GhostEdge during a connection drag (commit 3). CLAUDE.md §4: one
// SVG element with N paths beats N SVG elements; the browser batches
// well.
//
// pointer-events: none on the SVG itself so edges do not block node
// interaction; individual paths can opt back in via pointer-events
// when they need to be clickable (commit 4 for edge selection).

import type { JSX } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useWorkflowStore } from '@/state/StoresProvider';
import { selectEdgeIds } from '@/state/workflow/selectors';

import { Edge } from './Edge';
import { GhostEdge } from './GhostEdge';

export function ConnectionLayer(): JSX.Element {
  const edgeIds = useWorkflowStore(useShallow(selectEdgeIds));

  return (
    <svg
      data-testid="connection-layer"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      {edgeIds.map((id) => (
        <Edge key={id} id={id} />
      ))}
      <GhostEdge />
    </svg>
  );
}
