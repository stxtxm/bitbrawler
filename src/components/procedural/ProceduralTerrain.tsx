import { useEffect, useMemo, useRef } from 'react';
import { useResponsiveCanvas } from '../../hooks/useTerrainAnimation';

interface ProceduralTerrainProps {
  width?: number;
  height?: number;
  seed: string;
  animated?: boolean;
}

const PI2 = Math.PI * 2;

// ── CLOUDS ──
const CLOUD_SHAPES = [
  [[0,1,1,0],[1,1,2,1],[0,1,1,0]],
  [[1,1,0],[1,2,1],[0,1,0]],
  [[0,1,1,0],[1,1,1,1],[0,1,1,0]],
];

interface CloudDef {
  x: number;
  y: number;
  shape: number[][];
  width: number;
  speed: number;
}

// ── TREES (1=dark foliage, 2=light foliage, 3=trunk) ──
const TREE_PALETTES: Record<number, string>[] = [
  { 1: '#2d7a2a', 2: '#4a9a3a', 3: '#6b4a2a' },
  { 1: '#1d6a1a', 2: '#3a8a2a', 3: '#5a3a1a' },
  { 1: '#3a8a2a', 2: '#5aaa3a', 3: '#6b4a2a' },
  { 1: '#2a7a30', 2: '#4aaa40', 3: '#5a3a20' },
  { 1: '#1a6a20', 2: '#3a9a30', 3: '#6b4a2a' },
];

const TREES = [
  { // Round leafy
    pixels: [
      [0,0,0,1,1,0,0],
      [0,0,1,2,1,0,0],
      [0,1,2,2,2,1,0],
      [0,1,2,2,2,1,0],
      [0,0,1,2,1,0,0],
      [0,0,0,3,0,0,0],
      [0,0,0,3,0,0,0],
    ],
    paletteIdx: 0,
  },
  { // Pine
    pixels: [
      [0,0,0,1,0,0,0],
      [0,0,1,2,1,0,0],
      [0,1,2,2,2,1,0],
      [0,0,1,2,1,0,0],
      [0,0,0,1,0,0,0],
      [0,0,0,3,0,0,0],
      [0,0,0,3,0,0,0],
    ],
    paletteIdx: 1,
  },
  { // Sapling
    pixels: [
      [0,0,1,1,0,0],
      [0,1,2,2,1,0],
      [0,0,1,2,0,0],
      [0,0,0,3,0,0],
      [0,0,0,3,0,0],
    ],
    paletteIdx: 2,
  },
  { // Wide oak
    pixels: [
      [0,0,0,1,1,1,0,0,0],
      [0,0,1,2,2,2,1,0,0],
      [0,1,2,2,2,2,2,1,0],
      [0,1,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,1,0,0],
      [0,0,0,0,3,0,0,0,0],
      [0,0,0,0,3,0,0,0,0],
    ],
    paletteIdx: 3,
  },
  { // Tall multi-tier
    pixels: [
      [0,0,0,0,1,0,0,0,0],
      [0,0,0,1,2,1,0,0,0],
      [0,0,1,2,2,2,1,0,0],
      [0,0,0,1,2,1,0,0,0],
      [0,0,0,0,1,0,0,0,0],
      [0,0,0,0,3,0,0,0,0],
      [0,0,0,0,3,0,0,0,0],
      [0,0,0,0,3,0,0,0,0],
    ],
    paletteIdx: 4,
  },
];

// ── MUSHROOM (1=cap, 2=spots, 3=stem) ──
const MUSHROOM = {
  pixels: [
    [0,1,0],
    [1,2,1],
    [0,3,0],
  ],
};

// ── FLOWER palette ──
const FLOWER_COLORS = ['#e05030', '#e0c030', '#4070d0', '#e07090', '#e08020'];

