import { BIOMES, BiomeDef, BiomeId } from './biomes';

export const SURGE_BIOME_ROTATION: BiomeId[] = BIOMES.map((b) => b.id);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BIOME_SURGE_EPOCH = Date.UTC(2026, 0, 1);

export function getSurgeBiome(date: Date = new Date()): BiomeDef {
  const elapsed = date.getTime() - BIOME_SURGE_EPOCH;
  const weekIdx = Math.floor(elapsed / WEEK_MS);
  const safeIdx = ((weekIdx % BIOMES.length) + BIOMES.length) % BIOMES.length;
  return BIOMES[safeIdx];
}

export function getSurgeBiomeId(date: Date = new Date()): BiomeId {
  return getSurgeBiome(date).id;
}

export function getActiveSurge(date: Date = new Date()): BiomeDef {
  return getSurgeBiome(date);
}

export function getSeasonWindow(date: Date = new Date()): { seasonId: string; start: Date; end: Date } {
  const SEASON_DAYS = 30;
  const seasonMs = SEASON_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = date.getTime() - BIOME_SURGE_EPOCH;
  const seasonIdx = Math.floor(elapsed / seasonMs);
  const startMs = BIOME_SURGE_EPOCH + seasonIdx * seasonMs;
  const endMs = startMs + seasonMs;
  return {
    seasonId: `season-${seasonIdx}`,
    start: new Date(startMs),
    end: new Date(endMs),
  };
}

export function isBurstActive(date: Date = new Date()): boolean {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  const isFridayAfter18UTC = day === 5 && hour >= 17;
  const isSaturday = day === 6;
  const isSundayBefore18UTC = day === 0 && hour < 17;
  if (isFridayAfter18UTC) return true;
  if (isSaturday) return true;
  if (isSundayBefore18UTC) return true;
  return false;
}
