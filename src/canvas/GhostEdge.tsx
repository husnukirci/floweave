// GhostEdge — the dashed bezier path that follows the cursor during a
// drag-to-connect. Renders only while uiStore.isConnecting is true.
//
// Lives inside ConnectionLayer (the SVG overlay) so it shares the
// world-coordinate space with the real Edges and the panned content
// layer.

import { type JSX } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useUiStore, useWorkflowStore } from '@/state/StoresProvider';
import { selectNodeById } from '@/state/workflow/selectors';
import { bezierPath } from '@/utils/bezier';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 56;

function anchorRight(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x + NODE_WIDTH, y: p.y + NODE_HEIGHT / 2 };
}

export function GhostEdge(): JSX.Element | null {
  const isConnecting = useUiStore((s) => s.isConnecting);
  const fromNodeId = useUiStore((s) => s.connectingFromNodeId);
  const cursor = useUiStore(
    useShallow((s) =>
      s.connectingCursor ? { x: s.connectingCursor.x, y: s.connectingCursor.y } : null,
    ),
  );
  // Read source position non-reactively; we only need it while connecting,
  // and the per-frame trigger is the cursor update above.
  const sourceNode = useWorkflowStore(
    useShallow((state) => (fromNodeId ? selectNodeById(fromNodeId)(state) : null)),
  );

  if (!isConnecting || !cursor || !sourceNode) return null;

  const d = bezierPath(anchorRight(sourceNode.position), cursor);

  return (
    <path
      data-testid="ghost-edge"
      aria-hidden="true"
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeDasharray="6 4"
      className="text-blue-500"
    />
  );
}