export const ProceduralTerrain: React.FC<ProceduralTerrainProps> = ({
  width: propWidth,
  height: propHeight,
  seed,
  animated = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollOffsetRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animatedRef = useRef(animated);
  const animationStartTime = useRef<number | null>(null);
  
  animatedRef.current = animated;

  const canvasSize = useResponsiveCanvas(containerRef, canvasRef);
  const width = canvasSize.width || propWidth || 0;
  const height = canvasSize.height || propHeight || 0;

  const seedNum = useMemo(
    () => parseInt(seed.replace(/\D/g, '') || '0', 10),
    [seed],
  );

  const isMobile = width < 768;
  const groundTop = height * (isMobile ? 0.74 : 0.62);

  // ── Deterministic clouds from seed ──
  const clouds = useMemo(() => {
    const cs: CloudDef[] = [];
    const s = seedNum || 42;
    for (let i = 0; i < 4; i++) {
      const h = ((s * 13 + i * 7) * 5) % 101;
      cs.push({
        x: (i / 4 + (h % 20) * 0.005) % 1,
        y: 0.04 + ((h * 3) % 11) * 0.035,
        shape: CLOUD_SHAPES[h % CLOUD_SHAPES.length],
        width: 28 + (h % 4) * 8,
        speed: 0.3 + (h % 5) * 0.2,
      });
    }
    return cs;
  }, [seedNum]);

  useEffect(() => {
    if (width === 0 || height === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pre-render 32px grass blade tile (most numerous element)
    const bladeTileW = 32;
    const bladeTileH = 6;
    const bladeTile = document.createElement('canvas');
    bladeTile.width = bladeTileW;
    bladeTile.height = bladeTileH;
    const bCtx = bladeTile.getContext('2d')!;
    const bladeColors = ['#3a7a2a', '#4a8a3a', '#5a9a4a'];
    for (let x = 0; x < bladeTileW; x += 4) {
      const h = Math.sin(x * PI2 / 32) * 0.5 + 0.5;
      const bh = 2 + Math.floor((h * 0.8 + 0.2) * 3);
      const c = Math.floor(((Math.sin(x * PI2 / 64 + seedNum) * 0.5 + 0.5) * 3)) % 3;
      bCtx.fillStyle = bladeColors[c];
      bCtx.fillRect(x, bladeTileH - bh, 3, bh);
    }

    // Pre-render depth tile (32px, same parallax seam)
    const depthTileW = 64;
    const depthTile = document.createElement('canvas');
    depthTile.width = depthTileW;
    depthTile.height = 14;
    const dCtx = depthTile.getContext('2d')!;
    dCtx.fillStyle = 'rgba(30, 60, 20, 0.3)';
    for (let x = 0; x < depthTileW; x += 4) {
      const h = Math.sin(x * PI2 / 64 + seedNum * 0.3) * 0.5 + 0.5;
      if (h > 0.55) {
        dCtx.fillRect(x, 8 - h * 4, 4, 5);
      }
    }

    const drawCloud = (cloud: CloudDef, cx: number, cy: number) => {
      const shape = cloud.shape;
      const rows = shape.length;
      const cols = shape[0].length;
      const pw = Math.round(cloud.width / cols);
      const ph = pw;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (!shape[row][col]) continue;
          ctx.fillStyle = shape[row][col] === 1 ? '#ffffff' : '#e8e8e8';
          ctx.fillRect(cx + col * pw, cy + row * ph, pw, ph);
        }
      }
    };

    const drawFrame = (groundScroll: number) => {
      if (typeof ctx.setTransform !== 'function') return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, width, height);

      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#2b7bc9');
      sky.addColorStop(0.45, '#6ec3ed');
      sky.addColorStop(0.75, '#b8e2f5');
      sky.addColorStop(1, '#d4edf9');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const cloudBaseSpeed = groundScroll * (5 / 36);
      for (const cloud of clouds) {
        let cx = (cloud.x * width - cloudBaseSpeed * cloud.speed) % width;
        if (cx < 0) cx += width;
        cx = Math.round(cx);
        const cy = Math.round(cloud.y * height);
        drawCloud(cloud, cx, cy);
        if (cx + cloud.width > width) {
          drawCloud(cloud, cx - width, cy);
        }
      }

      const grassY = Math.round(groundTop - 5);

      const dPhase = Math.round((groundScroll * 0.25) % depthTileW);
      const depthTilesNeeded = Math.ceil(width / depthTileW) + 2;
      const depthStartX = -dPhase - depthTileW;
      
      for (let i = 0; i < depthTilesNeeded; i++) {
        const sx = depthStartX + i * depthTileW;
        if (sx > width) continue;
        ctx.drawImage(depthTile, Math.round(sx), grassY - 8 - 9);
      }

      ctx.fillStyle = '#6b5340';
      ctx.fillRect(0, groundTop, width, height - groundTop);

      ctx.fillStyle = '#4a8a3a';
      ctx.fillRect(0, grassY, width, 6);

      const treePhase = groundScroll % 256;
      for (let sx = -(treePhase + 256); sx < width + 256; sx += 256) {
        if (sx < -28 || sx > width + 28) continue;
        const worldIdx = Math.floor((sx + groundScroll) / 256);
        const h = (worldIdx * 31 + seedNum * 7) % 101;
        if (h > 18) continue;
        const tree = TREES[h % TREES.length];
        const px = 4;
        const th = tree.pixels.length * px;
        for (let row = 0; row < tree.pixels.length; row++) {
          for (let col = 0; col < tree.pixels[row].length; col++) {
            const v = tree.pixels[row][col];
            if (!v) continue;
            ctx.fillStyle = TREE_PALETTES[tree.paletteIdx][v];
            ctx.fillRect(Math.round(sx) + col * px, grassY - th + row * px, px, px);
          }
        }
      }

      const bladePhase = Math.round((groundScroll * 0.8) % bladeTileW);
      const tilesNeeded = Math.ceil(width / bladeTileW) + 2; // +2 for overflow coverage
      const startX = -bladePhase - bladeTileW; // Start earlier to ensure full coverage
      
      for (let i = 0; i < tilesNeeded; i++) {
        const sx = startX + i * bladeTileW;
        if (sx > width) continue; // No need to render beyond canvas
        ctx.drawImage(bladeTile, Math.round(sx), grassY - bladeTileH);
      }

      const shroomPhase = groundScroll % 128;
      for (let sx = -(shroomPhase + 128); sx < width + 128; sx += 128) {
        if (sx < -6 || sx > width + 6) continue;
        const worldIdx = Math.floor((sx + groundScroll) / 128);
        const h = (worldIdx * 23 + seedNum * 11) % 101;
        if (h > 18) continue;
        const off = ((worldIdx * 7 + seedNum * 5) % 7) - 3;
        const mx = Math.round(sx + off);
        for (let row = 0; row < MUSHROOM.pixels.length; row++) {
          for (let col = 0; col < MUSHROOM.pixels[row].length; col++) {
            const v = MUSHROOM.pixels[row][col];
            if (!v) continue;
            ctx.fillStyle = v === 1 ? '#d04030' : v === 2 ? '#f0f0f0' : '#e0d0a0';
            ctx.fillRect(mx + col * 3, grassY - 9 + row * 3, 3, 3);
          }
        }
      }

      const flowerPhase = groundScroll % 48;
      for (let sx = -(flowerPhase + 48); sx < width + 48; sx += 48) {
        if (sx < -4 || sx > width + 4) continue;
        const worldIdx = Math.floor((sx + groundScroll) / 48);
        const h = (worldIdx * 19 + seedNum * 13) % 101;
        if (h > 40) continue;
        const off = ((worldIdx * 11 + seedNum * 3) % 9) - 4;
        const fx = Math.round(sx + off);
        const colorIdx = h % FLOWER_COLORS.length;
        ctx.fillStyle = FLOWER_COLORS[colorIdx];
        ctx.fillRect(fx, grassY - 2, 3, 3);
        ctx.fillRect(fx + 4, grassY - 4, 3, 3);
        ctx.fillRect(fx + 2, grassY - 7, 3, 3);
      }

      const texPhase = groundScroll * 0.7 % 48;
      for (let sx = -(texPhase + 48); sx < width + 48; sx += 8) {
        if (sx < 0 || sx > width) continue;
        const worldX = sx + groundScroll * 0.7;
        if ((Math.sin(worldX * PI2 / 48 + seedNum) * 0.5 + 0.5) > 0.65) {
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(Math.round(sx), groundTop + 2, 6, 3);
        }
      }

      const stonePhase = groundScroll * 0.6 % 64;
      for (let sx = -(stonePhase + 64); sx < width + 64; sx += 64) {
        if (sx < -8 || sx > width + 8) continue;
        const worldIdx = Math.floor((sx + groundScroll * 0.6) / 64);
        const off = ((worldIdx * 17 + seedNum * 3) % 13) - 6;
        const stoneX = Math.round(sx + off);
        ctx.fillStyle = '#8a8070';
        ctx.fillRect(stoneX, groundTop + 4, 4, 3);
        ctx.fillStyle = '#6a6050';
        ctx.fillRect(stoneX + 1, groundTop + 5, 2, 2);
      }

      const bushPhase = groundScroll * 0.5 % 96;
      for (let sx = -(bushPhase + 96); sx < width + 96; sx += 96) {
        if (sx < -12 || sx > width + 12) continue;
        const worldIdx = Math.floor((sx + groundScroll * 0.5) / 96);
        const off = ((worldIdx * 13 + seedNum * 7) % 19) - 9;
        const bx = Math.round(sx + off);
        ctx.fillStyle = '#4a7a3a';
        ctx.fillRect(bx, grassY - 7, 6, 4);
        ctx.fillRect(bx + 1, grassY - 10, 4, 3);
        ctx.fillStyle = '#3a6a2a';
        ctx.fillRect(bx, grassY - 4, 2, 2);
      }
    };

    const dpr = window.devicePixelRatio || 1;
    if (typeof ctx.setTransform !== 'function') {
      return;
    }

    let rafId: number;

    const render = (now: number) => {
      rafId = requestAnimationFrame(render);
      
      // Initialize start time on first stable frame
      if (animationStartTime.current === null) {
        animationStartTime.current = now;
      }
      
      const elapsedSinceStable = now - animationStartTime.current;
      
      // Smooth ramp-up over first 500ms to prevent initial jump
      const rampUpFactor = Math.min(1, elapsedSinceStable / 500);
      const effectiveScrollSpeed = 36 * rampUpFactor;
      
      if (animatedRef.current) {
        const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0;
        scrollOffsetRef.current += dt * effectiveScrollSpeed;
      }
      
      lastTimeRef.current = now;
      drawFrame(scrollOffsetRef.current);
    };

    lastTimeRef.current = 0;
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [width, height, seedNum, isMobile, groundTop, clouds]);

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
