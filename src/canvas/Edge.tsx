// Edge — SVG path between two workflow nodes. React.memo'd, subscribes
// only to source and target node positions per CLAUDE.md §4: moving an
// unrelated node never re-renders unrelated edges.
//
// Two stacked paths so a thin visible line still has a comfortable hit
// target (CLAUDE.md §4: hit-padding distinct from visual stroke):
//   - The bottom path is transparent, thick, pointer-events="stroke"
//   - The top path is the visible thin stroke, pointer-events="none"
// Click on the wide invisible stroke selects the edge; Canvas's keydown
// listener handles Delete on the selected edge.

import clsx from 'clsx';
import { type JSX, type MouseEvent, memo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { selectEdgeEndpoints } from '@/state/workflow/selectors';
import { workflowStore } from '@/state/workflow/instance';
import { useUiStore } from '@/state/ui/uiStore';
import { bezierPath } from '@/utils/bezier';

interface EdgeProps {
  id: string;
}

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
  const isSelected = useUiStore((s) => s.selectedEdgeId === id);
  const selectEdge = useUiStore((s) => s.selectEdge);

  const handleClick = useCallback(
    (event: MouseEvent<SVGGElement>) => {
      event.stopPropagation();
      selectEdge(id);
    },
    [id, selectEdge],
  );

  if (!source || !target) return null;

  const d = bezierPath(anchorRight(source), anchorLeft(target));
  const ariaLabel = `Edge from ${sourceLabel} to ${targetLabel}`;

  return (
    <g
      data-testid={`edge-${id}`}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      data-selected={String(isSelected)}
      onClick={handleClick}
      className="cursor-pointer focus:outline-none"
      style={{ pointerEvents: 'visiblePainted' }}
    >
      {/* Wide invisible hit target so 2px lines are still easy to click */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        style={{ pointerEvents: 'stroke' }}
      />
      {/* Visible stroke — thicker + accent colour when selected */}
      <path
        id={`edge-${id}`}
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={isSelected ? 3 : 2}
        className={clsx('transition-colors', isSelected ? 'text-blue-500' : 'text-neutral-400')}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}

export const Edge = memo(EdgeComponent);
