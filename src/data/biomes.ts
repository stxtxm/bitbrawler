import { MONSTER_ASSETS, MonsterId } from './monsterAssets';
import { Character } from '../types/Character';

export type BiomeId = 'plains' | 'volcanic';

export interface BiomeDef {
  id: BiomeId;
  label: string;
  unlockAt?: (character: Character) => boolean;
  monsterPool: MonsterId[];
  terrainSeed?: string;
}

const PLAINS_MONSTER_POOL: MonsterId[] = MONSTER_ASSETS.map(m => m.id);

const VOLCANIC_MONSTER_POOL: MonsterId[] = PLAINS_MONSTER_POOL;

export const BIOMES: BiomeDef[] = [
  {
    id: 'plains',
    label: 'Plains',
    monsterPool: PLAINS_MONSTER_POOL,
  },
  {
    id: 'volcanic',
    label: 'Volcanic',
    unlockAt: (character) => (character.bossProgress?.totalKills ?? 0) > 0,
    monsterPool: VOLCANIC_MONSTER_POOL,
    terrainSeed: 'volcanic',
  },
];

export function getBiomeForCharacter(character: Character): BiomeDef {
  const unlocked = BIOMES.find(biome => biome.unlockAt && biome.unlockAt(character));
  if (unlocked) return unlocked;
  return BIOMES.find(biome => !biome.unlockAt) ?? BIOMES[0];
}

export function getBiomeMonsterPool(biomeId: BiomeId): MonsterId[] {
  return BIOMES.find(biome => biome.id === biomeId)?.monsterPool ?? [];
}
