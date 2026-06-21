import { useEffect, useMemo, useRef } from 'react';
import { useResponsiveCanvas } from '../../hooks/useTerrainAnimation';

interface ProceduralTerrainProps {
  width?: number;
  height?: number;
  seed: string;
}

const PI2 = Math.PI * 2;

export const ProceduralTerrain: React.FC<ProceduralTerrainProps> = ({
  width: propWidth,
  height: propHeight,
  seed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef(Date.now());

  const canvasSize = useResponsiveCanvas(containerRef, canvasRef);
  const width = canvasSize.width || propWidth || 1024;
  const height = canvasSize.height || propHeight || 512;

  const seedNum = useMemo(
    () => parseInt(seed.replace(/\D/g, '') || '0', 10),
    [seed],
  );

  const isMobile = width < 768;
  const groundTop = height * (isMobile ? 0.70 : 0.62);

  // Frequencies chosen so sin patterns perfectly tile at wrap distance
  // period = 32px → freq = 2π/32 ≈ 0.19635
  const FREQ_32 = PI2 / 32;
  // period = 48px → freq = 2π/48 ≈ 0.1309
  const FREQ_48 = PI2 / 48;
  // period = 64px → freq = 2π/64 ≈ 0.098175
  const FREQ_64 = PI2 / 64;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const render = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      // smooth continuous offset, never wraps (36px/s)
      const groundOffset = elapsed * 36;

      ctx.clearRect(0, 0, width, height);

      // ── SKY ──
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.65);
      skyGradient.addColorStop(0, '#4a90d9');
      skyGradient.addColorStop(0.4, '#87ceeb');
      skyGradient.addColorStop(1, '#c8e6f5');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height);

      // ── DIRT BASE ──
      ctx.fillStyle = '#6b5340';
      ctx.fillRect(0, groundTop, width, height - groundTop);

      // ── GRASS STRIP ──
      const grassTop = groundTop - 5;
      ctx.fillStyle = '#4a8a3a';
      ctx.fillRect(0, grassTop, width, 8);

      // ── GRASS BLADES (perfectly tile at 32px) ──
      const grassScroll = groundOffset * 0.8;
      const bladeColors = ['#3a7a2a', '#4a8a3a', '#5a9a4a'];

      // floor-based approach: each 4px column uses a unique tile position
      // the scroll moves which 4px column lands on screen
      const colOffset = Math.floor(grassScroll / 4);
      const colFrac = (grassScroll % 4);

      for (let col = -4; col <= Math.ceil(width / 4) + 4; col++) {
        const tileX = (col + colOffset) & 7; // 0-7, because 8 columns × 4px = 32px tile
        const sx = col * 4 - colFrac;

        if (sx < -6 || sx > width) continue;

        // Use hash of tileX + seedNum for deterministic pattern within the 32px tile
        const h = ((tileX * 7 + seedNum * 3) & 7);
        const bh = 3 + (h % 5);
        const ci = (h + Math.floor(tileX / 3)) % 3;

        ctx.fillStyle = bladeColors[ci];
        ctx.fillRect(Math.round(sx), grassTop - bh, 3, bh);
      }

      // ── GROUND TEXTURE (perfectly tile at 48px) ──
      const texOffset = Math.round(groundOffset % 48);
      for (let x = 0; x < width; x += 8) {
        const tx = ((x - texOffset + width + 48) % (width + 48));
        if (tx < 0 || tx > width) continue;
        const t = Math.sin(x * FREQ_48 + seedNum) * 0.5 + 0.5;
        if (t > 0.65) {
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(Math.round(tx), groundTop + 2, 6, 3);
        }
      }

      // ── STONES (tile at 64px) ──
      const stoneOffset = Math.round((groundOffset * 0.6) % 64);
      for (let i = 0; i < 4; i++) {
        const sx = ((i * 64 + (seedNum % 17) - stoneOffset + width + 128) % (width + 128)) - 64;
        if (sx < -8 || sx > width + 8) continue;
        ctx.fillStyle = '#8a8070';
        ctx.fillRect(Math.round(sx), groundTop + 4, 4, 3);
        ctx.fillStyle = '#6a6050';
        ctx.fillRect(Math.round(sx) + 1, groundTop + 5, 2, 2);
      }

      // ── BUSHES (tile at 96px) ──
      const bushOffset = Math.round((groundOffset * 0.5) % 96);
      for (let i = 0; i < 6; i++) {
        const bx = ((i * 96 + (seedNum % 47) - bushOffset + width + 192) % (width + 192)) - 96;
        if (bx < -12 || bx > width + 12) continue;

        ctx.fillStyle = '#4a7a3a';
        ctx.fillRect(Math.round(bx), grassTop - 7, 6, 4);
        ctx.fillRect(Math.round(bx) + 1, grassTop - 10, 4, 3);
        ctx.fillStyle = '#3a6a2a';
        ctx.fillRect(Math.round(bx), grassTop - 4, 2, 2);
      }

      rafId = requestAnimationFrame(render);
    };

    startTimeRef.current = Date.now();
    rafId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(rafId);
  }, [width, height, seedNum, isMobile, groundTop, FREQ_32, FREQ_48, FREQ_64]);

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
