import { useEffect, useMemo, useRef, useState } from 'react';
import { DAY_PALETTE, NIGHT_PALETTE } from '../../utils/ColorPalette';
import { useResponsiveCanvas, useTerrainAnimation } from '../../hooks/useTerrainAnimation';
import {
  SCROLL_CONFIG,
  DEPTH_CONFIG,
  getQualitySettings,
  shouldEnable3d,
} from '../../config/terrainConfig';

interface ProceduralTerrainProps {
  width?: number;
  height?: number;
  parallaxLayers?: number;
  mobileQuality?: boolean;
  seed: string;
  isNight?: boolean;
}

/**
 * Procedural Terrain Renderer
 * Parallax pixel-art terrain with sky, mountains, and scrolling grass ground
 */
export const ProceduralTerrain: React.FC<ProceduralTerrainProps> = ({
  width: propWidth,
  height: propHeight,
  seed,
  isNight = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canvasSize = useResponsiveCanvas(containerRef, canvasRef);
  const width = canvasSize.width || propWidth || 1024;
  const height = canvasSize.height || propHeight || 512;

  const qualitySettings = useMemo(() => getQualitySettings(width), [width]);
  const fps = qualitySettings.fps;
  const enable3d = shouldEnable3d(width);

  const palette = isNight ? NIGHT_PALETTE : DAY_PALETTE;

  const seedNum = useMemo(
    () => parseInt(seed.replace(/\D/g, '') || '0', 10),
    [seed],
  );

  const [offset, setOffset] = useState(0);

  useTerrainAnimation(fps, SCROLL_CONFIG.BASE_SPEED, (newOffset) => setOffset(newOffset), true);

  // Draw a smooth mountain ridge using quadratic curves
  const drawMountainRidge = (
    ctx: CanvasRenderingContext2D,
    offsetPx: number,
    baseY: number,
    amplitude: number,
    color: string,
    peaks: number,
    seedModifier: number,
  ) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);

    const segmentWidth = width / peaks;
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i <= peaks + 2; i++) {
      const x = (i * segmentWidth - (offsetPx % width) + width * 2) % (width * 2) - segmentWidth;
      const noise = Math.sin(i * 0.7 + seedModifier) * 0.5 + 0.5;
      const y = baseY - noise * amplitude;
      points.push({ x, y });
    }

    ctx.moveTo(points[0].x, height);
    ctx.lineTo(points[0].x, points[0].y);

    // Smooth curves between peaks
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.7, prev.y, cpX, (prev.y + curr.y) / 2);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.lineTo(last.x, height);
    ctx.closePath();
    ctx.fill();
  };

  // Draw pixel-art ground with scrolling grass
  const drawPixelGround = (
    ctx: CanvasRenderingContext2D,
    groundOffset: number,
  ) => {
    const groundTop = height * 0.60;

    // ── 1. Solid dirt base ──
    ctx.fillStyle = isNight ? '#1a1410' : '#6b5340';
    ctx.fillRect(0, groundTop, width, height - groundTop);

    // ── 2. Pixel grass strip (parallax scrolling) ──
    const grassScroll = (groundOffset * 0.8) % 32;
    const grassTop = groundTop - 5;

    // Solid green strip
    ctx.fillStyle = isNight ? '#1a3a1a' : '#4a8a3a';
    ctx.fillRect(0, grassTop, width, 8);

    // Pixel grass blades
    const bladeColors = isNight
      ? ['#0f2a0f', '#1a3a1a', '#2a4a2a']
      : ['#3a7a2a', '#4a8a3a', '#5a9a4a'];

    for (let x = -16; x <= width + 16; x += 4) {
      const sx = ((x - grassScroll + width + 32) % (width + 32)) - 16;
      if (sx < -4 || sx > width) continue;

      const bladePhase = Math.sin((x + seedNum) * 0.3) * 0.5 + 0.5;
      const bladeH = 3 + Math.floor(bladePhase * 5);
      const colorIdx = Math.floor((Math.sin((x + seedNum) * 0.15) * 0.5 + 0.5) * 3) % 3;

      ctx.fillStyle = bladeColors[colorIdx];
      ctx.fillRect(sx, grassTop - bladeH, 3, bladeH);
    }

    // ── 3. Ground surface texture ──
    for (let x = 0; x < width; x += 6) {
      const texSeed = Math.sin(x * 0.17 + seedNum * 0.3) * 0.5 + 0.5;
      if (texSeed > 0.65) {
        ctx.fillStyle = isNight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.07)';
        ctx.fillRect(x, groundTop + 2, 5, 3);
      }
    }

    // ── 4. Small pixel bushes ──
    const bushScroll = (groundOffset * 0.5) % 96;
    for (let i = 0; i < 8; i++) {
      const bx = ((i * 96 + (seedNum % 47) - bushScroll + width + 192) % (width + 192)) - 96;
      if (bx < -12 || bx > width + 12) continue;

      const bushColor = isNight ? '#0f2f0f' : '#4a7a3a';
      const bushDark = isNight ? '#0a1f0a' : '#3a6a2a';

      ctx.fillStyle = bushColor;
      ctx.fillRect(bx, grassTop - 7, 6, 4);
      ctx.fillRect(bx + 1, grassTop - 10, 4, 3);

      ctx.fillStyle = bushDark;
      ctx.fillRect(bx, grassTop - 4, 2, 2);
    }
  };

  // Main render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // ── SKY (fill entire canvas to prevent transparent gaps) ──
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isNight) {
      skyGradient.addColorStop(0, '#0a0a1a');
      skyGradient.addColorStop(0.3, '#0f0c29');
      skyGradient.addColorStop(0.6, '#1a1a3e');
      skyGradient.addColorStop(1, '#0d0d1a');
    } else {
      skyGradient.addColorStop(0, '#4a90d9');
      skyGradient.addColorStop(0.3, '#87ceeb');
      skyGradient.addColorStop(0.6, '#c8e6f5');
      skyGradient.addColorStop(1, '#a0c8e8');
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height);

    // ── FAR MOUNTAINS (0.2x) ──────────────────────────
    const farMtnOffset = offset * 0.2;
    drawMountainRidge(
      ctx, farMtnOffset, height * 0.38, height * 0.18,
      isNight ? '#1a1a3a' : '#6a7a8a', 8, seedNum + 100,
    );

    // ── NEAR MOUNTAINS (0.3x) ─────────────────────────
    const nearMtnOffset = offset * SCROLL_CONFIG.LAYER_MULTIPLIERS.mountains;
    const mtnColor = isNight ? '#1a1a2e' : palette.mountain;
    drawMountainRidge(
      ctx, nearMtnOffset, height * 0.42, height * 0.15,
      mtnColor, 6, seedNum,
    );

    // Mountain shadow
    if (enable3d && DEPTH_CONFIG.SHADOWS_ENABLED) {
      ctx.fillStyle = `rgba(0, 0, 0, ${DEPTH_CONFIG.SHADOW_OPACITY * 0.5})`;
      ctx.fillRect(0, height * 0.42, width, 4);
    }

    // ── PIXEL GROUND (solid base + scrolling grass) ──
    const groundSpeed = SCROLL_CONFIG.LAYER_MULTIPLIERS.ground;
    const groundOffset = offset * groundSpeed;
    drawPixelGround(ctx, groundOffset);
  }, [width, height, offset, palette, seedNum, enable3d, isNight]);

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
        }}
      />
    </div>
  );
};
