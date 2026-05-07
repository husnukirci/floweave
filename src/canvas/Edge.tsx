// Edge — SVG path between two workflow nodes. React.memo'd, subscribes
// only to source and target node positions per CLAUDE.md §4: moving an
// unrelated node never re-renders unrelated edges.
//
// Caller is responsible for wrapping <Edge /> in an SVG element
// (ConnectionLayer does this).
//
// Visual styling here is the Tier 1 baseline (neutral stroke, arrow-
// head marker added in a later commit). Edge selection + deletion lands
// in commit 4; keyboard connection mode in commit 5.

import { type JSX, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { selectEdgeEndpoints } from '@/state/workflow/selectors';
import { workflowStore } from '@/state/workflow/instance';
import { bezierPath } from '@/utils/bezier';

interface EdgeProps {
  id: string;
}

// Where the path connects on the source/target node card. Nodes are
// rendered as ~140×56 cards positioned at their top-left corner. For a
// left-to-right flow, the path starts at the right-mid point of the
// source and ends at the left-mid point of the target.
const NODE_WIDTH = 140;
const NODE_HEIGHT = 56;

function anchorRight(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x + NODE_WIDTH, y: p.y + NODE_HEIGHT / 2 };
}

function anchorLeft(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x, y: p.y + NODE_HEIGHT / 2 };
}

function EdgeComponent({ id }: EdgeProps): JSX.Element | null {
  const { source, target, sourceLabel, targetLabel } = workflowStore(
    useShallow(selectEdgeEndpoints(id)),
  );

  if (!source || !target) return null;

  const d = bezierPath(anchorRight(source), anchorLeft(target));
  const ariaLabel = `Edge from ${sourceLabel} to ${targetLabel}`;

  return (
    <path
      id={`edge-${id}`}
      data-testid={`edge-${id}`}
      aria-label={ariaLabel}
      role="img"
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="text-neutral-400"
    />
  );
}

export const Edge = memo(EdgeComponent);
