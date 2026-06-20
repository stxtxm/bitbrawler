import { useCallback, useRef } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}

interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
}: SwipeOptions) {
  const stateRef = useRef<SwipeState>({ startX: 0, startY: 0, startTime: 0 });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    stateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - stateRef.current.startX;
      const dy = touch.clientY - stateRef.current.startY;
      const elapsed = Date.now() - stateRef.current.startTime;

      if (elapsed > 500) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > absDy && absDx > threshold) {
        if (dx > 0) onSwipeRight?.();
        else onSwipeLeft?.();
      } else if (absDy > absDx && absDy > threshold) {
        if (dy > 0) onSwipeDown?.();
        else onSwipeUp?.();
      }
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
