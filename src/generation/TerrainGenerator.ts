import { generateNoiseMap } from './Noise';

export type DecorElement = {
  type: 'rock' | 'bush' | 'glow';
  x: number;
  y: number;
  scale: number;
};

export function generateDecor(width: number, height: number, _seed: number, level: number): DecorElement[] {
  const decor: DecorElement[] = [];
  const density = 0.002 + (level * 0.0001);
  const count = Math.floor(width * height * density);
  
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = (height * 0.7) + (Math.random() * height * 0.3); // Decors on ground area
    const type = Math.random() > 0.5 ? 'rock' : 'bush';
    decor.push({ type, x, y, scale: 0.5 + Math.random() });
  }
  return decor;
}

export function getTerrainLayerData(width: number, height: number, seed: number, layer: number) {
    const noiseMap = generateNoiseMap(width, height, seed + layer);
    return noiseMap;
}
