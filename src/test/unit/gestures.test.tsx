import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useLongPress } from '../../hooks/useLongPress';

describe('useSwipeGesture', () => {
  it('should return onTouchStart and onTouchEnd handlers', () => {
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft: () => {} }),
    );
    expect(typeof result.current.onTouchStart).toBe('function');
    expect(typeof result.current.onTouchEnd).toBe('function');
  });

  it('should detect swipe left', () => {
    let called = false;
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft: () => { called = true; } }),
    );

    const startEvent = {
      touches: [{ clientX: 200, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const endEvent = {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    result.current.onTouchStart(startEvent);
    result.current.onTouchEnd(endEvent);

    expect(called).toBe(true);
  });

  it('should detect swipe right', () => {
    let called = false;
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeRight: () => { called = true; } }),
    );

    const startEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const endEvent = {
      changedTouches: [{ clientX: 200, clientY: 100 }],
    } as unknown as React.TouchEvent;

    result.current.onTouchStart(startEvent);
    result.current.onTouchEnd(endEvent);

    expect(called).toBe(true);
  });

  it('should not fire if swipe is below threshold', () => {
    let called = false;
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft: () => { called = true; }, threshold: 50 }),
    );

    const startEvent = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const endEvent = {
      changedTouches: [{ clientX: 120, clientY: 100 }],
    } as unknown as React.TouchEvent;

    result.current.onTouchStart(startEvent);
    result.current.onTouchEnd(endEvent);

    expect(called).toBe(false);
  });
});

describe('useLongPress', () => {
  it('should return event handlers', () => {
    const { result } = renderHook(() =>
      useLongPress({ onLongPress: () => {} }),
    );
    expect(typeof result.current.onMouseDown).toBe('function');
    expect(typeof result.current.onMouseUp).toBe('function');
    expect(typeof result.current.onTouchStart).toBe('function');
    expect(typeof result.current.onTouchEnd).toBe('function');
  });

  it('should call onCancel when released before delay', () => {
    let cancelled = false;
    const { result } = renderHook(() =>
      useLongPress({ onLongPress: () => {}, onCancel: () => { cancelled = true; } }),
    );

    result.current.onMouseDown();
    result.current.onMouseUp();

    expect(cancelled).toBe(true);
  });

  it('should call onStart on press', () => {
    let started = false;
    const { result } = renderHook(() =>
      useLongPress({ onLongPress: () => {}, onStart: () => { started = true; } }),
    );

    result.current.onMouseDown();
    expect(started).toBe(true);
  });
});
