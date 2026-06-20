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
  transitionFactor: number; // 0-1 for smooth blending
}

/**
 * Determine biome type based on noise value
 */
function getBiomeTypeFromNoise(noiseValue: number): BiomeType {
  // noiseValue is 0-1
  if (noiseValue < 0.2) return 'water';
  if (noiseValue < 0.4) return 'desert';
  if (noiseValue < 0.6) return 'meadow';
  if (noiseValue < 0.8) return 'forest';
  return 'mountain';
}

/**
 * Get biome at a specific position with smooth transitions
 */
export function getBiomeAt(
  x: number,
  y: number,
  seed: number,
  scrollOffset: number = 0,
): BiomeData {
  const adjustedX = (x + scrollOffset) * 0.01; // Lower scale for larger biome regions
  const noiseValue = (noise2D(adjustedX, y * 0.01, seed) + 1) / 2; // Normalize to 0-1

  const biomeType = getBiomeTypeFromNoise(noiseValue);

  // Transition factor: how close to the boundary between biomes
  const biomeValue = noiseValue * 5;
  const transitionFactor = Math.abs((biomeValue % 1) - 0.5) * 2; // 0 at boundary, 1 in center

  return {
    type: biomeType,
    noiseValue,
    transitionFactor,
  };
}

/**
 * Blend two color values based on transition factor
 */
function blendColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  const r = Math.round(c1.r + (c2.r - c1.r) * (1 - factor));
  const g = Math.round(c1.g + (c2.g - c1.g) * (1 - factor));
  const b = Math.round(c1.b + (c2.b - c1.b) * (1 - factor));

  return rgbToHex(r, g, b);
}

/**
 * Get color for biome with smooth transitions
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

  // Get adjacent biome for smooth blending
  const adjacentBiome = getBiomeAt(x + 1, y, seed, scrollOffset);
  if (adjacentBiome.type !== biome.type) {
    const adjacentColors = BIOME_CONFIG.COLORS[adjacentBiome.type];
    const adjacentColor = adjacentColors[colorType];
    return blendColor(color, adjacentColor, biome.transitionFactor);
  }

  return color;
}

/**
 * Get all biomes in a region (for rendering optimization)
 */
export function getBiomesInRegion(
  startX: number,
  endX: number,
  y: number,
  seed: number,
  step: number = 100, // Sample every N pixels
): BiomeData[] {
  const biomes: BiomeData[] = [];
  for (let x = startX; x <= endX; x += step) {
    const biome = getBiomeAt(x, y, seed);
    if (!biomes.length || biomes[biomes.length - 1].type !== biome.type) {
      biomes.push(biome);
    }
  }
  return biomes;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

/**
 * Get biome name for display
 */
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
