// Geometry helpers — pure, stateless transforms between screen and
// world coordinate spaces.
//
// World space: positions stored in the workflow store (WorkflowNode.position).
// Screen space: pixel positions relative to the Canvas element.
// They differ by the viewport pan offset (no zoom in v1 per ADR-006).
//
// Stub for TDD: real implementation lands in commit 3.

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

export function screenToWorld(_screen: Point, _viewport: Viewport): Point {
  throw new Error('screenToWorld: not implemented (stub for TDD test commit)');
}

export function worldToScreen(_world: Point, _viewport: Viewport): Point {
  throw new Error('worldToScreen: not implemented (stub for TDD test commit)');
}

export function getCanvasRelativePoint(
  _clientX: number,
  _clientY: number,
  _canvasRect: RectOffset,
): Point {
  throw new Error('getCanvasRelativePoint: not implemented (stub for TDD test commit)');
}
