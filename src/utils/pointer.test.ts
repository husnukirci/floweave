import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRafThrottler, type RequestFrame } from './pointer';

describe('createRafThrottler', () => {
  // Manual frame scheduler — a Map of handle → callback so cancel
  // actually removes the callback (mirroring real cancelAnimationFrame
  // behaviour). Tests advance one frame at a time via advanceFrame.
  let scheduled: Map<number, FrameRequestCallback>;
  let nextHandle: number;
  let cancelled: number[];
  const fakeRaf: RequestFrame = (callback) => {
    nextHandle += 1;
    scheduled.set(nextHandle, callback);
    return nextHandle;
  };
  const fakeCancel = (handle: number): void => {
    cancelled.push(handle);
    scheduled.delete(handle);
  };

  const advanceFrame = (timestamp = 0): void => {
    const callbacks = Array.from(scheduled.values());
    scheduled.clear();
    for (const cb of callbacks) cb(timestamp);
  };

  beforeEach(() => {
    scheduled = new Map();
    nextHandle = 0;
    cancelled = [];
  });

  afterEach(() => {
    scheduled.clear();
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

  it('cancel is a no-op when no frame is scheduled', () => {
    const fn = vi.fn();
    const throttler = createRafThrottler<number>(fn, { raf: fakeRaf, cancelRaf: fakeCancel });
    throttler.cancel();
    expect(fn).not.toHaveBeenCalled();
    expect(cancelled).toEqual([]);
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
