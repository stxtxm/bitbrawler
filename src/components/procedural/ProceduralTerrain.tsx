import { useEffect, useState, useMemo, useRef } from 'react';
import { DAY_PALETTE, NIGHT_PALETTE } from '../../utils/ColorPalette';
import { useTerrainNoiseMaps } from '../../hooks/useTerrainNoise';
import { useResponsiveCanvas, useTerrainAnimation } from '../../hooks/useTerrainAnimation';
import {
  SCROLL_CONFIG,
  DEPTH_CONFIG,
  getQualitySettings,
  shouldEnable3d,
} from '../../config/terrainConfig';
import { getBiomeColor } from '../../generation/BiomeGenerator';

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
 * 4-layer parallax with organic shapes, biome-aware coloring, smooth scrolling
 */
export const ProceduralTerrain: React.FC<ProceduralTerrainProps> = ({
  width: propWidth,
  height: propHeight,
  parallaxLayers: propLayers,
  seed,
  isNight = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canvasSize = useResponsiveCanvas(containerRef, canvasRef);
  const width = canvasSize.width || propWidth || 1024;
  const height = canvasSize.height || propHeight || 512;

  const qualitySettings = useMemo(() => getQualitySettings(width), [width]);

  const layerCount = propLayers ?? qualitySettings.layers;
  const fps = qualitySettings.fps;
  const noiseResolution = qualitySettings.noiseResolution;
  const cellSize = qualitySettings.cellSize;
  const enable3d = shouldEnable3d(width);

  const palette = isNight ? NIGHT_PALETTE : DAY_PALETTE;

  const noiseMaps = useTerrainNoiseMaps(width, height, layerCount, seed, noiseResolution);

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

  // Draw organic ground with noise-driven elevation
  const drawGround = (
    ctx: CanvasRenderingContext2D,
    groundNoise: Uint8Array,
    groundOffset: number,
    noiseWidth: number,
  ) => {
    const yStart = Math.floor((height * 0.45) / cellSize);
    const yEnd = Math.floor(height / cellSize);

    for (let y = yStart; y < yEnd; y++) {
      const rowAlpha = Math.min(1, (y - yStart) / 4); // Fade in at top edge

      for (let nx = 0; nx < noiseWidth; nx++) {
        const noiseIdx = y * noiseWidth + nx;
        if (noiseIdx >= groundNoise.length) continue;
        const noiseVal = groundNoise[noiseIdx];

        // Smooth density: higher noise = more solid, lower = transparent
        const density = (noiseVal - 100) / 155; // Maps 100->0, 255->1
        if (density <= 0) continue;

        const cellAlpha = Math.min(1, density * rowAlpha);
        const screenX = ((nx * cellSize * noiseResolution - groundOffset + SCROLL_CONFIG.SCROLL_WRAP_DISTANCE * 2) %
          (SCROLL_CONFIG.SCROLL_WRAP_DISTANCE * 2));
        const screenY = y * cellSize;

        if (screenX < -cellSize || screenX > width + cellSize) continue;

        const color = getBiomeColor(screenX + offset, screenY, seedNum, 'grass', offset);

        ctx.globalAlpha = cellAlpha;
        ctx.fillStyle = color;

        // Draw rounded cell for organic look
        const radius = cellSize * 0.4;
        ctx.beginPath();
        ctx.roundRect(screenX, screenY, cellSize, cellSize, radius);
        ctx.fill();

        // Subtle depth shadow
        if (enable3d && DEPTH_CONFIG.SHADOWS_ENABLED && y % 4 === 0 && density > 0.5) {
          ctx.globalAlpha = 0.08 * cellAlpha;
          ctx.fillStyle = '#000';
          ctx.fillRect(screenX, screenY + cellSize - 1, cellSize, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  // Draw foliage/trees as organic shapes
  const drawFoliage = (
    ctx: CanvasRenderingContext2D,
    treeNoise: Uint8Array,
    treeOffset: number,
    noiseWidth: number,
  ) => {
    const yStart = Math.floor((height * 0.28) / cellSize);
    const yEnd = Math.floor((height * 0.48) / cellSize);

    for (let y = yStart; y < yEnd; y++) {
      for (let nx = 0; nx < noiseWidth; nx++) {
        const noiseIdx = y * noiseWidth + nx;
        if (noiseIdx >= treeNoise.length) continue;
        const noiseVal = treeNoise[noiseIdx];

        // Smooth density for foliage
        const density = (noiseVal - 140) / 115; // 140->0, 255->1
        if (density <= 0) continue;

        const screenX = ((nx * cellSize * noiseResolution - treeOffset + SCROLL_CONFIG.SCROLL_WRAP_DISTANCE * 2) %
          (SCROLL_CONFIG.SCROLL_WRAP_DISTANCE * 2));
        const screenY = y * cellSize;

        if (screenX < -cellSize * 2 || screenX > width + cellSize * 2) continue;

        const color = getBiomeColor(screenX + offset, screenY, seedNum, 'grass', offset);

        ctx.globalAlpha = Math.min(0.85, density * 0.9);
        ctx.fillStyle = color;

        // Draw organic blob instead of square
        const s = cellSize * (0.6 + density * 0.5);
        ctx.beginPath();
        ctx.arc(screenX + cellSize / 2, screenY + cellSize / 2, s / 2, 0, Math.PI * 2);
        ctx.fill();

        // Highlight on top
        if (enable3d && DEPTH_CONFIG.GLOW_ENABLED && density > 0.6) {
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(screenX + cellSize / 2 - 1, screenY + cellSize / 2 - 1, s / 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  // Main render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // ── SKY ────────────────────────────────────────────
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.5);
    if (isNight) {
      skyGradient.addColorStop(0, '#0a0a1a');
      skyGradient.addColorStop(0.5, '#0f0c29');
      skyGradient.addColorStop(1, '#1a1a3e');
    } else {
      skyGradient.addColorStop(0, '#4a90d9');
      skyGradient.addColorStop(0.4, '#87ceeb');
      skyGradient.addColorStop(1, '#c8e6f5');
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.5);

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

    // ── FOLIAGE / TREES (0.5x) ────────────────────────
    const treeSpeed = SCROLL_CONFIG.LAYER_MULTIPLIERS.trees;
    const treeOffset = (offset * treeSpeed) % (SCROLL_CONFIG.SCROLL_WRAP_DISTANCE * 2);
    const treeNoiseIndex = Math.min(1, layerCount - 1);

    if (layerCount > 1 && noiseMaps[treeNoiseIndex]) {
      const treeNoise = noiseMaps[treeNoiseIndex];
      const noiseWidth = Math.floor((width / noiseResolution) / 4);
      drawFoliage(ctx, treeNoise, treeOffset, noiseWidth);
    }

    // ── GROUND (1.0x) ─────────────────────────────────
    const groundSpeed = SCROLL_CONFIG.LAYER_MULTIPLIERS.ground;
    const groundOffset = (offset * groundSpeed) % (SCROLL_CONFIG.SCROLL_WRAP_DISTANCE * 2);
    const groundNoiseIndex = Math.min(layerCount - 1, 2);

    if (noiseMaps[groundNoiseIndex]) {
      const groundNoise = noiseMaps[groundNoiseIndex];
      const noiseWidth = Math.floor((width / noiseResolution) / 4);
      drawGround(ctx, groundNoise, groundOffset, noiseWidth);
    }

    // ── DECORATIONS (1.2x) ────────────────────────────
    if (layerCount > 2) {
      const accentOffset = (offset * SCROLL_CONFIG.LAYER_MULTIPLIERS.decorations) % (SCROLL_CONFIG.SCROLL_WRAP_DISTANCE * 2);

      for (let x = 0; x < width; x += 80) {
        const screenX = ((x - accentOffset + SCROLL_CONFIG.SCROLL_WRAP_DISTANCE * 2) %
          (SCROLL_CONFIG.SCROLL_WRAP_DISTANCE * 2));
        const accentColor = getBiomeColor(x + offset, height * 0.47, seedNum, 'accent', offset);

        // Small organic decoration dots
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(screenX, height * 0.46, 2 + Math.sin(x * 0.1 + seedNum) * 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }, [width, height, offset, palette, noiseMaps, seedNum, layerCount, enable3d, isNight]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
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
