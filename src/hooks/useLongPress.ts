import { useCallback, useRef } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  delay?: number;
  onStart?: () => void;
  onCancel?: () => void;
}

export function useLongPress({
  onLongPress,
  delay = 500,
  onStart,
  onCancel,
}: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const start = useCallback(() => {
    isLongPress.current = false;
    onStart?.();
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }, delay);
  }, [onLongPress, delay, onStart]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPress.current) {
      onCancel?.();
    }
  }, [onCancel]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}
