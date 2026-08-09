import { useEffect, useRef } from 'react';

interface TerrainScrollLoopOptions {
  animated: boolean;
  speed?: number;
  rampUpMs?: number;
  enabled?: boolean;
  onFrame: (groundScroll: number) => void;
}

export function useTerrainScrollLoop({
  animated,
  speed = 24,
  rampUpMs = 800,
  enabled = true,
  onFrame,
}: TerrainScrollLoopOptions) {
  const scrollOffsetRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animationStartTimeRef = useRef<number | null>(null);
  const bgPausedRef = useRef(false);
  const animatedRef = useRef(animated);
  const onFrameRef = useRef(onFrame);
  animatedRef.current = animated;
  onFrameRef.current = onFrame;

  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      bgPausedRef.current = document.visibilityState === 'hidden';
      if (document.visibilityState === 'visible') {
        lastTimeRef.current = performance.now();
        animationStartTimeRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    let rafId: number;

    const render = (now: number) => {
      rafId = requestAnimationFrame(render);
      if (bgPausedRef.current) return;
      if (animationStartTimeRef.current === null) {
        animationStartTimeRef.current = now;
      }

      const elapsedSinceStable = now - animationStartTimeRef.current;
      const rampUpFactor = Math.min(1, elapsedSinceStable / rampUpMs);
      const effectiveScrollSpeed = speed * rampUpFactor;

      if (animatedRef.current) {
        const dt = lastTimeRef.current
          ? Math.min((now - lastTimeRef.current) / 1000, 0.05)
          : 0;
        scrollOffsetRef.current += dt * effectiveScrollSpeed;
      }

      lastTimeRef.current = now;
      onFrameRef.current(scrollOffsetRef.current);
    };

    lastTimeRef.current = performance.now();
    animationStartTimeRef.current = performance.now();
    scrollOffsetRef.current = 0;
    rafId = requestAnimationFrame(render);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(rafId);
    };
  }, [speed, rampUpMs, enabled]);
}
