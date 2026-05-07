// SVG path generation for cubic bezier edges between two points.
//
// World coordinates only — pan/resize is free because each Edge re-renders
// from the current source/target positions in the store. CLAUDE.md §8:
// "SVG paths use viewport coordinates derived from store positions, not
// pre-computed absolute paths."

import type { Point } from './geometry';

export interface BezierPathOptions {
  /**
   * Horizontal control-point offset as a fraction of |dx| (default 0.5).
   * Higher values create a more pronounced S-curve; 0 yields a straight
   * line (control points coincide with anchors).
   */
  curvature?: number;
}

export function bezierPath(source: Point, target: Point, options: BezierPathOptions = {}): string {
  const curvature = options.curvature ?? 0.5;
  const offsetX = Math.abs(target.x - source.x) * curvature;
  const cx1 = source.x + offsetX;
  const cy1 = source.y;
  const cx2 = target.x - offsetX;
  const cy2 = target.y;
  return `M ${String(source.x)} ${String(source.y)} C ${String(cx1)} ${String(cy1)}, ${String(cx2)} ${String(cy2)}, ${String(target.x)} ${String(target.y)}`;
}
