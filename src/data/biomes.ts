import { Character } from '../types/Character';
import { MONSTER_ASSETS, MonsterId } from './monsterAssets';

export type BiomeId = 'plains' | 'volcanic' | 'abyssal';

export type BiomeDef = {
  id: BiomeId;
  label: string;
  unlockAt?: (character: Character) => boolean;
  monsterPool: MonsterId[];
  terrainSeed?: string;
};

const VOLCANIC_MONSTER_POOL: MonsterId[] = ['magma_golem', 'lava_hound', 'cinder_imp'];
const ABYSSAL_MONSTER_POOL: MonsterId[] = ['chimera', 'dragon_spawn', 'wraith'];
const PLAINS_MONSTER_POOL: MonsterId[] = MONSTER_ASSETS
  .filter((monster) => !VOLCANIC_MONSTER_POOL.includes(monster.id))
  .map((monster) => monster.id);

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
  },
  {
    id: 'abyssal',
    label: 'Abyssal Rift',
    unlockAt: (character) => {
      const abyssal = (character as any).bossProgresses?.abyssal_monarch ?? (character as any).abyssalBossProgress;
      if (abyssal) return true;
      const voidKills = (character as any).bossProgresses?.void_titan?.totalKills ?? character.bossProgress?.totalKills ?? 0;
      return character.level >= 58 && voidKills > 0;
    },
    monsterPool: ABYSSAL_MONSTER_POOL,
  },
];

export function getBiomeForCharacter(character: Character): BiomeDef {
  const abyssal = BIOMES.find((b) => b.id === 'abyssal' && b.unlockAt?.(character));
  if (abyssal) return abyssal;
  const volcanic = BIOMES.find((b) => b.id === 'volcanic' && b.unlockAt?.(character));
  if (volcanic) return volcanic;
  return BIOMES[0];
}

export function getBiomeMonsterPool(biomeId: BiomeId): MonsterId[] {
  const biome = BIOMES.find((candidate) => candidate.id === biomeId);
  return biome?.monsterPool ?? BIOMES[0].monsterPool;
}
