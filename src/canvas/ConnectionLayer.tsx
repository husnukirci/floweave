// ConnectionLayer — full-canvas SVG overlay that hosts every Edge plus
// the GhostEdge during a connection drag. CLAUDE.md §4: one SVG element
// with N paths beats N SVG elements; the browser batches well.
//
// Stub for TDD: returns an empty SVG element until commit 2 lands the
// real impl that maps Edge IDs to <Edge /> children and includes the
// GhostEdge during in-progress drags.

import type { JSX } from 'react';

export function ConnectionLayer(): JSX.Element {
  return (
    <svg
      data-testid="connection-layer"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
