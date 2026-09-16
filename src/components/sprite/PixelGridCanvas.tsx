import { memo, useEffect, useRef } from 'react';
import type { SpriteGrid, SpritePalette } from './spriteTypes';

interface PixelGridCanvasProps {
  grid: SpriteGrid;
  palette: SpritePalette;
  scale?: number;
  label?: string;
  className?: string;
  glowColor?: string | null;
}

interface BitmapEntry {
  palette: SpritePalette;
  width: number;
  height: number;
  img: ImageData;
}

const bitmapCache = new WeakMap<SpriteGrid, BitmapEntry>();

function parseHex(hex: string): [number, number, number] | null {
  if (!hex || hex === 'transparent') return null;
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  if (full.length !== 6) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function buildBitmap(grid: SpriteGrid, palette: SpritePalette, width: number, height: number): ImageData | null {
  const cached = bitmapCache.get(grid);
  if (cached && cached.palette === palette && cached.width === width && cached.height === height) {
    return cached.img;
  }
  let img: ImageData;
  try {
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const offCtx = off.getContext('2d');
    if (!offCtx || typeof offCtx.createImageData !== 'function') return null;
    img = offCtx.createImageData(width, height);
  } catch {
    return null;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = parseHex(palette[grid[y][x]] ?? '');
      const i = (y * width + x) * 4;
      if (!rgb) {
        img.data[i + 3] = 0;
        continue;
      }
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
  }
  bitmapCache.set(grid, { palette, width, height, img });
  return img;
}

export const PixelGridCanvas = memo(function PixelGridCanvas({
  grid,
  palette,
  scale = 4,
  label,
  className,
  glowColor,
}: PixelGridCanvasProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width === 0 || height === 0) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx || typeof ctx.drawImage !== 'function' || typeof ctx.putImageData !== 'function') return;
    const img = buildBitmap(grid, palette, width, height);
    if (!img) return;
    let off: HTMLCanvasElement | null = null;
    try {
      off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      off.getContext('2d')?.putImageData(img, 0, 0);
    } catch {
      return;
    }
    if (!off) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (glowColor) {
      const rgb = parseHex(glowColor);
      if (rgb) {
        const glow = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2,
        );
        glow.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`);
        glow.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }, [grid, palette, width, height, scale, glowColor]);

  return (
    <canvas
      ref={ref}
      width={Math.max(1, width * scale)}
      height={Math.max(1, height * scale)}
      className={className}
      aria-label={label}
      data-glow={glowColor ? 'on' : 'off'}
      style={{ imageRendering: 'pixelated' }}
    />
  );
});
