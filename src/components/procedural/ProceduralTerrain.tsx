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

// ── TREES (1=dark foliage, 2=light foliage, 3=trunk, 4=highlight) ──
const TREE_PALETTES: Record<number, string>[] = [
  { 1: '#2d7a2a', 2: '#4a9a3a', 3: '#6b4a2a', 4: '#5aaa50' },
  { 1: '#1d6a1a', 2: '#3a8a2a', 3: '#5a3a1a', 4: '#4a9a40' },
  { 1: '#3a8a2a', 2: '#5aaa3a', 3: '#6b4a2a', 4: '#6aba50' },
  { 1: '#2a7a30', 2: '#4aaa40', 3: '#5a3a20', 4: '#5aba50' },
  { 1: '#1a6a20', 2: '#3a9a30', 3: '#6b4a2a', 4: '#4aaa40' },
];

const TREES = [
  { // Round leafy
    pixels: [
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,1,2,2,2,1,0,0,0],
      [0,0,1,2,4,2,4,2,1,0,0],
      [0,1,2,2,2,2,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,4,2,4,2,1,0,0],
      [0,0,0,1,2,2,2,1,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,0,0,3,0,0,0,0,0],
      [0,0,0,0,0,3,0,0,0,0,0],
    ],
    paletteIdx: 0,
  },
  { // Pine
    pixels: [
      [0,0,0,0,1,0,0,0,0],
      [0,0,0,1,2,1,0,0,0],
      [0,0,1,2,4,2,1,0,0],
      [0,1,2,2,2,2,2,1,0],
      [0,0,1,2,4,2,1,0,0],
      [0,0,0,1,2,1,0,0,0],
      [0,0,0,0,1,0,0,0,0],
      [0,0,0,0,3,0,0,0,0],
      [0,0,0,0,3,0,0,0,0],
    ],
    paletteIdx: 1,
  },
  { // Sapling
    pixels: [
      [0,0,1,1,0,0],
      [0,1,2,2,1,0],
      [1,2,4,4,2,1],
      [0,1,2,2,1,0],
      [0,0,1,2,0,0],
      [0,0,0,3,0,0],
      [0,0,0,3,0,0],
    ],
    paletteIdx: 2,
  },
  { // Wide oak
    pixels: [
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,1,2,2,2,2,1,0,0,0],
      [0,0,1,2,4,2,2,4,2,1,0,0],
      [0,1,2,2,2,2,2,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,2,2,2,1,0,0],
      [0,0,0,1,2,4,2,4,2,1,0,0],
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,0,3,0,0,0,0,0],
      [0,0,0,0,0,0,3,0,0,0,0,0],
    ],
    paletteIdx: 3,
  },
  { // Tall multi-tier
    pixels: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,1,2,1,0,0,0,0],
      [0,0,0,1,2,4,2,1,0,0,0],
      [0,0,0,0,1,2,1,0,0,0,0],
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,1,2,1,0,0,0,0],
      [0,0,0,1,2,4,2,1,0,0,0],
      [0,0,0,0,1,2,1,0,0,0,0],
      [0,0,0,0,0,3,0,0,0,0,0],
      [0,0,0,0,0,3,0,0,0,0,0],
      [0,0,0,0,0,3,0,0,0,0,0],
    ],
    paletteIdx: 4,
  },
];

