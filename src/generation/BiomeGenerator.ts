/**
 * Biome Generator
 * Creates smooth transitions between different terrain biomes
 */

import { noise2D } from './Noise';
import { BIOME_CONFIG } from '../config/terrainConfig';

export type BiomeType = typeof BIOME_CONFIG.BIOMES[number];

export interface BiomeData {
  type: BiomeType;
  noiseValue: number;
  transitionFactor: number;
}

function getBiomeTypeFromNoise(noiseValue: number): BiomeType {
  if (noiseValue < 0.2) return 'water';
  if (noiseValue < 0.4) return 'desert';
  if (noiseValue < 0.6) return 'meadow';
  if (noiseValue < 0.8) return 'forest';
  return 'mountain';
}

/**
 * Get biome at a specific position with smooth transitions.
 * Uses a wider sampling range for visible blending.
 */
export function getBiomeAt(
  x: number,
  y: number,
  seed: number,
  scrollOffset: number = 0,
): BiomeData {
  // Use a coarser scale for biome regions (wider bands)
  const adjustedX = (x + scrollOffset) * 0.003;
  const adjustedY = y * 0.005;
  const noiseValue = (noise2D(adjustedX, adjustedY, seed) + 1) / 2;

  const biomeType = getBiomeTypeFromNoise(noiseValue);

  // Smooth transition factor: 0 at boundary, 1 in center
  const biomeValue = noiseValue * 5;
  const transitionFactor = Math.abs((biomeValue % 1) - 0.5) * 2;

  return { type: biomeType, noiseValue, transitionFactor };
}

/**
 * Blend two hex colors with a factor (0=color2, 1=color1)
 */
function blendColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const t = 1 - factor;
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return rgbToHex(r, g, b);
}

/**
 * Get biome color with smooth blending between adjacent biomes.
 * Samples at wider offsets (40px) so transitions are visible.
 */
export function getBiomeColor(
  x: number,
  y: number,
  seed: number,
  colorType: 'grass' | 'dirt' | 'mountain' | 'accent',
  scrollOffset: number = 0,
): string {
  const biome = getBiomeAt(x, y, seed, scrollOffset);
  const biomeColors = BIOME_CONFIG.COLORS[biome.type];
  const color = biomeColors[colorType];

  // Sample at wider offset for visible blending
  const blendRange = 40;
  const adjacentBiome = getBiomeAt(x + blendRange, y, seed, scrollOffset);
  if (adjacentBiome.type !== biome.type) {
    const adjacentColors = BIOME_CONFIG.COLORS[adjacentBiome.type];
    const adjacentColor = adjacentColors[colorType];
    return blendColor(color, adjacentColor, biome.transitionFactor);
  }

  // Also check left side for bidirectional blending
  const leftBiome = getBiomeAt(x - blendRange, y, seed, scrollOffset);
  if (leftBiome.type !== biome.type) {
    const leftColors = BIOME_CONFIG.COLORS[leftBiome.type];
    const leftColor = leftColors[colorType];
    return blendColor(color, leftColor, biome.transitionFactor);
  }

  return color;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function getBiomeName(biomeType: BiomeType): string {
  const names: Record<BiomeType, string> = {
    meadow: 'Meadow',
    forest: 'Forest',
    mountain: 'Mountain',
    desert: 'Desert',
    water: 'Water',
  };
  return names[biomeType];
}
