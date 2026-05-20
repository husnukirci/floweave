// Handle — small interactive circle at the left (input) or right (output)
// edge of each Node card. Output handles start a drag-to-connect; input
// handles are passive drop targets identified via data attributes.
//
// CLAUDE.md §4: connection handles are pointer-event targets with hit-
// padding (visual size differs from hit size). The visible dot is 12px;
// the pointer-event area extends ~20px via padding.

import clsx from 'clsx';
import { type JSX, type PointerEvent as ReactPointerEvent, useMemo, useRef } from 'react';

import { useUiStore, useUiStoreApi, useWorkflowStoreApi } from '@/state/StoresProvider';
import { usePointerDrag, type PointerDragHandlers } from '@/utils/pointer';
import { getDeepElementFromPoint } from '@/utils/shadow';

export type HandleType = 'input' | 'output';

interface HandleProps {
  nodeId: string;
  type: HandleType;
}

interface DragData {
  sourceNodeId: string;
}

function getCanvasContentRect(fromEl: Element | null): DOMRect | null {
  // `document.querySelector` cannot reach into the editor's shadow root,
  // so look up via the closest ancestor on the originating element. The
  // canvas-content div is always an ancestor of any Handle.
  const el = fromEl?.closest('[data-testid="canvas-content"]') ?? null;
  return el ? el.getBoundingClientRect() : null;
}

function friendlyConnectionError(reason: string | null): string {
  switch (reason) {
    case 'self-loop':
      return "A node can't connect to itself.";
    case 'duplicate-edge':
      return 'These nodes are already connected.';
    case 'start-cannot-be-target':
      return "Start nodes can't receive incoming connections.";
    case 'end-cannot-be-source':
      return "End nodes can't have outgoing connections.";
    default:
      return 'Connection rejected.';
  }
}

// Convert a screen-space pointer position to world coordinates relative
// to the canvas content layer. The content layer's bounding rect already
// accounts for the viewport translate, so a simple subtraction suffices.
// fromEl anchors the shadow-aware ancestor lookup (an ancestor of the
// Handle that triggered the event).
function clientToWorld(
  clientX: number,
  clientY: number,
  fromEl: Element | null,
): { x: number; y: number } | null {
  const rect = getCanvasContentRect(fromEl);
  if (!rect) return null;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function Handle({ nodeId, type }: HandleProps): JSX.Element {
  const startConnecting = useUiStore((s) => s.startConnecting);
  const updateConnectingCursor = useUiStore((s) => s.updateConnectingCursor);
  const finishConnecting = useUiStore((s) => s.finishConnecting);
  const workflowStoreApi = useWorkflowStoreApi();
  const uiStoreApi = useUiStoreApi();
  // Ref to the wrapper element. React's SyntheticEvent.currentTarget
  // is nulled out after the dispatch returns, so the throttled onDrag
  // (which fires later from rAF) can't rely on the captured event's
  // currentTarget to anchor the shadow-aware canvas-content lookup.
  const wrapperRef = useRef<HTMLDivElement>(null);

  const dragHandlers = useMemo<PointerDragHandlers<DragData>>(
    () => ({
      onDragStart: (event) => {
        // Only output handles initiate a connection drag; input handles
        // are passive drop targets.
        if (type !== 'output') return null;
        event.stopPropagation();
        const cursor = clientToWorld(event.clientX, event.clientY, wrapperRef.current);
        startConnecting(nodeId);
        if (cursor) updateConnectingCursor(cursor);
        return { sourceNodeId: nodeId };
      },
      onDrag: (event) => {
        const cursor = clientToWorld(event.clientX, event.clientY, wrapperRef.current);
        if (cursor) updateConnectingCursor(cursor);
      },
      onDragEnd: (event, data) => {
        // Find an input handle under the cursor on drop. Walk up from
        // the topmost element to the nearest data-handle-type="input".
        // getDeepElementFromPoint pierces shadow roots — plain
        // document.elementFromPoint stops at the editor's shadow host.
        const elAtPoint = getDeepElementFromPoint(event.clientX, event.clientY);
        const dropTarget = elAtPoint?.closest('[data-handle-type="input"]');
        const targetNodeId = dropTarget?.getAttribute('data-node-id');

        if (targetNodeId && targetNodeId !== data.sourceNodeId) {
          const result = workflowStoreApi
            .getState()
            .connectNodes({ source: data.sourceNodeId, target: targetNodeId });
          if (!result.ok) {
            const reason = result.error.details?.reason;
            uiStoreApi.getState().setNotification({
              code: result.error.code,
              message: friendlyConnectionError(typeof reason === 'string' ? reason : null),
            });
          }
        }
        finishConnecting();
      },
    }),
    [
      type,
      nodeId,
      startConnecting,
      updateConnectingCursor,
      finishConnecting,
      workflowStoreApi,
      uiStoreApi,
    ],
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
      ref={wrapperRef}
      data-handle-type={type}
      data-node-id={nodeId}
      aria-hidden="true"
      className={clsx(
        'absolute z-10 flex h-5 w-5 items-center justify-center',
        // Hit-padding wrapper: 20px hit area, 10px visible dot.
        // Vertical centering uses an arbitrary-value transform rather
        // than `-translate-y-1/2` — Tailwind v4's translate utilities
        // resolve to `translate: none` inside Shadow DOM because the
        // `@property --tw-translate-x` registration doesn't apply to
        // adopted stylesheets.
        'top-1/2 [transform:translateY(-50%)]',
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
          // Filled dot in the node's accent colour, with a thin white
          // ring so it pops against both the canvas background and the
          // tinted node body. White-on-white reads as invisible.
          'block h-2.5 w-2.5 rounded-full bg-current ring-2 ring-white',
          'transition-transform group-hover:scale-125',
        )}
      />
    </div>
  );
}