// ── MUSHROOM tiny (1=cap, 2=spots, 3=stem) ──
const MUSHROOM_TINY = {
  pixels: [
    [0,1,1,0],
    [1,2,2,1],
    [0,1,1,0],
    [0,0,3,0],
  ],
};
// ── MUSHROOM medium (1=cap, 2=spots, 3=stem, 4=highlight) ──
const MUSHROOM_MED = {
  pixels: [
    [0,1,1,1,0],
    [1,4,2,4,1],
    [0,1,2,1,0],
    [0,0,3,0,0],
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
  const bgPausedRef = useRef(false);
  
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

    // Pre-render 64px grass blade tile (bigger/detailed)
    const bladeTileW = 64;
    const bladeTileH = 10;
    const bladeTile = document.createElement('canvas');
    bladeTile.width = bladeTileW;
    bladeTile.height = bladeTileH;
    const bCtx = bladeTile.getContext('2d')!;
    const bladeColors = ['#3a7a2a', '#4a8a3a', '#5a9a4a', '#6aaa50'];
    for (let x = 0; x < bladeTileW; x += 5) {
      const h = Math.sin(x * PI2 / 64) * 0.5 + 0.5;
      const bh = 3 + Math.floor((h * 0.8 + 0.2) * 5);
      const c = Math.floor(((Math.sin(x * PI2 / 80 + seedNum) * 0.5 + 0.5) * 4)) % 4;
      bCtx.fillStyle = bladeColors[c];
      bCtx.fillRect(x, bladeTileH - bh, 4, bh);
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

      // Lock to integer pixels for tear-free pixel-art scrolling
      const scrollPx = Math.round(groundScroll);

      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#2b7bc9');
      sky.addColorStop(0.45, '#6ec3ed');
      sky.addColorStop(0.75, '#b8e2f5');
      sky.addColorStop(1, '#d4edf9');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const cloudBaseSpeed = scrollPx * (5 / 36);
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

      const dPhase = Math.round((scrollPx * 0.25) % depthTileW);
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

      const treePhase = scrollPx % 320;
      for (let sx = -(treePhase + 320); sx < width + 320; sx += 320) {
        if (sx < -44 || sx > width + 44) continue;
        const worldIdx = Math.floor((sx + scrollPx) / 320);
        const h = (worldIdx * 31 + seedNum * 7) % 101;
        if (h > 35) continue;
        const tree = TREES[h % TREES.length];
        const px = 6;
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

      const bladePhase = Math.round((scrollPx * 0.8) % bladeTileW);
      const tilesNeeded = Math.ceil(width / bladeTileW) + 2; // +2 for overflow coverage
      const startX = -bladePhase - bladeTileW; // Start earlier to ensure full coverage
      
      for (let i = 0; i < tilesNeeded; i++) {
        const sx = startX + i * bladeTileW;
        if (sx > width) continue; // No need to render beyond canvas
        ctx.drawImage(bladeTile, Math.round(sx), grassY - bladeTileH);
      }

      // ── Shrooms: tiny (back layer) + medium (foreground) with depth ──
      const shroomTinyCell = 3;
      const shroomTinyPhase = scrollPx * 0.5 % 128;
      for (let sx = -(shroomTinyPhase + 128); sx < width + 128; sx += 128) {
        if (sx < -10 || sx > width + 10) continue;
        const worldIdx = Math.floor((sx + scrollPx * 0.5) / 128);
        const h = (worldIdx * 23 + seedNum * 11) % 101;
        if (h > 22) continue;
        const off = ((worldIdx * 7 + seedNum * 5) % 7) - 3;
        const mx = Math.round(sx + off);
        for (let row = 0; row < MUSHROOM_TINY.pixels.length; row++) {
          for (let col = 0; col < MUSHROOM_TINY.pixels[row].length; col++) {
            const v = MUSHROOM_TINY.pixels[row][col];
            if (!v) continue;
            ctx.fillStyle = v === 1 ? '#c05030' : v === 2 ? '#e0c0a0' : '#b09070';
            ctx.fillRect(mx + col * shroomTinyCell, grassY - MUSHROOM_TINY.pixels.length * shroomTinyCell + row * shroomTinyCell, shroomTinyCell, shroomTinyCell);
          }
        }
      }
      const shroomMedCell = 3;
      const shroomMedPhase = scrollPx % 192;
      for (let sx = -(shroomMedPhase + 192); sx < width + 192; sx += 192) {
        if (sx < -10 || sx > width + 10) continue;
        const worldIdx = Math.floor((sx + scrollPx) / 192);
        const h = (worldIdx * 29 + seedNum * 13) % 101;
        if (h > 20) continue;
        const off = ((worldIdx * 11 + seedNum * 7) % 7) - 3;
        const mx = Math.round(sx + off);
        for (let row = 0; row < MUSHROOM_MED.pixels.length; row++) {
          for (let col = 0; col < MUSHROOM_MED.pixels[row].length; col++) {
            const v = MUSHROOM_MED.pixels[row][col];
            if (!v) continue;
            ctx.fillStyle = v === 1 ? '#d04030' : v === 2 ? '#f0f0f0' : v === 3 ? '#e0d0a0' : '#e06040';
            ctx.fillRect(mx + col * shroomMedCell, grassY - MUSHROOM_MED.pixels.length * shroomMedCell + row * shroomMedCell, shroomMedCell, shroomMedCell);
          }
        }
      }

      const flowerPhase = scrollPx % 80;
      for (let sx = -(flowerPhase + 80); sx < width + 80; sx += 80) {
        if (sx < -12 || sx > width + 12) continue;
        const worldIdx = Math.floor((sx + scrollPx) / 80);
        const h = (worldIdx * 19 + seedNum * 13) % 101;
        if (h > 45) continue;
        const off = ((worldIdx * 11 + seedNum * 3) % 11) - 5;
        const fx = Math.round(sx + off);
        const colorIdx = h % FLOWER_COLORS.length;
        ctx.fillStyle = FLOWER_COLORS[colorIdx];
        // Larger flower: center + 4 petals
        ctx.fillRect(fx + 2, grassY - 4, 4, 4);               // center
        ctx.fillRect(fx, grassY - 8, 3, 3);                    // top-left petal
        ctx.fillRect(fx + 5, grassY - 8, 3, 3);                // top-right petal
        ctx.fillRect(fx, grassY - 1, 3, 3);                    // bottom-left petal
        ctx.fillRect(fx + 5, grassY - 1, 3, 3);                // bottom-right petal
        // Stem
        ctx.fillStyle = '#3a8a3a';
        ctx.fillRect(fx + 3, grassY + 1, 2, 4);
      }

      const texPhase = scrollPx * 0.7 % 48;
      for (let sx = -(texPhase + 48); sx < width + 48; sx += 8) {
        if (sx < 0 || sx > width) continue;
        const worldX = sx + scrollPx * 0.7;
        if ((Math.sin(worldX * PI2 / 48 + seedNum) * 0.5 + 0.5) > 0.65) {
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(Math.round(sx), groundTop + 2, 6, 3);
        }
      }

      // ── Depth stones: scattered across ground with random sizes ──
      for (let layer = 0; layer < 4; layer++) {
        const spacing = 64 + layer * 16;
        const parallax = 0.4 + layer * 0.08;
        const phase = scrollPx * parallax % spacing;
        const baseY = groundTop + 2 + layer * 6;
        const maxSize = 6 - layer;
        const opacity = 0.5 + layer * 0.12;
        
        for (let sx = -(phase + spacing); sx < width + spacing; sx += spacing) {
          if (sx < -12 || sx > width + 12) continue;
          const worldIdx = Math.floor((sx + scrollPx * parallax) / spacing);
          const r = (worldIdx * 17 + seedNum * (3 + layer * 7)) % 31;
          const off = (r % 19) - 9;
          const size = 3 + (r % maxSize);
          const stoneW = size + (r % 3);
          const stoneH = Math.max(2, size - 1);
          const sx2 = Math.round(sx + off);
          
          // Shadow
          ctx.fillStyle = `rgba(0,0,0,${(opacity * 0.15).toFixed(2)})`;
          ctx.fillRect(sx2 + 1, baseY + 1, stoneW, stoneH);
          // Base layer
          ctx.fillStyle = `rgba(90,80,70,${opacity.toFixed(2)})`;
          ctx.fillRect(sx2, baseY, stoneW, stoneH);
          // Highlight
          ctx.fillStyle = `rgba(120,110,100,${(opacity * 0.6).toFixed(2)})`;
          ctx.fillRect(sx2 + 1, baseY, Math.max(1, stoneW - 2), Math.max(1, stoneH - 1));
        }
      }

      const bushPhase = scrollPx * 0.5 % 128;
      for (let sx = -(bushPhase + 128); sx < width + 128; sx += 128) {
        if (sx < -16 || sx > width + 16) continue;
        const worldIdx = Math.floor((sx + scrollPx * 0.5) / 128);
        const off = ((worldIdx * 13 + seedNum * 7) % 21) - 10;
        const bx = Math.round(sx + off);
        ctx.fillStyle = '#4a7a3a';
        ctx.fillRect(bx, grassY - 10, 10, 6);
        ctx.fillRect(bx + 2, grassY - 14, 6, 5);
        ctx.fillStyle = '#5a8a4a';
        ctx.fillRect(bx + 1, grassY - 8, 4, 3);
        ctx.fillRect(bx + 5, grassY - 12, 3, 3);
        ctx.fillStyle = '#3a6a2a';
        ctx.fillRect(bx + 1, grassY - 3, 8, 3);
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
