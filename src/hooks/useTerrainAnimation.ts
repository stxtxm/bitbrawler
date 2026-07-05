/**
 * Terrain Animation Hook
 * Handles requestAnimationFrame with FPS control and proper cleanup
 */

import { useEffect, useRef, useState } from 'react';
import { getFrameDuration } from '../config/terrainConfig';

/**
 * Hook: Smooth terrain scrolling animation with FPS control
 */
export function useTerrainAnimation(
  fps: number,
  scrollSpeed: number,
  onScroll: (offset: number) => void,
  enabled: boolean = true,
) {
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(Date.now());
  const offsetRef = useRef<number>(0);
  const frameDurationRef = useRef<number>(getFrameDuration(fps));
  const bgPausedRef = useRef(false);

  // Update frame duration if fps changes
  useEffect(() => {
    frameDurationRef.current = getFrameDuration(fps);
  }, [fps]);

  useEffect(() => {
    if (!enabled) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    // Cancel any existing animation frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    lastFrameTimeRef.current = Date.now();

    const onVisibility = () => {
      bgPausedRef.current = document.visibilityState === 'hidden';
      if (document.visibilityState === 'visible') {
        lastFrameTimeRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const animate = () => {
      if (bgPausedRef.current) {
        rafIdRef.current = requestAnimationFrame(animate);
        return;
      }
      const now = Date.now();
      const elapsed = now - lastFrameTimeRef.current;

      // Only update if enough time has passed for the target FPS
      if (elapsed >= frameDurationRef.current) {
        offsetRef.current =
          (offsetRef.current + scrollSpeed) % (3000 * 4); // Wrap at reasonable distance

        onScroll(offsetRef.current);
        lastFrameTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [scrollSpeed, onScroll, enabled, fps]);

  return offsetRef.current;
}

/**
 * Hook: Multi-layer parallax animation with different speeds
 */
export function useParallaxAnimation(
  fps: number,
  baseScrollSpeed: number,
  layerCount: number,
  enabled: boolean = true,
): number[] {
  const [offsets, setOffsets] = useState<number[]>(
    Array(layerCount).fill(0),
  );

  useEffect(() => {
    if (!enabled) return;

    let rafId: number | null = null;
    let lastTime = Date.now();
    let bgPaused = false;
    const frameDuration = getFrameDuration(fps);

    const onVisibility = () => {
      bgPaused = document.visibilityState === 'hidden';
      if (document.visibilityState === 'visible') {
        lastTime = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const animate = () => {
      if (bgPaused) {
        rafId = requestAnimationFrame(animate);
        return;
      }
      const now = Date.now();
      const elapsed = now - lastTime;

      if (elapsed >= frameDuration) {
        setOffsets((prev) =>
          prev.map((offset, i) => {
            const multiplier = 1 - i * 0.15; // Each layer 15% slower
            const newOffset = (offset + baseScrollSpeed * multiplier) % 3000;
            return newOffset;
          }),
        );
        lastTime = now;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [fps, baseScrollSpeed, layerCount, enabled]);

  return offsets;
}

/**
 * Hook: Cloud drift animation (slow wandering)
 */
export function useCloudAnimation(
  fps: number,
  driftDistance: number,
  enabled: boolean = true,
): number {
  const [driftOffset, setDriftOffset] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let rafId: number | null = null;
    let lastTime = Date.now();
    let angle = 0;
    let bgPaused = false;
    const frameDuration = getFrameDuration(fps);

    const onVisibility = () => {
      bgPaused = document.visibilityState === 'hidden';
      if (document.visibilityState === 'visible') {
        lastTime = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const animate = () => {
      if (bgPaused) {
        rafId = requestAnimationFrame(animate);
        return;
      }
      const now = Date.now();
      const elapsed = now - lastTime;

      if (elapsed >= frameDuration) {
        angle += 0.02; // Very slow rotation
        const drift = Math.sin(angle) * driftDistance;
        setDriftOffset(drift);
        lastTime = now;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [fps, driftDistance, enabled]);

  return driftOffset;
}

/**
 * Hook: Grass sway animation
 */
export function useGrassSwayAnimation(
  fps: number,
  amplitude: number,
  frequency: number,
  enabled: boolean = true,
): number {
  const [swayOffset, setSwayOffset] = useState(0);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let rafId: number | null = null;
    const frameDuration = getFrameDuration(fps);
    let lastTime = Date.now();
    let bgPaused = false;

    const onVisibility = () => {
      bgPaused = document.visibilityState === 'hidden';
      if (document.visibilityState === 'visible') {
        lastTime = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const animate = () => {
      if (bgPaused) {
        rafId = requestAnimationFrame(animate);
        return;
      }
      const now = Date.now();
      const elapsed = now - lastTime;

      if (elapsed >= frameDuration) {
        timeRef.current += elapsed / 1000; // Convert to seconds
        const sway = Math.sin(timeRef.current * frequency * Math.PI * 2) * amplitude;
        setSwayOffset(sway);
        lastTime = now;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [fps, amplitude, frequency, enabled]);

  return swayOffset;
}

/**
 * Hook: Responsive canvas sizing with ResizeObserver
 */
export function useResponsiveCanvas(
  containerRef: React.RefObject<HTMLDivElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onResize?: (width: number, height: number) => void,
) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Force canvas bitmap reset by toggling width
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      setSize({ width: rect.width, height: rect.height });
      onResize?.(rect.width, rect.height);
    });

    resizeObserver.observe(container);

    // Trigger initial resize
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    setSize({ width: rect.width, height: rect.height });
    onResize?.(rect.width, rect.height);

    return () => resizeObserver.disconnect();
  }, [containerRef, canvasRef, onResize]);

  return size;
}
