import { describe, expect, it } from 'vitest';

import { getCanvasRelativePoint, screenToWorld, worldToScreen } from './geometry';

describe('geometry', () => {
  describe('screenToWorld', () => {
    it('returns the same point when viewport is at origin', () => {
      expect(screenToWorld({ x: 100, y: 200 }, { x: 0, y: 0 })).toEqual({ x: 100, y: 200 });
    });

    it('subtracts the viewport offset from screen coordinates', () => {
      // Visual intuition: when the canvas content layer is translated
      // right by 50, a screen pixel at x=200 corresponds to world x=150.
      expect(screenToWorld({ x: 200, y: 100 }, { x: 50, y: 30 })).toEqual({ x: 150, y: 70 });
    });

    it('handles negative viewport offsets', () => {
      expect(screenToWorld({ x: 100, y: 100 }, { x: -50, y: -30 })).toEqual({ x: 150, y: 130 });
    });
  });

  describe('worldToScreen', () => {
    it('returns the same point when viewport is at origin', () => {
      expect(worldToScreen({ x: 100, y: 200 }, { x: 0, y: 0 })).toEqual({ x: 100, y: 200 });
    });

    it('adds the viewport offset to world coordinates', () => {
      expect(worldToScreen({ x: 100, y: 100 }, { x: 50, y: 30 })).toEqual({ x: 150, y: 130 });
    });
  });

  describe('round-trip', () => {
    it('worldToScreen ∘ screenToWorld is identity for non-zero viewport', () => {
      const viewport = { x: 73, y: -42 };
      const original = { x: 200, y: 350 };
      const world = screenToWorld(original, viewport);
      const back = worldToScreen(world, viewport);
      expect(back).toEqual(original);
    });

    it('screenToWorld ∘ worldToScreen is identity', () => {
      const viewport = { x: 73, y: -42 };
      const original = { x: 200, y: 350 };
      const screen = worldToScreen(original, viewport);
      const back = screenToWorld(screen, viewport);
      expect(back).toEqual(original);
    });
  });

  describe('getCanvasRelativePoint', () => {
    it('subtracts the rect offset from client coordinates', () => {
      expect(getCanvasRelativePoint(150, 130, { left: 50, top: 30 })).toEqual({ x: 100, y: 100 });
    });

    it('returns the origin when client equals rect top-left', () => {
      expect(getCanvasRelativePoint(100, 200, { left: 100, top: 200 })).toEqual({ x: 0, y: 0 });
    });

    it('handles a canvas not at the viewport origin', () => {
      // e.g. canvas inside a sidebar layout offset from the page edge
      expect(getCanvasRelativePoint(500, 400, { left: 200, top: 100 })).toEqual({
        x: 300,
        y: 300,
      });
    });
  });
});
