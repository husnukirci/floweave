import { describe, expect, it } from 'vitest';

import { bezierPath } from './bezier';

describe('bezierPath', () => {
  it('starts at the source point with an SVG move command', () => {
    const path = bezierPath({ x: 10, y: 20 }, { x: 100, y: 80 });
    expect(path).toMatch(/^M\s*10\s+20\b/);
  });

  it('ends at the target point', () => {
    const path = bezierPath({ x: 10, y: 20 }, { x: 100, y: 80 });
    expect(path).toMatch(/100\s+80\s*$/);
  });

  it('uses a cubic bezier (C command, two control points)', () => {
    const path = bezierPath({ x: 0, y: 0 }, { x: 200, y: 0 });
    // Cubic bezier: M x1 y1 C cx1 cy1, cx2 cy2, x2 y2 — six numbers after C.
    expect(path).toMatch(/C\s+/);
    const numbersAfterC = (/C\s+([\d\s,.-]+)/.exec(path) ?? [])[1] ?? '';
    const count = numbersAfterC.match(/-?\d+(?:\.\d+)?/g)?.length ?? 0;
    expect(count).toBeGreaterThanOrEqual(6);
  });

  it('handles a horizontal connection cleanly (no NaN, finite numbers)', () => {
    const path = bezierPath({ x: 0, y: 50 }, { x: 200, y: 50 });
    expect(path).not.toMatch(/NaN|Infinity/);
  });

  it('produces different paths for different positions', () => {
    const a = bezierPath({ x: 0, y: 0 }, { x: 100, y: 0 });
    const b = bezierPath({ x: 0, y: 0 }, { x: 200, y: 0 });
    expect(a).not.toBe(b);
  });

  it('honors the curvature option', () => {
    const flat = bezierPath({ x: 0, y: 0 }, { x: 100, y: 0 }, { curvature: 0 });
    const curvy = bezierPath({ x: 0, y: 0 }, { x: 100, y: 0 }, { curvature: 1 });
    expect(flat).not.toBe(curvy);
  });
});
