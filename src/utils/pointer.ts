// Pointer-event utilities. Two exports:
//
//   - createRafThrottler: pure helper that coalesces multiple `push` calls
//     into a single fn invocation per animation frame. requestAnimationFrame
//     is dependency-injected so tests can substitute a synchronous shim.
//   - usePointerDrag: React hook that wires setPointerCapture-aware
//     drag handlers and uses createRafThrottler internally to throttle
//     pointermove updates per CLAUDE.md §4 performance invariants.
//
// Stub for TDD: real implementations land in commit 3.

import type { PointerEvent as ReactPointerEvent } from 'react';

export type RequestFrame = (callback: FrameRequestCallback) => number;
export type CancelFrame = (handle: number) => void;

export interface RafThrottlerOptions {
  raf?: RequestFrame;
  cancelRaf?: CancelFrame;
}

export interface RafThrottler<T> {
  /** Queue a value; the latest queued value is delivered on the next frame. */
  push: (value: T) => void;
  /** Synchronously deliver any pending value, then clear the queue. */
  flush: () => void;
  /** Discard any pending value without delivering it. */
  cancel: () => void;
}

export function createRafThrottler<T>(
  _fn: (value: T) => void,
  _options: RafThrottlerOptions = {},
): RafThrottler<T> {
  throw new Error('createRafThrottler: not implemented (stub for TDD test commit)');
}

export interface PointerDragDelta {
  /** Cursor position in client coordinates at the latest pointermove. */
  clientX: number;
  clientY: number;
  /** Total movement since pointerdown (clientX/Y - start.clientX/Y). */
  totalDx: number;
  totalDy: number;
}

export interface PointerDragHandlers<TStartData> {
  /**
   * Fires on pointerdown. Return a non-null value to start a drag (it is
   * passed to subsequent onDrag/onDragEnd calls). Return null to cancel.
   */
  onDragStart?: (event: ReactPointerEvent<HTMLElement>) => TStartData | null;
  /**
   * Fires once per animation frame during pointermove (rAF-throttled).
   * Receives the cumulative delta from pointerdown and the start data.
   */
  onDrag: (
    event: ReactPointerEvent<HTMLElement>,
    delta: PointerDragDelta,
    startData: TStartData,
  ) => void;
  /** Fires on pointerup or pointercancel after any pending drag is flushed. */
  onDragEnd?: (event: ReactPointerEvent<HTMLElement>, startData: TStartData) => void;
}

export interface PointerDragHandlerSet {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

export function usePointerDrag<TStartData = void>(
  _handlers: PointerDragHandlers<TStartData>,
): PointerDragHandlerSet {
  throw new Error('usePointerDrag: not implemented (stub for TDD test commit)');
}
