// Node — visual representation of a single WorkflowNode. React.memo'd
// per CLAUDE.md §4: subscribes to its own node via selectNodeById and
// to its selection state, so unrelated state changes do not re-render.
//
// Visual treatment in commit 4 covers the 3 basic kinds (start / end /
// task) plus a generic custom-node look. Insurance-domain custom node
// variants with Lucide icons land in commit 6.

import clsx from 'clsx';
import { type JSX, type MouseEvent, memo, useCallback, useMemo } from 'react';

import { selectNodeById } from '@/state/workflow/selectors';
import { workflowStore } from '@/state/workflow/instance';
import { useUiStore } from '@/state/ui/uiStore';
import { usePointerDrag } from '@/utils/pointer';
import type { NodePosition } from '@/state/workflow/types';

interface NodeProps {
  id: string;
}

interface DragStartData {
  initialPosition: NodePosition;
}

function NodeComponent({ id }: NodeProps): JSX.Element | null {
  const node = workflowStore(selectNodeById(id));
  const isSelected = useUiStore((s) => s.selectedNodeId === id);
  const selectNode = useUiStore((s) => s.selectNode);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      selectNode(id);
    },
    [id, selectNode],
  );

  // Drag handler set — usePointerDrag wires setPointerCapture and rAF
  // throttling. Each frame, onDrag updates the node position via
  // moveNode; React re-renders only this Node thanks to the per-id
  // subscription. Drag also implicitly selects (selectNode in onDragStart).
  const dragHandlers = useMemo<Parameters<typeof usePointerDrag<DragStartData>>[0]>(
    () => ({
      onDragStart: (event) => {
        const current = workflowStore.getState().nodes[id];
        if (!current) return null;
        event.stopPropagation();
        selectNode(id);
        return { initialPosition: current.position };
      },
      onDrag: (_event, delta, startData) => {
        workflowStore.getState().moveNode(id, {
          x: startData.initialPosition.x + delta.totalDx,
          y: startData.initialPosition.y + delta.totalDy,
        });
      },
    }),
    [id, selectNode],
  );
  const pointerHandlers = usePointerDrag<DragStartData>(dragHandlers);

  if (!node) return null;

  const kindLabel = node.kind === 'custom' ? node.customType : node.kind;
  const ariaLabel = `${kindLabel} node: ${node.data.label}`;

  return (
    <button
      type="button"
      data-testid={`node-${id}`}
      data-kind={node.kind}
      data-selected={String(isSelected)}
      aria-label={ariaLabel}
      onClick={handleClick}
      onPointerDown={pointerHandlers.onPointerDown}
      onPointerMove={pointerHandlers.onPointerMove}
      onPointerUp={pointerHandlers.onPointerUp}
      onPointerCancel={pointerHandlers.onPointerCancel}
      className={clsx(
        'absolute flex min-w-[120px] flex-col items-center justify-center',
        'rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        'cursor-pointer hover:shadow-md',
        node.kind === 'start' && 'border-emerald-400 bg-emerald-50 text-emerald-900',
        node.kind === 'end' && 'border-rose-400 bg-rose-50 text-rose-900',
        node.kind === 'task' && 'border-blue-400 bg-blue-50 text-blue-900',
        node.kind === 'custom' && 'border-violet-400 bg-violet-50 text-violet-900',
        isSelected && 'ring-2 ring-blue-500 ring-offset-2',
      )}
      style={{
        // Dynamic position values — cannot be a static Tailwind class.
        left: `${String(node.position.x)}px`,
        top: `${String(node.position.y)}px`,
      }}
    >
      <span className="text-xs uppercase tracking-wide opacity-60">{kindLabel}</span>
      <span className="text-sm font-medium">{node.data.label}</span>
    </button>
  );
}

export const Node = memo(NodeComponent);
