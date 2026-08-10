import { useEffect, useMemo, useRef } from 'react';
import { useResponsiveCanvas } from '../../hooks/useTerrainAnimation';
import {
  wrapPhase,
  tileScanStart,
  worldIndexAt,
  drawVolcano,
} from './terrainShared';
import {
  VOLCANIC_TERRAIN,
  getLayerSpeed,
} from './biomeTerrainConfig';

interface BiomeTerrainProps {
  width?: number;
  height?: number;
  seed: string;
  biomeId?: string;
  animated?: boolean;
}

const PI2 = Math.PI * 2;

export const BiomeTerrain: React.FC<BiomeTerrainProps> = ({
  width: propWidth,
  height: propHeight,
  seed,
  biomeId = 'volcanic',
  animated = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollOffsetRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animatedRef = useRef(animated);
  const animationStartTime = useRef<number | null>(null);
  const bgPausedRef = useRef(false);

  animatedRef.current = animated;

  const canvasSize = useResponsiveCanvas(containerRef, canvasRef);
  const width = canvasSize.width || propWidth || 0;
  const height = canvasSize.height || propHeight || 0;

  const seedNum = useMemo(
    () => parseInt(seed.replace(/\D/g, '') || '0', 10),
    [seed],
  );

  const cfg = VOLCANIC_TERRAIN[biomeId] ?? VOLCANIC_TERRAIN.volcanic;

  const isMobile = width < 768;
  const groundTop = height * (isMobile ? 0.74 : 0.62);

  useEffect(() => {
    if (width === 0 || height === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const layerSpeed = (id: string) => getLayerSpeed(cfg, id);

    const drawFrame = (groundScroll: number) => {
      if (typeof ctx.setTransform !== 'function') return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, width, height);

      // Lock to integer pixels for tear-free pixel-art scrolling
      const scrollPx = Math.round(groundScroll);

      const sky = ctx.createLinearGradient(0, 0, 0, height);
      for (const [stop, color] of cfg.sky) {
        sky.addColorStop(stop, color);
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // ── Sun glow (brighter than SceneBackground) ──
      const sunPhase = wrapPhase(scrollPx, 0.05, width);
      const sunX = Math.round(width * 0.68 - sunPhase);
      const sunY = Math.round(groundTop - height * 0.22);
      ctx.fillStyle = '#ffd060';
      ctx.fillRect(sunX - 18, sunY - 18, 36, 36);
      ctx.fillStyle = '#fff0b0';
      ctx.fillRect(sunX - 10, sunY - 10, 20, 20);

      // ── Far volcano silhouettes (slow parallax) ──
      const farSpeed = layerSpeed('volcanoFar');
      const farSpacing = 340;
      const farPhase = wrapPhase(scrollPx, farSpeed, farSpacing);
      for (let sx = tileScanStart(farPhase, farSpacing); sx < width + farSpacing; sx += farSpacing) {
        if (sx < -farSpacing || sx > width + farSpacing) continue;
        const worldIdx = worldIndexAt(sx, scrollPx, farSpeed, farSpacing);
        const h = (worldIdx * 31 + seedNum * 7) % 101;
        if (h > 25) continue;
        const off = ((worldIdx * 7 + seedNum * 5) % 31) - 15;
        const vw = 90 + (h % 6) * 14;
        const vh = 110 + (h % 8) * 16;
        drawVolcano(ctx, Math.round(sx + off), groundTop, vw, vh, cfg.volcanoFar, cfg.crater, null);
      }

      // ── Ash drifting (background particles) ──
      const ashSpeed = layerSpeed('ash');
      const ashSpacing = 52;
      const ashPhase = wrapPhase(scrollPx, ashSpeed, ashSpacing);
      for (let sx = tileScanStart(ashPhase, ashSpacing); sx < width + ashSpacing; sx += ashSpacing) {
        if (sx < -20 || sx > width + 20) continue;
        const worldIdx = worldIndexAt(sx, scrollPx, ashSpeed, ashSpacing);
        const h = (worldIdx * 13 + seedNum * 3) % 101;
        if (h > 55) continue;
        const ay = Math.round(((h % 40) / 40) * (groundTop - 30) + 8);
        const size = 2 + (h % 3);
        ctx.fillStyle = cfg.ash;
        ctx.fillRect(Math.round(sx + ((h % 11) - 5)), ay, size, size);
      }

      // ── Near volcanoes with glowing craters + lava flows ──
      const nearSpeed = layerSpeed('volcanoNear');
      const lavaSpeed = layerSpeed('lava');
      const nearSpacing = 430;
      const nearPhase = wrapPhase(scrollPx, nearSpeed, nearSpacing);
      for (let sx = tileScanStart(nearPhase, nearSpacing); sx < width + nearSpacing; sx += nearSpacing) {
        if (sx < -nearSpacing || sx > width + nearSpacing) continue;
        const worldIdx = worldIndexAt(sx, scrollPx, nearSpeed, nearSpacing);
        const h = (worldIdx * 23 + seedNum * 11) % 101;
        if (h > 30) continue;
        const off = ((worldIdx * 13 + seedNum * 7) % 41) - 20;
        const vw = 150 + (h % 7) * 18;
        const vh = 150 + (h % 9) * 20;
        const vx = Math.round(sx + off);
        drawVolcano(ctx, vx, groundTop, vw, vh, cfg.volcanoNear, cfg.crater, cfg.lava);
        // Lava pool glow at the base
        ctx.fillStyle = cfg.lavaBright;
        ctx.fillRect(vx - 14, groundTop - 2, 28, 4);
        ctx.fillStyle = cfg.lava;
        ctx.fillRect(vx - 10, groundTop + 2, 20, 3);
      }

      // ── Basalt ground with lava veins ──
      ctx.fillStyle = cfg.ground;
      ctx.fillRect(0, groundTop, width, height - groundTop);

      const groundSpeed = layerSpeed('ground');
      const veinSpacing = 96;
      const veinPhase = wrapPhase(scrollPx, groundSpeed, veinSpacing);
      for (let sx = tileScanStart(veinPhase, veinSpacing); sx < width + veinSpacing; sx += veinSpacing) {
        if (sx < -16 || sx > width + 16) continue;
        const worldIdx = worldIndexAt(sx, scrollPx, groundSpeed, veinSpacing);
        const h = (worldIdx * 17 + seedNum * 13) % 101;
        if (h > 45) continue;
        const off = ((worldIdx * 5 + seedNum * 3) % 15) - 7;
        const vx = Math.round(sx + off);
        const vy = groundTop + 2 + (h % 6) * 5;
        ctx.fillStyle = cfg.groundVein;
        ctx.fillRect(vx, vy, 6 + (h % 4), 3);
        ctx.fillStyle = cfg.lava;
        ctx.fillRect(vx + 1, vy + 1, 3, 2);
      }

      // ── Rising embers (foreground particles) ──
      const emberSpeed = layerSpeed('ember');
      const emberSpacing = 44;
      const emberPhase = wrapPhase(scrollPx, emberSpeed, emberSpacing);
      for (let sx = tileScanStart(emberPhase, emberSpacing); sx < width + emberSpacing; sx += emberSpacing) {
        if (sx < -16 || sx > width + 16) continue;
        const worldIdx = worldIndexAt(sx, scrollPx, emberSpeed, emberSpacing);
        const h = (worldIdx * 19 + seedNum * 17) % 101;
        if (h > 50) continue;
        const off = ((worldIdx * 7 + seedNum * 5) % 21) - 10;
        const rise = ((worldIdx * 13 + seedNum * 3) % 40) / 40;
        const ex = Math.round(sx + off);
        const ey = Math.round(groundTop - 6 - rise * (groundTop * 0.55));
        const colorIdx = h % cfg.embers.length;
        ctx.fillStyle = cfg.embers[colorIdx];
        ctx.fillRect(ex, ey, 2, 2);
        ctx.fillStyle = 'rgba(255, 170, 80, 0.35)';
        ctx.fillRect(ex - 1, ey - 1, 4, 4);
      }

      // ── Lava shimmer texture on the ground ──
      const shimmerPhase = wrapPhase(scrollPx, lavaSpeed, 48);
      for (let sx = tileScanStart(shimmerPhase, 48); sx < width + 48; sx += 8) {
        if (sx < 0 || sx > width) continue;
        const worldX = sx + scrollPx * lavaSpeed;
        if (Math.sin(worldX * PI2 / 48 + seedNum) > 0.55) {
          ctx.fillStyle = 'rgba(255, 120, 40, 0.25)';
          ctx.fillRect(Math.round(sx), groundTop + 4, 6, 3);
        }
      }
    };

    const dpr = window.devicePixelRatio || 1;
    if (typeof ctx.setTransform !== 'function') {
      return;
    }

    // Handle background tab — pause rAF when hidden, resume when visible
    const onVisibility = () => {
      bgPausedRef.current = document.visibilityState === 'hidden';
      if (document.visibilityState === 'visible') {
        lastTimeRef.current = performance.now();
        animationStartTime.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    let rafId: number;

    const render = (now: number) => {
      if (bgPausedRef.current) {
        rafId = requestAnimationFrame(render);
        return;
      }
      rafId = requestAnimationFrame(render);

      if (animationStartTime.current === null) {
        animationStartTime.current = now;
      }

      const elapsedSinceStable = now - animationStartTime.current;

      const rampUpFactor = Math.min(1, elapsedSinceStable / 800);
      const effectiveScrollSpeed = 24 * rampUpFactor;

      if (animatedRef.current) {
        const dt = lastTimeRef.current ? Math.min((now - lastTimeRef.current) / 1000, 0.05) : 0;
        scrollOffsetRef.current += dt * effectiveScrollSpeed;
      }

      lastTimeRef.current = now;
      drawFrame(scrollOffsetRef.current);
    };

    lastTimeRef.current = performance.now();
    animationStartTime.current = performance.now();
    scrollOffsetRef.current = 0;
    rafId = requestAnimationFrame(render);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(rafId);
    };
  }, [width, height, seedNum, isMobile, groundTop, cfg]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 1,
        willChange: 'transform',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};
