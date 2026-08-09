import { useCallback, useMemo, useRef } from 'react';
import { useResponsiveCanvas } from '../../hooks/useTerrainAnimation';
import { useTerrainScrollLoop } from '../../hooks/useTerrainScrollLoop';
import {
  deterministicNoise,
  layerPhase,
  pixelRoundScroll,
  tileWorldIndex,
} from '../../utils/terrainScroll';
import { BIOMES, BiomeId } from '../../data/biomes';
import { ConeDef, TERRAIN_STYLES, TerrainStyle, VOLCANO_CONES } from '../../data/biomeTerrain';

interface BiomeTerrainProps {
  biomeId: BiomeId;
  seed: string;
  animated?: boolean;
  width?: number;
  height?: number;
}

type FrameContext = {
  ctx: CanvasRenderingContext2D;
  seedNum: number;
  scrollPx: number;
  width: number;
  height: number;
  horizon: number;
  style: TerrainStyle;
};

const drawMountain = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  widthPx: number,
  heightPx: number,
  color: string,
) => {
  ctx.fillStyle = color;
  for (let row = 0; row < heightPx; row++) {
    const half = Math.max(1, Math.round((widthPx / 2) * (1 - row / heightPx)));
    ctx.fillRect(cx - half, baseY - row - 1, half * 2, 1);
  }
};

const drawHillLayer = (
  f: FrameContext,
  parallax: number,
  spacing: number,
  color: string,
  heightFactor: number,
) => {
  const phase = layerPhase(f.scrollPx, parallax, spacing);
  for (let sx = -(phase + spacing); sx < f.width + spacing; sx += spacing) {
    if (sx < -spacing * 0.6 || sx > f.width + spacing * 0.4) continue;
    const worldIdx = tileWorldIndex(sx + f.scrollPx * parallax, spacing);
    const h = deterministicNoise(f.seedNum, worldIdx, 31, 7);
    const w = Math.round(spacing * (0.5 + (h % 3) * 0.08));
    const hgt = Math.round(f.height * heightFactor * (0.4 + (h % 5) * 0.14));
    drawMountain(f.ctx, Math.round(sx), f.horizon, w, hgt, color);
  }
};

const drawCone = (
  ctx: CanvasRenderingContext2D,
  cone: ConeDef,
  cx: number,
  baseY: number,
  px: number,
  palette: Record<number, string>,
) => {
  const rows = cone.pixels.length;
  const cols = cone.pixels[0].length;
  const half = cols >> 1;
  const topY = baseY - rows * px;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const v = cone.pixels[row][col];
      if (!v) continue;
      ctx.fillStyle = palette[v];
      ctx.fillRect(cx + (col - half) * px, topY + row * px, px, px);
    }
  }
};

const drawLavaTrickle = (
  ctx: CanvasRenderingContext2D,
  cone: ConeDef,
  cx: number,
  baseY: number,
  px: number,
  style: TerrainStyle,
  h: number,
) => {
  const rows = cone.pixels.length;
  const topY = baseY - rows * px;
  const startY = topY + px;
  const len = 3 + (h % 4);
  for (let i = 0; i < len; i++) {
    const jitter = ((h * (i + 3)) % 3) - 1;
    ctx.fillStyle = i % 2 === 0 ? style.lavaBright : style.lava;
    ctx.fillRect(cx + jitter, startY + i * 2, 2, 2);
  }
};

const drawConeLayer = (f: FrameContext, parallax: number, spacing: number) => {
  const phase = layerPhase(f.scrollPx, parallax, spacing);
  const palette: Record<number, string> = {
    1: f.style.coneLight,
    2: f.style.cone,
    3: f.style.lava,
    4: f.style.lavaBright,
  };
  for (let sx = -(phase + spacing); sx < f.width + spacing; sx += spacing) {
    if (sx < -300 || sx > f.width + 300) continue;
    const worldIdx = tileWorldIndex(sx + f.scrollPx * parallax, spacing);
    const h = deterministicNoise(f.seedNum, worldIdx, 41, 13);
    const cone = VOLCANO_CONES[h % VOLCANO_CONES.length];
    const px = 5 + (h % 3) * 2;
    const off = ((h % 11) - 5) * 4;
    const cx = Math.round(sx + off);
    drawCone(f.ctx, cone, cx, f.horizon, px, palette);
    if (h % 3 !== 2) {
      drawLavaTrickle(f.ctx, cone, cx, f.horizon, px, f.style, h);
    }
  }
};

const drawGround = (f: FrameContext, parallax: number, spacing: number) => {
  const phase = layerPhase(f.scrollPx, parallax, spacing);
  f.ctx.fillStyle = f.style.ground;
  f.ctx.fillRect(0, f.horizon, f.width, f.height - f.horizon);
  for (let sx = -(phase + spacing); sx < f.width + spacing; sx += spacing) {
    const worldIdx = tileWorldIndex(sx + f.scrollPx * parallax, spacing);
    const h = deterministicNoise(f.seedNum, worldIdx, 17, 5);
    const off = (h % 13) - 6;
    const slabW = 26 + (h % 18);
    const slabH = 3 + (h % 4);
    const sy = f.horizon + 2 + (h % 3) * 4;
    f.ctx.fillStyle = f.style.groundShade;
    f.ctx.fillRect(Math.round(sx + off), sy, slabW, slabH);
    f.ctx.fillStyle = f.style.crack;
    f.ctx.fillRect(Math.round(sx + off), sy, slabW, 1);
  }
};

