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
 * Professional Procedural Terrain Renderer
 * - Fixed scroll speed (coherent across layers)
 * - Infinite scroll (no duplication)
 * - Biome system (smooth transitions)
 * - 4-layer parallax (depth perception)
 * - Mobile-optimized (FPS control, quality scaling)
 * - 3D effects (shadows, glow, depth)
 * - Responsive (ResizeObserver for canvas sizing)
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

  // Responsive sizing
  const canvasSize = useResponsiveCanvas(containerRef, canvasRef);
  const width = canvasSize.width || propWidth || 1024;
  const height = canvasSize.height || propHeight || 512;

  // Quality settings based on viewport
  const qualitySettings = useMemo(() => {
    return getQualitySettings(width);
  }, [width]);

  const layerCount = propLayers ?? qualitySettings.layers;
  const fps = qualitySettings.fps;
  const noiseResolution = qualitySettings.noiseResolution;
  const cellSize = qualitySettings.cellSize;
  const enable3d = shouldEnable3d(width);

  // Palette based on day/night
  const palette = isNight ? NIGHT_PALETTE : DAY_PALETTE;

  // Cache noise maps (only regenerate on seed/size change)
  const noiseMaps = useTerrainNoiseMaps(
    width,
    height,
    layerCount,
    seed,
    noiseResolution,
  );

  // Seed as number
  const seedNum = useMemo(
    () => parseInt(seed.replace(/\D/g, '') || '0', 10),
    [seed],
  );

  // Animation state
  const [offset, setOffset] = useState(0);

  // Smooth scroll animation with FPS control
  useTerrainAnimation(
    fps,
    SCROLL_CONFIG.BASE_SPEED,
    (newOffset) => setOffset(newOffset),
    true,
  );

  // Rendering effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI scaling already handled in useResponsiveCanvas
    ctx.clearRect(0, 0, width, height);

    // ========================================================================
    // LAYER 0: SKY BACKGROUND (Non-scrolling)
    // ========================================================================
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.4);
    const skyColor1 = isNight ? '#0f0c29' : '#87ceeb';
    const skyColor2 = isNight ? '#1a1a2e' : '#e0f6ff';
    skyGradient.addColorStop(0, skyColor1);
    skyGradient.addColorStop(1, skyColor2);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.4);

    // ========================================================================
    // LAYER 1: MOUNTAINS (Parallax speed 0.3x)
    // ========================================================================
    const mountainSpeed = SCROLL_CONFIG.LAYER_MULTIPLIERS.mountains;
    const mountainOffset = (offset * mountainSpeed) % SCROLL_CONFIG.SCROLL_WRAP_DISTANCE;

    ctx.fillStyle = palette.mountain;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.35);

    const mountainPeaks = 12;
    for (let i = 0; i <= mountainPeaks; i++) {
      // Fixed calculation: simple modulo for smooth infinite scroll
      const x =
        ((width / mountainPeaks) * i -
          (mountainOffset % width) +
          width) %
        width;
      const y = height * (0.3 + Math.sin(i * 0.5 + seedNum) * 0.15);
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Mountain shadow for 3D effect
    if (enable3d && DEPTH_CONFIG.SHADOWS_ENABLED) {
      ctx.fillStyle = `rgba(0, 0, 0, ${DEPTH_CONFIG.SHADOW_OPACITY})`;
      ctx.fillRect(0, height * 0.35, width, 8);
    }

    // ========================================================================
    // LAYER 2: TREES/FOLIAGE (Parallax speed 0.5x)
    // ========================================================================
    const treeSpeed = SCROLL_CONFIG.LAYER_MULTIPLIERS.trees;
    const treeOffset = (offset * treeSpeed) % SCROLL_CONFIG.SCROLL_WRAP_DISTANCE;

    const treeNoiseIndex = Math.min(1, layerCount - 1);
    if (layerCount > 1 && noiseMaps[treeNoiseIndex]) {
      const treeNoise = noiseMaps[treeNoiseIndex];
      ctx.fillStyle = palette.dirt; // Tree color

      const noiseWidth = Math.floor((width / noiseResolution) / 4);

      for (let y = Math.floor((height * 0.25) / cellSize); y < Math.floor((height * 0.4) / cellSize); y++) {
        for (let x = 0; x < noiseWidth; x++) {
          const noiseVal = treeNoise[y * noiseWidth + x];

          if (noiseVal > 180) {
            // Render trees
            const canvasX =
              ((x * cellSize - treeOffset + SCROLL_CONFIG.SCROLL_WRAP_DISTANCE) %
                SCROLL_CONFIG.SCROLL_WRAP_DISTANCE) %
              width;
            const canvasY = y * cellSize;

            ctx.fillRect(canvasX, canvasY, cellSize, cellSize);

            // Tree highlights for 3D
            if (enable3d && DEPTH_CONFIG.GLOW_ENABLED) {
              ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
              ctx.fillRect(canvasX, canvasY, cellSize / 2, cellSize / 2);
              ctx.fillStyle = palette.dirt;
            }
          }
        }
      }
    }

    // ========================================================================
    // LAYER 3: GROUND (Normal speed 1x) - Biome-aware
    // ========================================================================
    const groundSpeed = SCROLL_CONFIG.LAYER_MULTIPLIERS.ground;
    const groundOffset = (offset * groundSpeed) % SCROLL_CONFIG.SCROLL_WRAP_DISTANCE;

    const groundNoiseIndex = Math.min(layerCount - 1, 2);
    if (noiseMaps[groundNoiseIndex]) {
      const groundNoise = noiseMaps[groundNoiseIndex];
      const noiseWidth = Math.floor((width / noiseResolution) / 4);

      for (let y = Math.floor((height * 0.4) / cellSize); y < Math.floor(height / cellSize); y++) {
        for (let x = 0; x < noiseWidth; x++) {
          const noiseVal = groundNoise[y * noiseWidth + x];

          if (noiseVal > 160) {
            // Biome-aware coloring with smooth transitions
            const canvasX =
              ((x * cellSize - groundOffset + SCROLL_CONFIG.SCROLL_WRAP_DISTANCE) %
                SCROLL_CONFIG.SCROLL_WRAP_DISTANCE) %
              width;
            const canvasY = y * cellSize;

            // Get biome color at this position
            const color = getBiomeColor(
              canvasX + offset,
              canvasY,
              seedNum,
              'grass',
              offset,
            );

            ctx.fillStyle = color;
            ctx.fillRect(canvasX, canvasY, cellSize, cellSize);

            // Depth shadow
            if (enable3d && DEPTH_CONFIG.SHADOWS_ENABLED && y % 3 === 0) {
              ctx.fillStyle = `rgba(0, 0, 0, 0.1)`;
              ctx.fillRect(canvasX, canvasY + cellSize - 1, cellSize, 1);
            }
          }
        }
      }
    }

    // ========================================================================
    // DECORATIONS/ACCENTS (Speed 1.2x - faster parallax)
    // ========================================================================
    if (layerCount > 2) {
      const accentSpeed = SCROLL_CONFIG.LAYER_MULTIPLIERS.decorations;
      const accentOffset =
        (offset * accentSpeed) % SCROLL_CONFIG.SCROLL_WRAP_DISTANCE;

      for (let x = 0; x < width; x += 60) {
        const screenX = (x - accentOffset + SCROLL_CONFIG.SCROLL_WRAP_DISTANCE) %
          SCROLL_CONFIG.SCROLL_WRAP_DISTANCE;
        const accentColor = getBiomeColor(x, height * 0.45, seedNum, 'accent');

        ctx.fillStyle = accentColor;
        ctx.fillRect(screenX, height * 0.42, 8, 12);
      }
    }
  }, [width, height, offset, palette, noiseMaps, seedNum, layerCount, enable3d]);

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
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};
