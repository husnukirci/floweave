// SVG path generation for cubic bezier edges between two points.
//
// World coordinates only — pan/resize is free because each Edge re-renders
// from the current source/target positions in the store. CLAUDE.md §8:
// "SVG paths use viewport coordinates derived from store positions, not
// pre-computed absolute paths."
//
// Stub for TDD: real implementation lands in the next commit.

import type { Point } from './geometry';

export interface BezierPathOptions {
  /**
   * Horizontal control-point offset as a fraction of dx (default 0.5).
   * Higher values create a more pronounced S-curve.
   */
  curvature?: number;
}

export function bezierPath(
  _source: Point,
  _target: Point,
  _options: BezierPathOptions = {},
): string {
  throw new Error('bezierPath: not implemented (stub for TDD test commit)');
}
