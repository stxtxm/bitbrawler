import { Character } from '../types/Character';
import { PixelItemAsset } from '../types/Item';
import {
  MedalDef,
  MedalProgress,
  MedalProgressMap,
  MedalReward,
  MEDAL_DEFS,
  MEDAL_IDS,
} from '../data/medals';

export { MEDAL_DEFS, MEDAL_IDS, MEDAL_CATEGORIES } from '../data/medals';
export type { MedalDef, MedalProgress, MedalProgressMap, MedalReward, MedalCategory, MedalRewardType, MedalStat } from '../data/medals';

export const getMedalDefs = (): MedalDef[] => MEDAL_DEFS;

export const getDefaultMedalProgress = (): MedalProgressMap => {
  const map: MedalProgressMap = {};
  for (const id of MEDAL_IDS) {
    map[id] = { completed: false, progress: 0 };
  }
  return map;
};

/**
 * Calculate the longest consecutive win streak from fight history.
 */
function getConsecutiveWins(history: Character['fightHistory']): number {
  if (!history || history.length === 0) return 0;
  let streak = 0;
  for (const entry of history) {
    if (entry.won) {
      streak++;
    } else {
      break; // Streak broken
    }
  }
  return streak;
}

/**
 * Calculate the number of times the player won after 2+ consecutive losses.
 */
function getComebackCount(history: Character['fightHistory']): number {
  if (!history || history.length < 2) return 0;

  let count = 0;
  let lossStreak = 0;

  // Iterate from oldest to newest to detect wins after loss streaks
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry.won) {
      if (lossStreak >= 2) {
        count++;
      }
      lossStreak = 0;
    } else {
      lossStreak++;
    }
  }
  return count;
}

/**
 * Calculate combat medal progress from character stats.
 */
export const calculateCombatProgress = (
  character: Character,
): Record<string, MedalProgress> => {
  const wins = character.wins || 0;
  const history = character.fightHistory || [];
  const consecutiveWins = getConsecutiveWins(history);
  const comebackCount = getComebackCount(history);

  return {
    first_blood: {
      completed: wins >= 1,
      progress: Math.min(wins, 1),
    },
    brawler: {
      completed: wins >= 10,
      progress: Math.min(wins, 10),
    },
    warrior: {
      completed: wins >= 50,
      progress: Math.min(wins, 50),
    },
    legend: {
      completed: wins >= 100,
      progress: Math.min(wins, 100),
    },
    unstoppable: {
      completed: consecutiveWins >= 5,
      progress: Math.min(consecutiveWins, 5),
    },
    comeback_king: {
      completed: comebackCount >= 1,
      progress: Math.min(comebackCount, 1),
    },
  };
};

/**
 * Calculate loot medal progress from inventory and equipped items.
 */
export const calculateLootProgress = (
  inventory: string[],
  itemAssets?: PixelItemAsset[],
  equipped?: Character['equippedItems'],
): Record<string, MedalProgress> => {
  const uniqueCount = inventory.length;

  // Count rare+ items in inventory
  const rarePlusCount = itemAssets
    ? inventory.filter(id => {
        const asset = itemAssets.find(a => a.id === id);
        return asset && (asset.rarity === 'rare' || asset.rarity === 'epic' || asset.rarity === 'legendary');
      }).length
    : 0;

  // Count epic+ items in inventory
  const epicPlusCount = itemAssets
    ? inventory.filter(id => {
        const asset = itemAssets.find(a => a.id === id);
        return asset && (asset.rarity === 'epic' || asset.rarity === 'legendary');
      }).length
    : 0;

  // Count equipped slots filled
  const equippedItems = equipped ?? { weapon: null, armor: null, accessory: null };
  const equippedCount = [
    equippedItems.weapon,
    equippedItems.armor,
    equippedItems.accessory,
  ].filter(Boolean).length;

  return {
    collector: {
      completed: uniqueCount >= 10,
      progress: Math.min(uniqueCount, 10),
    },
    rare_hunter: {
      completed: rarePlusCount >= 3,
      progress: Math.min(rarePlusCount, 3),
    },
    epic_seeker: {
      completed: epicPlusCount >= 1,
      progress: Math.min(epicPlusCount, 1),
    },
    fully_equipped: {
      completed: equippedCount >= 3,
      progress: Math.min(equippedCount, 3),
    },
  };
};

/**
 * Calculate progression medal progress.
 */
export const calculateProgressionProgress = (
  level: number,
  sessionCount: number,
): Record<string, MedalProgress> => {
  return {
    growing_strong: {
      completed: level >= 5,
      progress: Math.min(level, 5),
    },
    peak_performance: {
      completed: level >= 10,
      progress: Math.min(level, 10),
    },
    level_master: {
      completed: level >= 20,
      progress: Math.min(level, 20),
    },
    veteran: {
      completed: sessionCount >= 10,
      progress: Math.min(sessionCount, 10),
    },
  };
};

/**
 * Check all medals against current character state and return newly unlocked medals.
 *
 * @param character - Current character state
 * @param currentProgress - Current medal progress map
 * @param itemAssets - Item asset definitions for loot medal checks
 * @param extraContext - Optional extra context for special medals
 * @returns Object with newly unlocked medals and updated progress
 */
