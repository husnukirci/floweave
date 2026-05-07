// Handle — small interactive circle at the left (input) or right (output)
// edge of each Node card. Output handles start a drag-to-connect; input
// handles are passive drop targets identified via data attributes.
//
// CLAUDE.md §4: connection handles are pointer-event targets with hit-
// padding (visual size differs from hit size). The visible dot is 12px;
// the pointer-event area extends ~20px via padding.

import clsx from 'clsx';
import { type JSX, type PointerEvent as ReactPointerEvent, useMemo } from 'react';

import { workflowStore } from '@/state/workflow/instance';
import { useUiStore } from '@/state/ui/uiStore';
import { usePointerDrag, type PointerDragHandlers } from '@/utils/pointer';

export type HandleType = 'input' | 'output';

interface HandleProps {
  nodeId: string;
  type: HandleType;
}

interface DragData {
  sourceNodeId: string;
}

function getCanvasContentRect(): DOMRect | null {
  const el = document.querySelector('[data-testid="canvas-content"]');
  return el ? el.getBoundingClientRect() : null;
}

// Convert a screen-space pointer position to world coordinates relative
// to the canvas content layer. The content layer's bounding rect already
// accounts for the viewport translate, so a simple subtraction suffices.
function clientToWorld(clientX: number, clientY: number): { x: number; y: number } | null {
  const rect = getCanvasContentRect();
  if (!rect) return null;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function Handle({ nodeId, type }: HandleProps): JSX.Element {
  const startConnecting = useUiStore((s) => s.startConnecting);
  const updateConnectingCursor = useUiStore((s) => s.updateConnectingCursor);
  const finishConnecting = useUiStore((s) => s.finishConnecting);

  const dragHandlers = useMemo<PointerDragHandlers<DragData>>(
    () => ({
      onDragStart: (event) => {
        // Only output handles initiate a connection drag; input handles
        // are passive drop targets.
        if (type !== 'output') return null;
        event.stopPropagation();
        const cursor = clientToWorld(event.clientX, event.clientY);
        startConnecting(nodeId);
        if (cursor) updateConnectingCursor(cursor);
        return { sourceNodeId: nodeId };
      },
      onDrag: (event) => {
        const cursor = clientToWorld(event.clientX, event.clientY);
        if (cursor) updateConnectingCursor(cursor);
      },
      onDragEnd: (event, data) => {
        // Find an input handle under the cursor on drop. Walk up from
        // the topmost element to the nearest data-handle-type="input".
        const elAtPoint = document.elementFromPoint(event.clientX, event.clientY);
        const dropTarget = elAtPoint?.closest('[data-handle-type="input"]');
        const targetNodeId = dropTarget?.getAttribute('data-node-id');

        if (targetNodeId && targetNodeId !== data.sourceNodeId) {
          const result = workflowStore
            .getState()
            .connectNodes({ source: data.sourceNodeId, target: targetNodeId });
          if (!result.ok) {
            // Tier 1: log the rejection. Inline error UI lands in commit 4.
            console.warn(`connectNodes: ${result.error.code}`, result.error.details);
          }
        }
        finishConnecting();
      },
    }),
    [type, nodeId, startConnecting, updateConnectingCursor, finishConnecting],
  );

  const pointerHandlers = usePointerDrag<DragData>(dragHandlers);

  // Stop propagation on input-handle clicks so a node click does not
  // also fire when the user is precisely targeting the handle.
  const stop = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.stopPropagation();
  };

  const isOutput = type === 'output';

  return (
    <div
      data-handle-type={type}
      data-node-id={nodeId}
      aria-hidden="true"
      className={clsx(
        'absolute z-10 flex h-5 w-5 items-center justify-center',
        // Hit-padding wrapper: 20px hit area, 10px visible dot.
        'top-1/2 -translate-y-1/2',
        isOutput ? '-right-2.5' : '-left-2.5',
        isOutput ? 'cursor-crosshair' : 'cursor-default',
      )}
      onPointerDown={isOutput ? pointerHandlers.onPointerDown : stop}
      onPointerMove={isOutput ? pointerHandlers.onPointerMove : undefined}
      onPointerUp={isOutput ? pointerHandlers.onPointerUp : undefined}
      onPointerCancel={isOutput ? pointerHandlers.onPointerCancel : undefined}
    >
      <span
        className={clsx(
          'block h-2.5 w-2.5 rounded-full border-2 border-current bg-white',
          'transition-transform group-hover:scale-125',
        )}
      />
    </div>
  );
}
