// Pointer-event utilities. Two exports:
//
//   - createRafThrottler: pure helper that coalesces multiple `push` calls
//     into a single fn invocation per animation frame. requestAnimationFrame
//     is dependency-injected so tests substitute a synchronous shim.
//   - usePointerDrag: React hook that wires setPointerCapture-aware
//     drag handlers and uses createRafThrottler internally to throttle
//     pointermove updates per CLAUDE.md §4 performance invariants.

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef } from 'react';

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

const defaultRaf: RequestFrame = (callback) => requestAnimationFrame(callback);
const defaultCancel: CancelFrame = (handle) => {
  cancelAnimationFrame(handle);
};

export function createRafThrottler<T>(
  fn: (value: T) => void,
  options: RafThrottlerOptions = {},
): RafThrottler<T> {
  const requestFrame = options.raf ?? defaultRaf;
  const cancelFrame = options.cancelRaf ?? defaultCancel;

  // `pending` is wrapped in a single-element holder so we can distinguish
  // "no value queued" from "queued the value `undefined`".
  let pending: { value: T } | null = null;
  let frameHandle: number | null = null;

  const dispatch = (): void => {
    frameHandle = null;
    // pending is guaranteed non-null when dispatch fires: push always
    // sets pending before requesting a frame, and cancel/flush both
    // cancel the scheduled frame before clearing pending. The non-null
    // assertion is justified per CLAUDE.md §3 (with comment).
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const current = pending!;
    pending = null;
    fn(current.value);
  };

  return {
    push(value) {
      pending = { value };
      frameHandle ??= requestFrame(dispatch);
    },
    flush() {
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      if (!pending) return;
      const { value } = pending;
      pending = null;
      fn(value);
    },
    cancel() {
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      pending = null;
    },
  };
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
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => TStartData | null;
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

interface ThrottledMove {
  event: ReactPointerEvent<HTMLElement>;
  delta: PointerDragDelta;
}

interface ActiveDrag<TStartData> {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startData: TStartData;
  throttler: RafThrottler<ThrottledMove>;
}

export function usePointerDrag<TStartData = void>(
  handlers: PointerDragHandlers<TStartData>,
): PointerDragHandlerSet {
  const handlersRef = useRef(handlers);
  const stateRef = useRef<ActiveDrag<TStartData> | null>(null);

  // Keep the handler ref fresh so we always invoke the latest closures
  // without recreating onPointerDown/Move/Up callbacks on every render.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const result = handlersRef.current.onDragStart(event);
    if (result === null) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    // result captured by closure so the throttler callback does not need
    // to re-read stateRef.current (which would otherwise add an
    // unreachable null-check branch — flush always cancels the frame
    // before stateRef is cleared).
    const throttler = createRafThrottler<ThrottledMove>(({ event: latest, delta }) => {
      handlersRef.current.onDrag(latest, delta, result);
    });

    stateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startData: result,
      throttler,
    };
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const active = stateRef.current;
    if (active === null) return;
    if (active.pointerId !== event.pointerId) return;
    active.throttler.push({
      event,
      delta: {
        clientX: event.clientX,
        clientY: event.clientY,
        totalDx: event.clientX - active.startClientX,
        totalDy: event.clientY - active.startClientY,
      },
    });
  }, []);

  const finish = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const active = stateRef.current;
    if (active === null) return;
    if (active.pointerId !== event.pointerId) return;
    active.throttler.flush();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    handlersRef.current.onDragEnd?.(event, active.startData);
    stateRef.current = null;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
  };
}