export interface MedalCheckResult {
  newlyUnlocked: MedalDef[];
  progress: MedalProgressMap;
}

export interface SpecialMedalContext {
  /** Was a fight just won with <10 HP remaining? */
  glassCannonFight?: boolean;
  /** Was a fight just won with 0 damage taken? */
  pacifistFight?: boolean;
  /** Was an epic+ item just obtained from the first lootbox? */
  luckyDayRoll?: boolean;
  /** Number of daily sessions completed */
  sessionCount?: number;
}

export const checkMedals = (
  character: Character,
  currentProgress: MedalProgressMap,
  itemAssets: PixelItemAsset[],
  extraContext?: SpecialMedalContext,
): MedalCheckResult => {
  const inventory = character.inventory || [];

  // Calculate progress for each category
  const combatProgress = calculateCombatProgress(character);
  const lootProgress = calculateLootProgress(inventory, itemAssets, character.equippedItems);
  const progressionProgress = calculateProgressionProgress(
    character.level || 1,
    extraContext?.sessionCount ?? 0,
  );

  // Merge calculated progress with existing progress
  const updatedProgress: MedalProgressMap = { ...currentProgress };
  const newlyUnlocked: MedalDef[] = [];

  const allCalculated: Record<string, MedalProgress> = {
    ...combatProgress,
    ...lootProgress,
    ...progressionProgress,
  };

  // For special medals, handle extra context
  if (extraContext?.glassCannonFight) {
    allCalculated['glass_cannon'] = {
      completed: true,
      progress: 1,
    };
  }
  if (extraContext?.pacifistFight) {
    allCalculated['pacifist'] = {
      completed: true,
      progress: 1,
    };
  }
  if (extraContext?.luckyDayRoll) {
    allCalculated['lucky_day'] = {
      completed: true,
      progress: 1,
    };
  }

  // For special medals not in extra context, preserve existing progress
  for (const def of MEDAL_DEFS) {
    if (def.category === 'special' && !allCalculated[def.id]) {
      allCalculated[def.id] = currentProgress[def.id] || { completed: false, progress: 0 };
    }
  }

  for (const def of MEDAL_DEFS) {
    const calculated = allCalculated[def.id];
    if (!calculated) continue;

    const existing = currentProgress[def.id];

    // Update progress
    updatedProgress[def.id] = {
      ...calculated,
      unlockedAt: existing?.unlockedAt,
    };

    // Check if newly completed
    if (calculated.completed && (!existing || !existing.completed)) {
      updatedProgress[def.id] = {
        ...calculated,
        completed: true,
        unlockedAt: Date.now(),
      };
      newlyUnlocked.push(def);
    }
  }

  return {
    newlyUnlocked,
    progress: updatedProgress,
  };
};

/**
 * Apply a medal reward to a character.
 * Mutates the character object and returns it.
 */
export const applyMedalReward = (character: Character, reward: MedalReward): Character => {
  const updated = { ...character };

  switch (reward.type) {
    case 'hp': {
      const bonus = reward.value ?? 1;
      updated.maxHp = (updated.maxHp || 100) + bonus;
      updated.hp = Math.min((updated.hp || 100) + bonus, updated.maxHp);
      break;
    }
    case 'stat_point': {
      const bonus = reward.value ?? 1;
      if (reward.label?.includes('all stats')) {
        updated.strength = (updated.strength || 10) + bonus;
        updated.vitality = (updated.vitality || 10) + bonus;
        updated.dexterity = (updated.dexterity || 10) + bonus;
        updated.luck = (updated.luck || 10) + bonus;
        updated.intelligence = (updated.intelligence || 10) + bonus;
        updated.focus = (updated.focus || 10) + bonus;
      } else if (reward.stat) {
        updated[reward.stat] = ((updated as any)[reward.stat] || 10) + bonus;
      }
      break;
    }
    case 'inventory_slot': {
      // Inventory slots are handled at the system level via INVENTORY_CAPACITY
      // This is a permanent bonus tracked in the character state
      updated.medalInventoryBonus = (updated.medalInventoryBonus ?? 0) + (reward.value ?? 1);
      break;
    }
    case 'xp_bonus': {
      updated.medalXpBonus = (updated.medalXpBonus ?? 0) + (reward.value ?? 1);
      break;
    }
    case 'title': {
      updated.medalTitle = 'The Legend';
      break;
    }
    case 'aura': {
      updated.medalAura = true;
      break;
    }
  }

  return updated;
};

/**
 * Get the total count of unlocked medals.
 */
export const getUnlockedCount = (progress: MedalProgressMap): number => {
  return Object.values(progress).filter(p => p.completed).length;
};

/**
 * Get the total number of medals.
 */
export const getTotalMedalCount = (): number => MEDAL_DEFS.length;

/**
 * Get medals sorted by category, then by required progress.
 */
export const getMedalsByCategory = (): Record<string, MedalDef[]> => {
  const grouped: Record<string, MedalDef[]> = {};
  for (const def of MEDAL_DEFS) {
    const cat = def.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(def);
  }
  return grouped;
};
