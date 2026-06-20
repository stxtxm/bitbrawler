import { useEffect, useRef, useState } from 'react';
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

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setOffset(prev => (prev + 2) % (width * 4)); // Vitesse de défilement augmentée
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const seedNum = parseInt(seed.replace(/\D/g, '') || '0', 10);
    ctx.clearRect(0, 0, width, height);

    // Draw Mountain layer as a single fixed silhouette with horizontal offset for scrolling
    ctx.fillStyle = palette.mountain;
    ctx.beginPath();
    ctx.moveTo(0, height);
    
    const mountainPeaks = 12;
    for (let i = 0; i <= mountainPeaks; i++) {
        const x = ((width / mountainPeaks) * i) - (offset % (width / (mountainPeaks / 2)));
        const y = height * (0.3 + Math.sin(i + seedNum) * 0.2);
        ctx.lineTo(x, y);
    }
    
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Standard procedural layer for other layers (grass/dirt) with faster scroll
    for (let i = 1; i < parallaxLayers; i++) {
        const noise = generateNoiseMap(Math.floor(width/4), Math.floor(height/4), seedNum + i);
        ctx.fillStyle = i === 1 ? palette.grass : palette.dirt;
        const cellSize = 4;
        const scrollOffset = (offset * (i + 1)) % width;
        for (let y = 0; y < height / cellSize; y++) {
            for (let x = 0; x < width / cellSize; x++) {
                if (noise[y * Math.floor(width/cellSize) + x] > 200) {
                    ctx.fillRect((x * cellSize - scrollOffset + width) % width, y * cellSize, cellSize, cellSize);
                }
            }
        }
    }
  }, [width, height, parallaxLayers, mobileQuality, seed, palette, offset]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%', position: 'absolute' }} />;
};
