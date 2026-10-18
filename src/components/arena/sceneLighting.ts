import type { CSSProperties } from 'react';
import type { BiomeId } from '../../data/biomes';

export interface BiomeLighting {
  tint: string;
  shadowRgb: string;
  shadowAlpha: number;
  shadowSpread: string;
}

export const BIOME_LIGHTING: Record<BiomeId, BiomeLighting> = {
  plains: {
    tint: 'rgba(126, 176, 255, 0.14)',
    shadowRgb: '8, 14, 26',
    shadowAlpha: 0.5,
    shadowSpread: '68%',
  },
  volcanic: {
    tint: 'rgba(255, 122, 44, 0.2)',
    shadowRgb: '26, 8, 2',
    shadowAlpha: 0.58,
    shadowSpread: '76%',
  },
  abyssal: {
    tint: 'rgba(122, 84, 214, 0.24)',
    shadowRgb: '6, 3, 18',
    shadowAlpha: 0.66,
    shadowSpread: '82%',
  },
};

const LOW_PERF_SHADOW_FACTOR = 0.6;

export function getBiomeLighting(biomeId: BiomeId): BiomeLighting {
  return BIOME_LIGHTING[biomeId] ?? BIOME_LIGHTING.plains;
}

export function sceneLightingStyle(lighting: BiomeLighting, lowPerf: boolean): CSSProperties {
  const alpha = lowPerf ? lighting.shadowAlpha * LOW_PERF_SHADOW_FACTOR : lighting.shadowAlpha;
  return {
    '--scene-tint': lighting.tint,
    '--scene-shadow-color': `rgba(${lighting.shadowRgb}, ${alpha})`,
    '--scene-shadow-spread': lighting.shadowSpread,
  } as CSSProperties;
}
