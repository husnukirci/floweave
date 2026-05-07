// Geometry helpers — pure, stateless transforms between screen and
// world coordinate spaces.
//
// World space: positions stored in the workflow store (WorkflowNode.position).
// Screen space: pixel positions relative to the Canvas element.
// They differ by the viewport pan offset (no zoom in v1 per ADR-006).

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
}

export interface RectOffset {
  left: number;
  top: number;
}

export function screenToWorld(screen: Point, viewport: Viewport): Point {
  return { x: screen.x - viewport.x, y: screen.y - viewport.y };
}

export function worldToScreen(world: Point, viewport: Viewport): Point {
  return { x: world.x + viewport.x, y: world.y + viewport.y };
}

export function getCanvasRelativePoint(
  clientX: number,
  clientY: number,
  canvasRect: RectOffset,
): Point {
  return { x: clientX - canvasRect.left, y: clientY - canvasRect.top };
}
