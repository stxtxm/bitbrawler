import { useEffect, useMemo, useRef } from 'react';
import { useResponsiveCanvas } from '../../hooks/useTerrainAnimation';

interface ProceduralTerrainProps {
  width?: number;
  height?: number;
  seed: string;
}

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
  const scrollSpeed = 0.4;

  // ── Pixel ground with scrolling grass ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const render = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const groundOffset = (elapsed * scrollSpeed * 60) % 240;

      ctx.clearRect(0, 0, width, height);

      // ── 1. Solid dirt base ──
      ctx.fillStyle = '#6b5340';
      ctx.fillRect(0, groundTop, width, height - groundTop);

      // ── 2. Grass strip ──
      const grassScroll = Math.round((groundOffset * 0.8) % 32);
      const grassTop = groundTop - 5;

      ctx.fillStyle = '#4a8a3a';
      ctx.fillRect(0, grassTop, width, 8);

      // ── 3. Grass blades (every 4px) ──
      const bladeColors = ['#3a7a2a', '#4a8a3a', '#5a9a4a'];
      for (let x = -16; x <= width + 16; x += 4) {
        const sx = ((x - grassScroll + width + 64) % (width + 64)) - 16;
        if (sx < -4 || sx > width) continue;

        const phase = Math.sin((x + seedNum) * 0.3) * 0.5 + 0.5;
        const bh = 3 + Math.floor(phase * 5);
        const ci = Math.floor((Math.sin((x + seedNum) * 0.15) * 0.5 + 0.5) * 3) % 3;

        ctx.fillStyle = bladeColors[ci];
        ctx.fillRect(sx, grassTop - bh, 3, bh);
      }

      // ── 4. Ground texture ──
      const texScroll = Math.round(groundOffset % 48);
      for (let x = 0; x < width; x += 8) {
        const tx = ((x - texScroll + width + 48) % (width + 48)) - 0;
        if (tx < 0 || tx > width) continue;
        const t = Math.sin(x * 0.17 + seedNum * 0.3) * 0.5 + 0.5;
        if (t > 0.65) {
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(tx, groundTop + 2, 6, 3);
        }
      }

      // ── 5. Small stones on ground ──
      const stoneScroll = Math.round((groundOffset * 0.6) % 64);
      for (let i = 0; i < 4; i++) {
        const sx = ((i * 64 + (seedNum % 17) - stoneScroll + width + 128) % (width + 128)) - 64;
        if (sx < -8 || sx > width + 8) continue;
        ctx.fillStyle = '#8a8070';
        ctx.fillRect(sx, groundTop + 4, 4, 3);
        ctx.fillStyle = '#6a6050';
        ctx.fillRect(sx + 1, groundTop + 5, 2, 2);
      }

      // ── 6. Bushes on grass ──
      const bushScroll = Math.round((groundOffset * 0.5) % 96);
      for (let i = 0; i < 6; i++) {
        const bx = ((i * 96 + (seedNum % 47) - bushScroll + width + 192) % (width + 192)) - 96;
        if (bx < -12 || bx > width + 12) continue;

        ctx.fillStyle = '#4a7a3a';
        ctx.fillRect(bx, grassTop - 7, 6, 4);
        ctx.fillRect(bx + 1, grassTop - 10, 4, 3);
        ctx.fillStyle = '#3a6a2a';
        ctx.fillRect(bx, grassTop - 4, 2, 2);
      }

      rafId = requestAnimationFrame(render);
    };

    startTimeRef.current = Date.now();
    rafId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(rafId);
  }, [width, height, seedNum, isMobile, groundTop, scrollSpeed]);

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
