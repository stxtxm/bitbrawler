import { Character } from '../types/Character';
import { MONSTER_ASSETS, MonsterId } from './monsterAssets';

export type BiomeId = 'plains' | 'volcanic' | 'mountain' | 'abyssal' | 'eclipse';

const MOUNTAIN_MONSTER_POOL: MonsterId[] = ['goblin', 'ogre', 'skeleton', 'slime', 'wolf'];

export type BiomeDef = {
  id: BiomeId;
  label: string;
  unlockAt?: (character: Character) => boolean;
  monsterPool: MonsterId[];
  terrainSeed?: string;
  /** Multiplicateur de gains idle (XP/essence). Plus le biome est avancé, plus il récompense. */
  rewardMultiplier: number;
};

const VOLCANIC_MONSTER_POOL: MonsterId[] = ['magma_golem', 'lava_hound', 'cinder_imp'];
const ABYSSAL_MONSTER_POOL: MonsterId[] = ['chimera', 'dragon_spawn', 'wraith'];
const ECLIPSE_MONSTER_POOL: MonsterId[] = ['chimera', 'dragon_spawn', 'wraith', 'magma_golem'];
const PLAINS_MONSTER_POOL: MonsterId[] = MONSTER_ASSETS
  .filter((monster) => !VOLCANIC_MONSTER_POOL.includes(monster.id))
  .map((monster) => monster.id);

function getVoidTitanKills(character: Character): number {
  const anyChar = character as any;
  return (
    anyChar.bossProgresses?.void_titan?.totalKills ??
    character.bossProgress?.totalKills ??
    0
  );
}

function getStoneColossusKills(character: Character): number {
  const anyChar = character as any;
  return anyChar.bossProgresses?.stone_colossus?.totalKills ?? 0;
}

function getFrostpeakKills(character: Character): number {
  const anyChar = character as any;
  return (
    anyChar.bossProgresses?.abyssal_monarch?.totalKills ??
    anyChar.abyssalBossProgress?.totalKills ??
    0
  );
}

export const BIOMES: BiomeDef[] = [
  {
    id: 'plains',
    label: 'Plains',
    monsterPool: PLAINS_MONSTER_POOL,
    rewardMultiplier: 1,
  },
  {
    id: 'volcanic',
    label: 'Volcanic',
    unlockAt: (character) => getVoidTitanKills(character) > 0,
    monsterPool: VOLCANIC_MONSTER_POOL,
    rewardMultiplier: 1.2,
  },
  {
    id: 'mountain',
    label: 'Mountain',
    // Débloqué après la victoire sur le boss lvl 40 (Stone Colossus).
    unlockAt: (character) => getStoneColossusKills(character) > 0,
    monsterPool: MOUNTAIN_MONSTER_POOL,
    rewardMultiplier: 1.35,
  },
  {
    id: 'abyssal',
    label: 'Frostpeak',
    // Débloqué après la victoire sur le boss lvl 60 (Frostpeak Monarch).
    unlockAt: (character) => getFrostpeakKills(character) > 0,
    monsterPool: ABYSSAL_MONSTER_POOL,
    rewardMultiplier: 1.5,
  },
  {
    id: 'eclipse',
    label: 'Eclipse',
    // Préparé : débloqué par le prochain boss endgame. Inaccessible pour l'instant.
    unlockAt: () => false,
    monsterPool: ECLIPSE_MONSTER_POOL,
    rewardMultiplier: 1.7,
  },
];

const BIOME_ORDER: BiomeId[] = ['eclipse', 'abyssal', 'mountain', 'volcanic', 'plains'];

export function isBiomeUnlocked(character: Character, biomeId: BiomeId): boolean {
  const biome = BIOMES.find((b) => b.id === biomeId);
  if (!biome) return false;
  if (!biome.unlockAt) return true;
  return biome.unlockAt(character);
}

export function getUnlockedBiomes(character: Character): BiomeDef[] {
  return BIOMES.filter((biome) => isBiomeUnlocked(character, biome.id));
}

function getBiomeStorageKey(character: Character): string {
  return `bitbrawler_selected_biome_${character.id ?? character.seed ?? 'local'}`;
}

export function getSelectedBiomeId(character: Character): BiomeId | null {
  try {
    const raw = localStorage.getItem(getBiomeStorageKey(character));
    if (raw === 'plains' || raw === 'volcanic' || raw === 'abyssal' || raw === 'mountain' || raw === 'eclipse') return raw;
  } catch { /* ignore */ }
  return null;
}

export function setSelectedBiomeId(character: Character, biomeId: BiomeId): void {
  try {
    localStorage.setItem(getBiomeStorageKey(character), biomeId);
  } catch { /* ignore */ }
}

export function getBiomeForCharacter(character: Character): BiomeDef {
  const selected = getSelectedBiomeId(character);
  if (selected && isBiomeUnlocked(character, selected)) {
    const biome = BIOMES.find((b) => b.id === selected);
    if (biome) return biome;
  }
  for (const id of BIOME_ORDER) {
    if (isBiomeUnlocked(character, id)) {
      const biome = BIOMES.find((b) => b.id === id);
      if (biome) return biome;
    }
  }
  return BIOMES[0];
}

export function getBiomeRewardMultiplier(biomeId: BiomeId): number {
  return BIOMES.find((b) => b.id === biomeId)?.rewardMultiplier ?? 1;
}

export function getBiomeMonsterPool(biomeId: BiomeId): MonsterId[] {
  const biome = BIOMES.find((candidate) => candidate.id === biomeId);
  return biome?.monsterPool ?? BIOMES[0].monsterPool;
}
