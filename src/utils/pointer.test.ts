import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRafThrottler, type RequestFrame } from './pointer';

describe('createRafThrottler', () => {
  // Manual frame scheduler — a queue of pending callbacks that the test
  // can advance one frame at a time. Replaces requestAnimationFrame so
  // the throttler is observed deterministically.
  let pending: FrameRequestCallback[] = [];
  let nextHandle = 0;
  let cancelled: number[] = [];
  const fakeRaf: RequestFrame = (callback) => {
    nextHandle += 1;
    pending.push(callback);
    return nextHandle;
  };
  const fakeCancel = (handle: number): void => {
    cancelled.push(handle);
  };

  const advanceFrame = (timestamp = 0): void => {
    const frame = pending;
    pending = [];
    for (const cb of frame) cb(timestamp);
  };

  beforeEach(() => {
    pending = [];
    nextHandle = 0;
    cancelled = [];
  });

  afterEach(() => {
    pending = [];
  });

  it('does not call fn synchronously on push', () => {
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn, { raf: fakeRaf, cancelRaf: fakeCancel });
    throttler.push(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it('coalesces multiple pushes within a frame to the latest value', () => {
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn, { raf: fakeRaf, cancelRaf: fakeCancel });
    throttler.push(1);
    throttler.push(2);
    throttler.push(3);

    advanceFrame();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('schedules a new frame when push is called after the previous frame fires', () => {
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn, { raf: fakeRaf, cancelRaf: fakeCancel });
    throttler.push(1);
    advanceFrame();
    expect(fn).toHaveBeenCalledWith(1);

    throttler.push(2);
    advanceFrame();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(2);
  });

  it('flush synchronously delivers any pending value', () => {
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn, { raf: fakeRaf, cancelRaf: fakeCancel });
    throttler.push(7);

    throttler.flush();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(7);
  });

  it('flush is a no-op when nothing is pending', () => {
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn, { raf: fakeRaf, cancelRaf: fakeCancel });
    throttler.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush cancels the scheduled frame so it does not fire twice', () => {
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn, { raf: fakeRaf, cancelRaf: fakeCancel });
    throttler.push(7);
    throttler.flush();

    advanceFrame();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel discards a pending value without delivering it', () => {
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn, { raf: fakeRaf, cancelRaf: fakeCancel });
    throttler.push(7);

    throttler.cancel();
    advanceFrame();

    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel calls cancelRaf with the scheduled handle', () => {
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn, { raf: fakeRaf, cancelRaf: fakeCancel });
    throttler.push(7);

    const expectedHandle = nextHandle;
    throttler.cancel();

    expect(cancelled).toContain(expectedHandle);
  });

  it('falls back to global requestAnimationFrame when no raf option supplied', () => {
    // Ensure the default code path does not throw when the option is omitted.
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn);
    throttler.push(1);
    throttler.cancel();
    expect(fn).not.toHaveBeenCalled();
  });
});
