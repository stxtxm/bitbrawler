import { Character } from '../types/Character';
import { MONSTER_ASSETS, MonsterId } from './monsterAssets';

export type BiomeId = 'plains' | 'volcanic';

export type BiomeDef = {
  id: BiomeId;
  label: string;
  unlockAt?: (character: Character) => boolean;
  monsterPool: MonsterId[];
  terrainSeed?: string;
};

const CURRENT_MONSTER_POOL: MonsterId[] = MONSTER_ASSETS.map((monster) => monster.id);

export const BIOMES: BiomeDef[] = [
  {
    id: 'plains',
    label: 'Plains',
    monsterPool: CURRENT_MONSTER_POOL,
  },
  {
    id: 'volcanic',
    label: 'Volcanic',
    unlockAt: (character) => (character.bossProgress?.totalKills ?? 0) > 0,
    monsterPool: CURRENT_MONSTER_POOL,
  },
];

export function getBiomeForCharacter(character: Character): BiomeDef {
  const unlocked = BIOMES.find(
    (biome) => biome.unlockAt !== undefined && biome.unlockAt(character),
  );
  return unlocked ?? BIOMES[0];
}

export function getBiomeMonsterPool(biomeId: BiomeId): MonsterId[] {
  const biome = BIOMES.find((candidate) => candidate.id === biomeId);
  return biome?.monsterPool ?? BIOMES[0].monsterPool;
}
