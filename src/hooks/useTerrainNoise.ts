/**
 * Terrain Noise Caching System
 * Optimizes performance by caching noise maps and avoiding redundant generation
 */

import { useMemo } from 'react';
import { generateNoiseMap } from '../generation/Noise';
import { NOISE_CONFIG } from '../config/terrainConfig';

/**
 * Cache for noise maps - prevents recreation on every render
 */
class NoiseMapCache {
  private cache: Map<string, Uint8Array> = new Map();
  private maxSize: number;

  constructor(maxSize: number = NOISE_CONFIG.CACHE_MAX_SEEDS) {
    this.maxSize = maxSize;
  }

  /**
   * Generate cache key from width, height, and seed
   */
  private getKey(width: number, height: number, seed: number): string {
    return `${width}x${height}:${seed}`;
  }

  /**
   * Get or generate noise map
   */
  getNoiseMap(
    width: number,
    height: number,
    seed: number,
  ): Uint8Array {
    const key = this.getKey(width, height, seed);

    // Return cached if exists
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Generate new
    const noiseMap = generateNoiseMap(width, height, seed);

    // Cache it
    this.cache.set(key, noiseMap);

    // Evict oldest if cache is full
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value as string;
      this.cache.delete(firstKey);
    }

    return noiseMap;
  }

  /**
   * Clear all cached maps
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Could track hits vs misses
    };
  }
}

// Global cache instance
const globalNoiseCache = new NoiseMapCache();

/**
 * Hook: Generate and cache noise maps for multiple layers
 */
export function useTerrainNoiseMaps(
  width: number,
  height: number,
  layerCount: number,
  seed: string,
  noiseResolution: number = NOISE_CONFIG.RESOLUTION,
): Record<number, Uint8Array> {
  return useMemo(() => {
    const noiseMaps: Record<number, Uint8Array> = {};
    const seedNum = parseInt(seed.replace(/\D/g, '') || '0', 10);

    const noiseWidth = Math.floor((width / noiseResolution) / 4);
    const noiseHeight = Math.floor((height / noiseResolution) / 4);

    for (let i = 0; i < layerCount; i++) {
      noiseMaps[i] = globalNoiseCache.getNoiseMap(
        noiseWidth,
        noiseHeight,
        seedNum + i,
      );
    }

    return noiseMaps;
  }, [width, height, layerCount, seed, noiseResolution]);
}

/**
 * Hook: Get single noise map
 */
export function useTerrainNoiseMap(
  width: number,
  height: number,
  seed: string,
  layerIndex: number = 0,
  noiseResolution: number = NOISE_CONFIG.RESOLUTION,
): Uint8Array {
  return useMemo(() => {
    const seedNum = parseInt(seed.replace(/\D/g, '') || '0', 10);
    const noiseWidth = Math.floor((width / noiseResolution) / 4);
    const noiseHeight = Math.floor((height / noiseResolution) / 4);

    return globalNoiseCache.getNoiseMap(
      noiseWidth,
      noiseHeight,
      seedNum + layerIndex,
    );
  }, [width, height, seed, layerIndex, noiseResolution]);
}

/**
 * Clear the global noise cache
 */
export function clearTerrainNoiseCache(): void {
  globalNoiseCache.clear();
}

/**
 * Get cache statistics for performance monitoring
 */
export function getTerrainNoiseCacheStats() {
  return globalNoiseCache.getStats();
}
