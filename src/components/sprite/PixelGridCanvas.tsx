import { useEffect, useRef } from 'react';
import type { SpriteGrid, SpritePalette } from './spriteTypes';

interface PixelGridCanvasProps {
  grid: SpriteGrid;
  palette: SpritePalette;
  scale?: number;
  label?: string;
  className?: string;
  glowColor?: string | null;
}

export function PixelGridCanvas({
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
    if (!ctx || typeof ctx.drawImage !== 'function') return;
    let off: HTMLCanvasElement | null = null;
    let offCtx: CanvasRenderingContext2D | null = null;
    try {
      off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      offCtx = off.getContext('2d');
    } catch {
      off = null;
      offCtx = null;
    }
    if (!off || !offCtx || typeof offCtx.createImageData !== 'function') return;
    let img: ImageData;
    try {
      img = offCtx.createImageData(width, height);
    } catch {
      return;
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const hex = palette[grid[y][x]];
        const i = (y * width + x) * 4;
        if (!hex || hex === 'transparent') {
          img.data[i + 3] = 0;
          continue;
        }
        const clean = hex.replace('#', '');
        const full = clean.length === 3
          ? clean.split('').map((c) => c + c).join('')
          : clean;
        img.data[i] = parseInt(full.slice(0, 2), 16);
        img.data[i + 1] = parseInt(full.slice(2, 4), 16);
        img.data[i + 2] = parseInt(full.slice(4, 6), 16);
        img.data[i + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }, [grid, palette, width, height, scale]);

  return (
    <canvas
      ref={ref}
      width={Math.max(1, width * scale)}
      height={Math.max(1, height * scale)}
      className={className}
      aria-label={label}
      style={{
        imageRendering: 'pixelated',
        ...(glowColor ? { filter: `drop-shadow(0 0 6px ${glowColor})` } : {}),
      }}
    />
  );
}
