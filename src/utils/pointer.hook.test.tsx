// Hook-level tests for usePointerDrag — mounts a small test component
// that wires the handler set onto a div, then drives pointer events
// through @testing-library/react. requestAnimationFrame is mocked via
// vitest fake timers so rAF coalescing behaviour is observable.

import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JSX } from 'react';

import { usePointerDrag, type PointerDragHandlers } from './pointer';

interface StartData {
  initialX: number;
}

function TestHarness({ handlers }: { handlers: PointerDragHandlers<StartData> }): JSX.Element {
  const set = usePointerDrag<StartData>(handlers);
  return <div data-testid="target" {...set} />;
}

describe('usePointerDrag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not start a drag when onDragStart returns null', () => {
    const onDragStart = vi.fn<PointerDragHandlers<StartData>['onDragStart']>(() => null);
    const onDrag = vi.fn<PointerDragHandlers<StartData>['onDrag']>();
    const onDragEnd = vi.fn<NonNullable<PointerDragHandlers<StartData>['onDragEnd']>>();

    const { getByTestId } = render(<TestHarness handlers={{ onDragStart, onDrag, onDragEnd }} />);
    const target = getByTestId('target');

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 10, clientY: 5 });
    vi.runAllTimers();

    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onDrag).not.toHaveBeenCalled();
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('coalesces multiple pointermove events into one onDrag per frame', () => {
    const startData: StartData = { initialX: 100 };
    const onDragStart = vi.fn<PointerDragHandlers<StartData>['onDragStart']>(() => startData);
    const onDrag = vi.fn<PointerDragHandlers<StartData>['onDrag']>();

    const { getByTestId } = render(<TestHarness handlers={{ onDragStart, onDrag }} />);
    const target = getByTestId('target');

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 60, clientY: 55 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 70, clientY: 60 });

    // rAF has not fired yet — onDrag is still pending.
    expect(onDrag).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(onDrag).toHaveBeenCalledOnce();
    const lastCall = onDrag.mock.calls[0];
    if (!lastCall) throw new Error('expected onDrag to have been called');
    const [, delta, dataReceived] = lastCall;
    expect(delta).toEqual({ clientX: 70, clientY: 60, totalDx: 20, totalDy: 10 });
    expect(dataReceived).toBe(startData);
  });

  it('flushes the pending move on pointerup before firing onDragEnd', () => {
    const onDragStart = vi.fn<PointerDragHandlers<StartData>['onDragStart']>(() => ({
      initialX: 0,
    }));
    const onDrag = vi.fn<PointerDragHandlers<StartData>['onDrag']>();
    const onDragEnd = vi.fn<NonNullable<PointerDragHandlers<StartData>['onDragEnd']>>();

    const { getByTestId } = render(<TestHarness handlers={{ onDragStart, onDrag, onDragEnd }} />);
    const target = getByTestId('target');

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 10, clientY: 5 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 10, clientY: 5 });

    // onDrag fired synchronously via flush(), even without advancing timers.
    expect(onDrag).toHaveBeenCalledOnce();
    expect(onDragEnd).toHaveBeenCalledOnce();
  });

  it('treats pointercancel like pointerup', () => {
    const onDragStart = vi.fn<PointerDragHandlers<StartData>['onDragStart']>(() => ({
      initialX: 0,
    }));
    const onDrag = vi.fn<PointerDragHandlers<StartData>['onDrag']>();
    const onDragEnd = vi.fn<NonNullable<PointerDragHandlers<StartData>['onDragEnd']>>();

    const { getByTestId } = render(<TestHarness handlers={{ onDragStart, onDrag, onDragEnd }} />);
    const target = getByTestId('target');

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerCancel(target, { pointerId: 1, clientX: 5, clientY: 5 });

    expect(onDragEnd).toHaveBeenCalledOnce();
  });

  it('ignores pointermove from a different pointerId', () => {
    const onDragStart = vi.fn<PointerDragHandlers<StartData>['onDragStart']>(() => ({
      initialX: 0,
    }));
    const onDrag = vi.fn<PointerDragHandlers<StartData>['onDrag']>();

    const { getByTestId } = render(<TestHarness handlers={{ onDragStart, onDrag }} />);
    const target = getByTestId('target');

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(target, { pointerId: 2, clientX: 10, clientY: 5 });
    vi.runAllTimers();

    expect(onDrag).not.toHaveBeenCalled();
  });

  it('ignores pointermove fired without a prior pointerdown', () => {
    const onDragStart = vi.fn<PointerDragHandlers<StartData>['onDragStart']>(() => ({
      initialX: 0,
    }));
    const onDrag = vi.fn<PointerDragHandlers<StartData>['onDrag']>();

    const { getByTestId } = render(<TestHarness handlers={{ onDragStart, onDrag }} />);
    const target = getByTestId('target');

    fireEvent.pointerMove(target, { pointerId: 1, clientX: 10, clientY: 5 });
    vi.runAllTimers();

    expect(onDrag).not.toHaveBeenCalled();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('ignores pointerup from a different pointerId', () => {
    const onDragStart = vi.fn<PointerDragHandlers<StartData>['onDragStart']>(() => ({
      initialX: 0,
    }));
    const onDrag = vi.fn<PointerDragHandlers<StartData>['onDrag']>();
    const onDragEnd = vi.fn<NonNullable<PointerDragHandlers<StartData>['onDragEnd']>>();

    const { getByTestId } = render(<TestHarness handlers={{ onDragStart, onDrag, onDragEnd }} />);
    const target = getByTestId('target');

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(target, { pointerId: 2, clientX: 0, clientY: 0 });

    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('ignores pointerup fired without a prior pointerdown', () => {
    const onDragStart = vi.fn<PointerDragHandlers<StartData>['onDragStart']>(() => ({
      initialX: 0,
    }));
    const onDrag = vi.fn<PointerDragHandlers<StartData>['onDrag']>();
    const onDragEnd = vi.fn<NonNullable<PointerDragHandlers<StartData>['onDragEnd']>>();

    const { getByTestId } = render(<TestHarness handlers={{ onDragStart, onDrag, onDragEnd }} />);
    const target = getByTestId('target');

    fireEvent.pointerUp(target, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('does not fire onDrag after pointerup', () => {
    const onDragStart = vi.fn<PointerDragHandlers<StartData>['onDragStart']>(() => ({
      initialX: 0,
    }));
    const onDrag = vi.fn<PointerDragHandlers<StartData>['onDrag']>();

    const { getByTestId } = render(<TestHarness handlers={{ onDragStart, onDrag }} />);
    const target = getByTestId('target');

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 0, clientY: 0 });

    fireEvent.pointerMove(target, { pointerId: 1, clientX: 10, clientY: 5 });
    vi.runAllTimers();

    expect(onDrag).not.toHaveBeenCalled();
  });
});
