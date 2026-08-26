import { useEffect, useMemo, useRef } from 'react';
import { useResponsiveCanvas } from '../../hooks/useTerrainAnimation';
import {
  wrapPhase,
  tileScanStart,
  worldIndexAt,
  drawVolcano,
  plumeOpacity,
  eruptionDx,
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

      // ── Retro Pixel Sun (Multi-layered glowing celestial body) ──
      const sunPhase = wrapPhase(scrollPx, 0.05, width);
      const sunX = Math.round(width * 0.68 - sunPhase);
      const sunY = Math.round(groundTop - height * 0.24);

      // Layer 1: Outer glow ring (36x36 with corners clipped)
      ctx.fillStyle = 'rgba(255, 138, 42, 0.35)';
      ctx.fillRect(sunX - 18, sunY - 14, 36, 28);
      ctx.fillRect(sunX - 14, sunY - 18, 28, 36);

      // Layer 2: Middle glow ring (28x28 with corners clipped)
      ctx.fillStyle = '#ff8a2a';
      ctx.fillRect(sunX - 14, sunY - 10, 28, 20);
      ctx.fillRect(sunX - 10, sunY - 14, 20, 28);

      // Layer 3: Solid Sun Core (20x20 with corners clipped)
      ctx.fillStyle = '#ffd060';
      ctx.fillRect(sunX - 10, sunY - 8, 20, 16);
      ctx.fillRect(sunX - 8, sunY - 10, 16, 20);

      // Layer 4: Brightest center (12x12)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sunX - 6, sunY - 6, 12, 12);

      // ── Billowing Volcanic Dark Smoke Clouds (slow parallax) ──
      const cloudSpeed = 0.12;
      const cloudSpacing = 320;
      const cloudPhase = wrapPhase(scrollPx, cloudSpeed, cloudSpacing);
      for (let sx = tileScanStart(cloudPhase, cloudSpacing); sx < width + cloudSpacing; sx += cloudSpacing) {
        if (sx < -160 || sx > width + 160) continue;
        const worldIdx = worldIndexAt(sx, scrollPx, cloudSpeed, cloudSpacing);
        const h = (worldIdx * 19 + seedNum * 13) % 101;
        if (h > 45) continue; // 45% chance to render a cloud block

        const cy = Math.round(height * 0.12 + (h % 5) * 8);
        const cx = Math.round(sx + ((h % 11) - 5) * 4);

        // Render a retro billowing pixel cloud composed of intersecting circles/caps
        // Dark ash grey base, with orange lava-reflected highlights at the bottom.
        ctx.fillStyle = 'rgba(42, 22, 24, 0.85)'; // Charred, dark smoke color
        ctx.fillRect(cx - 30, cy, 60, 18);
        ctx.fillRect(cx - 20, cy - 8, 40, 26);
        ctx.fillRect(cx - 8, cy - 14, 22, 32);

        // Volcanic orange highlights on the cloud bellies/rims
        ctx.fillStyle = '#ff5a1a';
        ctx.fillRect(cx - 24, cy + 12, 48, 4);
        ctx.fillRect(cx - 14, cy + 16, 28, 3);
        ctx.fillStyle = '#ff8a2a';
        ctx.fillRect(cx - 8, cy + 12, 16, 2);
      }

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
        drawVolcano(ctx, vx, groundTop, vw, vh, cfg.volcanoNear, cfg.crater, cfg.lava, scrollPx);
        // Lava pool glow at the base
        ctx.fillStyle = cfg.lavaBright;
        ctx.fillRect(vx - 14, groundTop - 2, 28, 4);
        ctx.fillStyle = cfg.lava;
        ctx.fillRect(vx - 10, groundTop + 2, 20, 3);

        // ── Volcano Active Craters: Erupting Sparks & Falling Lava Geysers ──
        const craterY = Math.round(groundTop - vh);
        const craterCenter = vx;

          // Erupting sparks: parabolic arcs using deterministic physics driven by scrollPx
          const sparkCount = 4 + (worldIdx % 3);
          for (let s = 0; s < sparkCount; s++) {
            const sparkSeed = worldIdx * 17 + s * 31 + seedNum;
            const cycleDuration = 48; // tick length for a full jump
            const progressTick = (scrollPx * 0.45 + sparkSeed * 7) % cycleDuration;
            const t = progressTick / cycleDuration; // 0.0 to 1.0

            // Parabolic trajectory
            const velocityX = ((sparkSeed % 23) - 11) * 1.4; // horizontal direction & speed
            const launchVelocityY = -35 - (sparkSeed % 13) * 1.5; // initial boost upward
            const gravity = 80; // gravity force pulls downward

            // dx is velocity × TIME (t), never velocity × raw tick —
            // the old formula flung sparks up to ±740px across the screen.
            const dx = eruptionDx(velocityX, t);
            const dy = launchVelocityY * t + 0.5 * gravity * t * t;

          const sparkX = Math.round(craterCenter + dx);
          const sparkY = Math.round(craterY + dy);

          // Only draw if spark hasn't fallen below ground top
          if (sparkY < groundTop) {
            ctx.fillStyle = s % 2 === 0 ? cfg.lavaBright : cfg.lava;
            ctx.fillRect(sparkX, sparkY, 3, 3);
            ctx.fillStyle = 'rgba(255, 110, 40, 0.45)';
            ctx.fillRect(sparkX - 1, sparkY - 1, 5, 5);
          }
        }

        // ── Volcanic Smoke/Ash Columns: Expanding swaying plumes from crater ──
        const plumeCount = 3;
        for (let p = 0; p < plumeCount; p++) {
          const plumeSeed = worldIdx * 13 + p * 19 + seedNum;
          const plumeScroll = (scrollPx * 0.2 + plumeSeed * 11) % 64;
          const t = plumeScroll / 64; // 0.0 to 1.0 rising factor

          const plumeY = Math.round(craterY - t * (height * 0.35));
          const sway = Math.sin(scrollPx * 0.03 + plumeSeed) * 12 * t;
          const plumeX = Math.round(craterCenter + sway);
          const size = Math.round(10 + t * 20); // expands as it rises

          // Draw pixelated cloud circles — opacity follows a sin(π·t)
          // envelope: fade in at the crater, fade out at the apex, so the
          // cycle restart is invisible (no blinking).
          ctx.fillStyle = 'rgba(64, 46, 44, ' + plumeOpacity(t, 0.55).toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(plumeX, plumeY, size / 2, 0, Math.PI * 2);
          ctx.arc(plumeX - size / 4, plumeY + size / 6, size / 3, 0, Math.PI * 2);
          ctx.arc(plumeX + size / 4, plumeY + size / 6, size / 3, 0, Math.PI * 2);
          ctx.fill();

          // Internal warm magma glow inside the plume near the crater mouth
          if (t < 0.4) {
            ctx.fillStyle = 'rgba(255, 90, 26, ' + (0.45 * (1 - t / 0.4) * (t / 0.4)).toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(plumeX, plumeY + 2, (size / 3) * (1 - t / 0.4), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ── Basalt ground with lava veins ──
      ctx.fillStyle = cfg.ground;
      ctx.fillRect(0, groundTop, width, height - groundTop);

      const groundSpeed = layerSpeed('ground');

      // ── Molten Lava Pools on the Basalt Floor (Scrolling with scrolling floor) ──
      const poolSpacing = 160;
      const poolPhase = wrapPhase(scrollPx, groundSpeed, poolSpacing);
      for (let sx = tileScanStart(poolPhase, poolSpacing); sx < width + poolSpacing; sx += poolSpacing) {
        if (sx < -60 || sx > width + 60) continue;
        const worldIdx = worldIndexAt(sx, scrollPx, groundSpeed, poolSpacing);
        const h = (worldIdx * 29 + seedNum * 7) % 101;
        if (h > 35) continue; // 35% chance to draw a ground lava puddle

        const px = Math.round(sx + ((h % 13) - 6) * 2);
        const py = Math.round(groundTop + 4 + (h % 5) * 4);
        const poolW = 28 + (h % 7) * 4;
        const poolH = 6 + (h % 3) * 2;

        // Lava puddle shadow/edge
        ctx.fillStyle = '#2e1208';
        ctx.fillRect(px - 2, py - 1, poolW + 4, poolH + 2);
        // Lava pool base
        ctx.fillStyle = cfg.lava;
        ctx.fillRect(px, py, poolW, poolH);
        // Molten bright highlight core
        ctx.fillStyle = cfg.lavaBright;
        const hiliteOffset = Math.floor((scrollPx * 0.1) % (poolW - 8));
        ctx.fillRect(px + 4 + (hiliteOffset % (poolW - 8)), py + 2, Math.max(4, poolW / 4), poolH - 4);
      }

      // ── Glowing lava veins inside the ground basalt slabs ──
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

      // ── Charred Basalt Ground Stones (Multi-layered random details for polish/depth) ──
      for (let layer = 0; layer < 3; layer++) {
        const stoneSpacing = 72 + layer * 24;
        const parallaxSpeed = groundSpeed * (0.85 + layer * 0.08);
        const phase = wrapPhase(scrollPx, parallaxSpeed, stoneSpacing);
        const baseY = groundTop + 3 + layer * 6;
        const maxStoneSize = 6 - layer;

        for (let sx = tileScanStart(phase, stoneSpacing); sx < width + stoneSpacing; sx += stoneSpacing) {
          if (sx < -16 || sx > width + 16) continue;
          const worldIdx = worldIndexAt(sx, scrollPx, parallaxSpeed, stoneSpacing);
          const r = (worldIdx * 31 + seedNum * (5 + layer * 11)) % 101;
          if (r > 40) continue; // 40% density of dark polished volcanic stones

          const size = Math.round(3 + (r % maxStoneSize));
          const stoneW = size + (r % 3);
          const stoneH = Math.max(2, size - 1);
          const stoneX = Math.round(sx + ((r % 17) - 8));

          // Draw dark charcoal basalt stone with light specular highlight
          ctx.fillStyle = 'rgba(18, 8, 10, 0.6)'; // Drop shadow
          ctx.fillRect(stoneX + 1, baseY + 1, stoneW, stoneH);
          ctx.fillStyle = '#1c0c12'; // Base dark body
          ctx.fillRect(stoneX, baseY, stoneW, stoneH);
          ctx.fillStyle = '#4a2014'; // Subtle highlight edge
          ctx.fillRect(stoneX, baseY, Math.max(1, stoneW - 2), 1);
        }
      }

      // ── Rising embers (foreground particles with heat swaying & size variations) ──
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

        // Horizontal swaying from hot wind currents
        const swayFreq = 0.04 + (h % 3) * 0.02;
        const swayAmp = 6 + (h % 5) * 3;
        const sway = Math.sin(scrollPx * swayFreq + worldIdx) * swayAmp;

        const ex = Math.round(sx + off + sway);
        const ey = Math.round(groundTop - 6 - rise * (groundTop * 0.65));
        const colorIdx = h % cfg.embers.length;

        // Randomize ember size for perspective depth (1px, 2px, or 3px)
        const emberSize = 1 + (h % 3);

        ctx.fillStyle = cfg.embers[colorIdx];
        ctx.fillRect(ex, ey, emberSize, emberSize);
        ctx.fillStyle = 'rgba(255, 170, 80, 0.25)';
        ctx.fillRect(ex - 1, ey - 1, emberSize + 2, emberSize + 2);
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
        // Reset timers and ramp-up so the scrolling animation resumes cleanly
        // after returning from background (otherwise first dt is huge or
        // animationStartTime is stale and terrain appears frozen).
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
