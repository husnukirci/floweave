// Edge — SVG path between two workflow nodes. React.memo'd, subscribes
// only to source and target node positions per CLAUDE.md §4: moving an
// unrelated node never re-renders unrelated edges.
//
// Caller is responsible for wrapping <Edge /> in an SVG element.
//
// Stub for TDD: returns null until commit 2 lands the real impl.

import { type JSX, memo } from 'react';

interface EdgeProps {
  id: string;
}

function EdgeComponent(_props: EdgeProps): JSX.Element | null {
  return null;
}

export const Edge = memo(EdgeComponent);
