// Node — visual representation of a single WorkflowNode. React.memo'd
// per CLAUDE.md §4: subscribes to its own node via selectNodeById and
// to its selection state, so unrelated state changes do not re-render.
//
// Visual treatment in commit 4 covers the 3 basic kinds (start / end /
// task) plus a generic custom-node look. Insurance-domain custom node
// variants with Lucide icons land in commit 6.

import clsx from 'clsx';
import { type JSX, type KeyboardEvent, type MouseEvent, memo, useCallback, useMemo } from 'react';

import { CUSTOM_NODE_REGISTRY, type CustomNodeSpec } from '@/nodes/registry';
import {
  useUiStore,
  useUiStoreApi,
  useWorkflowStore,
  useWorkflowStoreApi,
} from '@/state/StoresProvider';
import { selectNodeById } from '@/state/workflow/selectors';
import type { NodePosition } from '@/state/workflow/types';
import { usePointerDrag } from '@/utils/pointer';

import { Handle } from './Handle';

interface NodeProps {
  id: string;
}

interface DragStartData {
  initialPosition: NodePosition;
}

function NodeComponent({ id }: NodeProps): JSX.Element | null {
  const node = useWorkflowStore(selectNodeById(id));
  const workflowStoreApi = useWorkflowStoreApi();
  const uiStoreApi = useUiStoreApi();
  const isSelected = useUiStore((s) => s.selectedNodeId === id);
  const selectNode = useUiStore((s) => s.selectNode);

  const isConnecting = useUiStore((s) => s.isConnecting);
  const connectingFromNodeId = useUiStore((s) => s.connectingFromNodeId);
  const isConnectingFromMe = isConnecting && connectingFromNodeId === id;

  // True while this node is in the AI-added pulse window. The selector
  // returns a primitive so unrelated set mutations don't re-render
  // nodes whose flag didn't actually flip.
  const isRecentlyAdded = useUiStore((s) => s.recentlyAddedNodeIds.has(id));

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      selectNode(id);
    },
    [id, selectNode],
  );

  // Keyboard interactions per CLAUDE.md §4 accessibility:
  //   - Delete / Backspace: remove the focused node (cascade-delete edges)
  //   - Arrow Right / Down: focus the next node in insertion order (wraps)
  //   - Arrow Left / Up:    focus the previous node (wraps)
  //   - c: enter keyboard connection mode from this node (PLAN.md §6 Phase 3)
  //   - Enter (while connecting): connect from the source to this node
  //   - Escape (while connecting): cancel
  // Selection via keyboard happens through the browser's default Enter/Space
  // → click on the focused button.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const ui = uiStoreApi.getState();

      // Connection-mode keys take priority when isConnecting is active.
      if (ui.isConnecting) {
        if (event.key === 'Escape') {
          event.preventDefault();
          ui.finishConnecting();
          return;
        }
        if (event.key === 'Enter') {
          // Connect source → this node.
          const source = ui.connectingFromNodeId;
          if (source && source !== id) {
            event.preventDefault();
            const result = workflowStoreApi.getState().connectNodes({ source, target: id });
            if (!result.ok) {
              const reason = result.error.details?.reason;
              ui.setNotification({
                code: result.error.code,
                message: friendlyConnectionError(typeof reason === 'string' ? reason : null),
              });
            }
            ui.finishConnecting();
            return;
          }
        }
        // Allow normal navigation/escape during connect; fall through.
      }

      if (event.key === 'c' || event.key === 'C') {
        // Start nodes can't receive incoming connections, so initiating
        // FROM end (which can't be a source) is also disallowed. The
        // store will reject these, but suppress the keystroke for
        // end-kind nodes to avoid a confusing UI flash.
        const node = workflowStoreApi.getState().nodes[id];
        if (!node || node.kind === 'end') return;
        event.preventDefault();
        ui.startConnecting(id);
        ui.setNotification({
          code: 'CONNECTING',
          message: `Connecting from ${node.data.label}. Press Enter on a target, Escape to cancel.`,
        });
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        workflowStoreApi.getState().removeNode(id);
        return;
      }
      if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowUp'
      ) {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 'next' : 'prev';
        focusAdjacentNode(id, direction, Object.keys(workflowStoreApi.getState().nodes));
      }
    },
    [id, uiStoreApi, workflowStoreApi],
  );

  // Drag handler set — usePointerDrag wires setPointerCapture and rAF
  // throttling. Each frame, onDrag updates the node position via
  // moveNode; React re-renders only this Node thanks to the per-id
  // subscription. Drag also implicitly selects (selectNode in onDragStart).
  const dragHandlers = useMemo<Parameters<typeof usePointerDrag<DragStartData>>[0]>(
    () => ({
      onDragStart: (event) => {
        const current = workflowStoreApi.getState().nodes[id];
        if (!current) return null;
        event.stopPropagation();
        selectNode(id);
        return { initialPosition: current.position };
      },
      onDrag: (_event, delta, startData) => {
        workflowStoreApi.getState().moveNode(id, {
          x: startData.initialPosition.x + delta.totalDx,
          y: startData.initialPosition.y + delta.totalDy,
        });
      },
    }),
    [id, selectNode, workflowStoreApi],
  );
  const pointerHandlers = usePointerDrag<DragStartData>(dragHandlers);

  if (!node) return null;

  const customSpec: CustomNodeSpec | null =
    node.kind === 'custom' ? CUSTOM_NODE_REGISTRY[node.customType] : null;
  const kindLabel = customSpec ? customSpec.label : node.kind;
  const ariaLabel = `${kindLabel} node: ${node.data.label}`;

  return (
    <button
      type="button"
      data-testid={`node-${id}`}
      data-kind={node.kind}
      data-custom-type={node.kind === 'custom' ? node.customType : undefined}
      data-selected={String(isSelected)}
      data-recently-added={isRecentlyAdded ? '' : undefined}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={pointerHandlers.onPointerDown}
      onPointerMove={pointerHandlers.onPointerMove}
      onPointerUp={pointerHandlers.onPointerUp}
      onPointerCancel={pointerHandlers.onPointerCancel}
      className={clsx(
        'absolute flex min-w-[140px] flex-col items-center justify-center',
        'rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        'cursor-pointer hover:shadow-md',
        node.kind === 'start' && 'border-emerald-400 bg-emerald-50 text-emerald-900',
        node.kind === 'end' && 'border-rose-400 bg-rose-50 text-rose-900',
        node.kind === 'task' && 'border-blue-400 bg-blue-50 text-blue-900',
        customSpec && [customSpec.borderClass, customSpec.bgClass, customSpec.textClass],
        isSelected && 'ring-2 ring-blue-500 ring-offset-2',
        isConnectingFromMe && 'ring-2 ring-amber-400 ring-offset-2',
        isRecentlyAdded && 'animate-pulse-highlight',
      )}
      style={{
        // Dynamic position values — cannot be a static Tailwind class.
        left: `${String(node.position.x)}px`,
        top: `${String(node.position.y)}px`,
      }}
    >
      <span className="flex items-center gap-1 text-xs uppercase tracking-wide opacity-70">
        {customSpec ? (
          <customSpec.icon aria-hidden className={clsx('h-3 w-3', customSpec.iconClass)} />
        ) : null}
        {kindLabel}
      </span>
      <span className="text-sm font-medium">{node.data.label}</span>
      {/* Connection handles. Start nodes only emit (output); end nodes
          only receive (input); task and custom nodes have both. */}
      {node.kind !== 'start' ? <Handle nodeId={id} type="input" /> : null}
      {node.kind !== 'end' ? <Handle nodeId={id} type="output" /> : null}
    </button>
  );
}

export const Node = memo(NodeComponent);

function focusAdjacentNode(
  currentId: string,
  direction: 'next' | 'prev',
  nodeIds: readonly string[],
): void {
  const currentIndex = nodeIds.indexOf(currentId);
  if (currentIndex === -1) return;
  const offset = direction === 'next' ? 1 : -1;
  const nextIndex = (currentIndex + offset + nodeIds.length) % nodeIds.length;
  const nextId = nodeIds[nextIndex];
  if (nextId === undefined) return;
  const target = document.querySelector(`[data-testid="node-${nextId}"]`);
  if (target instanceof HTMLElement) target.focus();
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