const drawCracks = (f: FrameContext, parallax: number, spacing: number) => {
  const phase = layerPhase(f.scrollPx, parallax, spacing);
  for (let sx = -(phase + spacing); sx < f.width + spacing; sx += spacing) {
    const worldIdx = tileWorldIndex(sx + f.scrollPx * parallax, spacing);
    const h = deterministicNoise(f.seedNum, worldIdx, 23, 9);
    if (h > 60) continue;
    const cx = Math.round(sx + ((h % 19) - 9));
    const cy = f.horizon + 6 + (h % 5) * 3;
    const len = 6 + (h % 8);
    f.ctx.fillStyle = f.style.crack;
    f.ctx.fillRect(cx, cy, len, 2);
    f.ctx.fillRect(cx + 2, cy + 2, Math.max(1, len - 4), 1);
  }
};

const drawAsh = (f: FrameContext, parallax: number, spacing: number) => {
  const phase = layerPhase(f.scrollPx, parallax, spacing);
  for (let sx = -(phase + spacing); sx < f.width + spacing; sx += spacing) {
    const worldIdx = tileWorldIndex(sx + f.scrollPx * parallax, spacing);
    const h = deterministicNoise(f.seedNum, worldIdx, 11, 3);
    if (h > 38) continue;
    const cx = Math.round(sx);
    const cy = Math.round(f.height * (0.08 + ((h % 60) / 60) * 0.55));
    f.ctx.fillStyle = f.style.ash;
    f.ctx.fillRect(cx, cy, 2, 2);
  }
};

const drawEmbers = (f: FrameContext, parallax: number, spacing: number) => {
  const phase = layerPhase(f.scrollPx, parallax, spacing);
  for (let sx = -(phase + spacing); sx < f.width + spacing; sx += spacing) {
    const worldIdx = tileWorldIndex(sx + f.scrollPx * parallax, spacing);
    const h = deterministicNoise(f.seedNum, worldIdx, 29, 11);
    if (h > 55) continue;
    const cx = Math.round(sx + ((h % 9) - 4) * 2);
    const cy = f.horizon - 10 - (h % 30);
    f.ctx.fillStyle = f.style.ember[h % f.style.ember.length];
    f.ctx.fillRect(cx, cy, 2, 2);
    if (h % 3 === 0) {
      f.ctx.fillRect(cx + 1, cy - 2, 2, 2);
    }
  }
};

export const BiomeTerrain: React.FC<BiomeTerrainProps> = ({
  biomeId,
  seed,
  animated = true,
  width: propWidth,
  height: propHeight,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const styleRef = useRef<TerrainStyle>(TERRAIN_STYLES.plains);
  const seedNumRef = useRef(0);

  const canvasSize = useResponsiveCanvas(containerRef, canvasRef);
  const width = canvasSize.width || propWidth || 0;
  const height = canvasSize.height || propHeight || 0;

  const biomeDef = useMemo(() => BIOMES.find((biome) => biome.id === biomeId), [biomeId]);
  const effectiveSeed = biomeDef?.terrainSeed ?? seed;
  const seedNum = useMemo(
    () => parseInt(effectiveSeed.replace(/\D/g, '') || '0', 10),
    [effectiveSeed],
  );
  const style = TERRAIN_STYLES[biomeId] ?? TERRAIN_STYLES.plains;
  styleRef.current = style;
  seedNumRef.current = seedNum;

  const isMobile = width < 768;
  const groundTop = height * (isMobile ? 0.74 : 0.62);

  const drawFrame = useCallback(
    (groundScroll: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof ctx.setTransform !== 'function') return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const scrollPx = pixelRoundScroll(groundScroll);
      const s = styleRef.current;
      const frame: FrameContext = {
        ctx,
        seedNum: seedNumRef.current,
        scrollPx,
        width,
        height,
        horizon: Math.round(groundTop),
        style: s,
      };

      const sky = ctx.createLinearGradient(0, 0, 0, height);
      s.sky.forEach((stop, i) => sky.addColorStop(i / (s.sky.length - 1), stop));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const sunX = Math.round(width * 0.5);
      const sunY = Math.round(height * 0.16);
      const sunR = Math.round(height * 0.14);
      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2.5);
      glow.addColorStop(0, s.sun);
      glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      drawHillLayer(frame, 0.12, 260, s.far, 0.4);
      drawHillLayer(frame, 0.26, 220, s.mid, 0.62);
      drawConeLayer(frame, 0.5, 460);
      drawGround(frame, 1, 90);
      drawCracks(frame, 0.9, 140);
      drawAsh(frame, 0.75, 46);
      drawEmbers(frame, 0.85, 64);
    },
    [width, height, groundTop],
  );

  useTerrainScrollLoop({
    animated,
    onFrame: drawFrame,
    enabled: width > 0 && height > 0,
  });

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
