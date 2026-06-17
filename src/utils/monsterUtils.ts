import { MONSTER_ASSETS, MonsterId, MonsterDef } from '../data/monsterAssets';
import { Character } from '../types/Character';
import { Element } from '../types/Item';
import { GAME_RULES } from '../config/gameRules';

const MONSTER_IDS: MonsterId[] = MONSTER_ASSETS.map(m => m.id);

export function getMonsterDef(id: MonsterId): MonsterDef | undefined {
  return MONSTER_ASSETS.find(m => m.id === id);
}

export function getRandomMonsterId(exclude?: MonsterId): MonsterId {
  const pool = exclude ? MONSTER_IDS.filter(id => id !== exclude) : MONSTER_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateMonster(monsterId: MonsterId, playerLevel: number): Character {
  const def = getMonsterDef(monsterId);
  if (!def) throw new Error(`Monster not found: ${monsterId}`);

  const level = Math.max(1, playerLevel + GAME_RULES.PVE.LEVEL_BOOST);
  const stat = (base: number, growth: number) => Math.round((base + (level - 1) * growth) * GAME_RULES.PVE.STAT_MULTIPLIER);

  const baseHp = Math.round((def.baseStats.hp + (level - 1) * def.growthRates.vitality * 8) * GAME_RULES.PVE.HP_MULTIPLIER);

  return {
    name: def.name,
    seed: `monster_${monsterId}`,
    gender: 'male',
    level: Math.max(1, playerLevel),
    experience: 0,
    strength: stat(def.baseStats.strength, def.growthRates.strength),
    vitality: stat(def.baseStats.vitality, def.growthRates.vitality),
    dexterity: stat(def.baseStats.dexterity, def.growthRates.dexterity),
    luck: stat(def.baseStats.luck, def.growthRates.luck),
    intelligence: stat(def.baseStats.intelligence, def.growthRates.intelligence),
    focus: stat(def.baseStats.focus, def.growthRates.focus),
    hp: baseHp,
    maxHp: baseHp,
    wins: 0,
    losses: 0,
    fightsLeft: 0,
    lastFightReset: Date.now(),
    isBot: true,
    equippedItems: { weapon: null, armor: null, accessory: null },
  };
}

export function generateMonsterForPlayer(playerLevel: number): { character: Character; def: MonsterDef } {
  const id = getRandomMonsterId();
  const def = getMonsterDef(id)!;
  return { character: generateMonster(id, playerLevel), def };
}

export function getMonsterElement(monsterId: MonsterId): Element {
  return getMonsterDef(monsterId)!.element;
}
