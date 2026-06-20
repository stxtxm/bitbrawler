import { useEffect, useRef } from 'react';
import { generateNoiseMap } from '../../generation/Noise';
import { DAY_PALETTE, NIGHT_PALETTE } from '../../utils/ColorPalette';

interface ProceduralTerrainProps {
  width: number;
  height: number;
  parallaxLayers: number;
  mobileQuality: boolean;
  seed: string;
  isNight?: boolean;
}

export const ProceduralTerrain: React.FC<ProceduralTerrainProps> = ({ width, height, parallaxLayers, mobileQuality, seed, isNight = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const palette = isNight ? NIGHT_PALETTE : DAY_PALETTE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const seedNum = parseInt(seed.replace(/\D/g, '') || '0', 10);
    const scale = mobileQuality ? 0.5 : 1;
    const w = Math.floor(width * scale);
    const h = Math.floor(height * scale);

    ctx.clearRect(0, 0, width, height);

    // Draw layers with mountain shape improvement
    for (let i = 0; i < parallaxLayers; i++) {
      const noise = generateNoiseMap(w, h, seedNum + i);
      ctx.fillStyle = i === 0 ? palette.mountain : i === 1 ? palette.grass : palette.dirt;
      
      // Improve mountain shape for i === 0
      if (i === 0) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x < w; x++) {
          // Use noise to create peaky mountain shapes instead of noise dots
          const mountainNoise = noise[Math.floor(h * 0.4) * w + x];
          const y = h - (mountainNoise / 255) * (h * 0.6);
          ctx.lineTo(x / scale, y / scale);
        }
        ctx.lineTo(w / scale, h / scale);
        ctx.closePath();
        ctx.fill();
      } else {
        // Standard procedural layer for other layers
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (noise[y * w + x] > 128) {
              ctx.fillRect(x / scale, y / scale, 1/scale, 1/scale);
            }
          }
        }
      }
    }
  }, [width, height, parallaxLayers, mobileQuality, seed, palette]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%', position: 'absolute' }} />;
};
