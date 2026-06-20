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

    // Draw layers with logic to ensure no overlapping mountains
    for (let i = 0; i < parallaxLayers; i++) {
      const noise = generateNoiseMap(w, h, seedNum + i);
      
      if (i === 0) {
        // Mountain layer: Render as a single clean silhouette with no intersections
        ctx.fillStyle = palette.mountain;
        ctx.beginPath();
        ctx.moveTo(0, h);
        
        let lastY = h;
        for (let x = 0; x <= w; x++) {
          // Smooth the mountain peaks by averaging noise over a small window
          let peakNoise = 0;
          for (let k = -2; k <= 2; k++) {
            peakNoise += noise[Math.floor(h * 0.3) * w + Math.min(Math.max(x + k, 0), w - 1)];
          }
          peakNoise /= 5;
          
          const targetY = (h * 0.4) - (peakNoise / 255) * (h * 0.3);
          // Limit slope to avoid impossible steepness
          const y = Math.min(Math.max(targetY, lastY - 5), lastY + 5);
          ctx.lineTo(x / scale, y / scale);
          lastY = y;
        }
        ctx.lineTo(w / scale, h / scale);
        ctx.closePath();
        ctx.fill();
      } else {
        // Standard procedural layer for other layers (grass/dirt)
        ctx.fillStyle = i === 1 ? palette.grass : palette.dirt;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (noise[y * w + x] > 180) {
              ctx.fillRect(x / scale, y / scale, 1/scale, 1/scale);
            }
          }
        }
      }
    }
  }, [width, height, parallaxLayers, mobileQuality, seed, palette]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%', position: 'absolute' }} />;
};
