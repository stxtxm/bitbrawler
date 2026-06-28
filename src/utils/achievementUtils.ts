import { Character } from '../types/Character';
import { ItemRarity, PixelItemAsset } from '../types/Item';
import {
  AchievementDef,
  AchievementProgress,
  AchievementProgressMap,
  AchievementReward,
  ACHIEVEMENT_DEFS,
  AchievementCategory,
} from '../data/achievements';

export { ACHIEVEMENT_DEFS, ACHIEVEMENT_IDS, ACHIEVEMENT_CATEGORIES } from '../data/achievements';
export type {
  AchievementDef,
  AchievementProgress,
  AchievementProgressMap,
  AchievementReward,
  AchievementCategory,
  AchievementRewardType,
} from '../data/achievements';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const getAchievementDefs = (): AchievementDef[] => ACHIEVEMENT_DEFS;

export const getDefaultAchievementProgress = (): AchievementProgressMap => {
  const map: AchievementProgressMap = {};
  for (const def of ACHIEVEMENT_DEFS) {
    map[def.id] = { completed: false, progress: 0, target: def.target };
  }
  return map;
};

/**
 * Group achievements by category.
 */
export const getAchievementsByCategory = (): Record<AchievementCategory, AchievementDef[]> => {
  const grouped: Record<string, AchievementDef[]> = {};
  for (const def of ACHIEVEMENT_DEFS) {
    const cat = def.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(def);
  }
  return grouped as Record<AchievementCategory, AchievementDef[]>;
};

/**
 * Count completed achievements from a progress map.
 */
export const getCompletedCount = (progress: AchievementProgressMap): number => {
  return Object.values(progress).filter(p => p.completed).length;
};

/**
 * Get the total number of achievement definitions.
 */
export const getTotalAchievementCount = (): number => ACHIEVEMENT_DEFS.length;

// ─── Fight History Helpers ───────────────────────────────────────────────────

/**
 * Calculate the longest consecutive win streak from fight history (starting from most recent).
 */
function getConsecutiveWins(history: Character['fightHistory']): number {
  if (!history || history.length === 0) return 0;
  let streak = 0;
  for (const entry of history) {
    if (entry.won) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Count how many times the player won after 2+ consecutive losses.
 */
function getComebackCount(history: Character['fightHistory']): number {
  if (!history || history.length < 2) return 0;
  let count = 0;
  let lossStreak = 0;
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

// ─── Progress Calculators ────────────────────────────────────────────────────

/**
 * Calculate combat achievement progress from character stats.
 */
export const calculateCombatAchievements = (
  character: Character,
): Record<string, AchievementProgress> => {
  const wins = character.wins || 0;
  const history = character.fightHistory || [];
  const consecutiveWins = getConsecutiveWins(history);
  const comebackCount = getComebackCount(history);

  return {
    first_blood: {
      completed: wins >= 1,
      progress: Math.min(wins, 1),
      target: 1,
    },
    warrior_path: {
      completed: wins >= 10,
      progress: Math.min(wins, 10),
      target: 10,
    },
    battle_hardened: {
      completed: wins >= 50,
      progress: Math.min(wins, 50),
      target: 50,
    },
    gladiator: {
      completed: wins >= 100,
      progress: Math.min(wins, 100),
      target: 100,
    },
    arena_legend: {
      completed: wins >= 500,
      progress: Math.min(wins, 500),
      target: 500,
    },
    win_streak_3: {
      completed: consecutiveWins >= 3,
      progress: Math.min(consecutiveWins, 3),
      target: 3,
    },
    win_streak_5: {
      completed: consecutiveWins >= 5,
      progress: Math.min(consecutiveWins, 5),
      target: 5,
    },
    win_streak_10: {
      completed: consecutiveWins >= 10,
      progress: Math.min(consecutiveWins, 10),
      target: 10,
    },
    comeback_king: {
      completed: comebackCount >= 1,
      progress: Math.min(comebackCount, 1),
      target: 1,
    },
  };
};

/**
 * Calculate PvE achievement progress from PvE stats.
 */
export const calculatePveAchievements = (
  pveWins: number,
  monsterKills: Record<string, number> = {},
): Record<string, AchievementProgress> => {
  const goblinKills = monsterKills['GOBLIN'] ?? 0;
  const ogreKills = monsterKills['OGRE'] ?? 0;
  const wraithKills = monsterKills['WRAITH'] ?? 0;
  const allMonstersKilled = goblinKills >= 1 && ogreKills >= 1 && wraithKills >= 1;

  return {
    pve_beginner: {
      completed: pveWins >= 10,
      progress: Math.min(pveWins, 10),
      target: 10,
    },
    pve_veteran: {
      completed: pveWins >= 50,
      progress: Math.min(pveWins, 50),
      target: 50,
    },
    pve_master: {
      completed: pveWins >= 200,
      progress: Math.min(pveWins, 200),
      target: 200,
    },
    monster_hunter_goblin: {
      completed: goblinKills >= 10,
      progress: Math.min(goblinKills, 10),
      target: 10,
    },
    monster_hunter_ogre: {
      completed: ogreKills >= 10,
      progress: Math.min(ogreKills, 10),
      target: 10,
    },
    monster_hunter_wraith: {
      completed: wraithKills >= 10,
      progress: Math.min(wraithKills, 10),
      target: 10,
    },
    bestiary_complete: {
      completed: allMonstersKilled,
      progress: allMonstersKilled ? 1 : 0,
      target: 1,
    },
  };
};

/**
 * Calculate collection achievement progress from inventory.
 */
export const calculateCollectionAchievements = (
  inventory: string[],
  itemAssets?: PixelItemAsset[],
): Record<string, AchievementProgress> => {
  // Count items by rarity in inventory
  const commonCount = itemAssets
    ? inventory.filter(id => {
        const asset = itemAssets.find(a => a.id === id);
        return asset?.rarity === 'common';
      }).length
    : 0;

  const uncommonCount = itemAssets
    ? inventory.filter(id => {
        const asset = itemAssets.find(a => a.id === id);
        return asset?.rarity === 'uncommon';
      }).length
    : 0;

  const rareCount = itemAssets
    ? inventory.filter(id => {
        const asset = itemAssets.find(a => a.id === id);
        return asset?.rarity === 'rare';
      }).length
    : 0;

  const epicCount = itemAssets
    ? inventory.filter(id => {
        const asset = itemAssets.find(a => a.id === id);
        return asset?.rarity === 'epic';
      }).length
    : 0;

  const legendaryCount = itemAssets
    ? inventory.filter(id => {
        const asset = itemAssets.find(a => a.id === id);
        return asset?.rarity === 'legendary';
      }).length
    : 0;

  return {
    common_collector: {
      completed: commonCount >= 10,
      progress: Math.min(commonCount, 10),
      target: 10,
    },
    uncommon_collector: {
      completed: uncommonCount >= 10,
      progress: Math.min(uncommonCount, 10),
      target: 10,
    },
    rare_collector: {
      completed: rareCount >= 5,
      progress: Math.min(rareCount, 5),
      target: 5,
    },
    epic_collector: {
      completed: epicCount >= 3,
      progress: Math.min(epicCount, 3),
      target: 3,
    },
    legendary_collector: {
      completed: legendaryCount >= 1,
      progress: Math.min(legendaryCount, 1),
      target: 1,
    },
  };
};

/**
 * Calculate leveling achievement progress.
 */
export const calculateLevelingAchievements = (
  level: number,
  totalXp: number,
): Record<string, AchievementProgress> => {
  return {
    novice: {
      completed: level >= 5,
      progress: Math.min(level, 5),
      target: 5,
    },
    adventurer: {
      completed: level >= 10,
      progress: Math.min(level, 10),
      target: 10,
    },
    veteran: {
      completed: level >= 20,
      progress: Math.min(level, 20),
      target: 20,
    },
    master: {
      completed: level >= 50,
      progress: Math.min(level, 50),
      target: 50,
    },
    xp_collector: {
      completed: totalXp >= 1000,
      progress: Math.min(totalXp, 1000),
      target: 1000,
    },
    xp_hoarder: {
      completed: totalXp >= 10000,
      progress: Math.min(totalXp, 10000),
      target: 10000,
    },
  };
};

/**
 * Calculate equipment achievement progress from equipped items.
 */
export const calculateEquipmentAchievements = (
  equippedItems: Character['equippedItems'],
  itemAssets?: PixelItemAsset[],
): Record<string, AchievementProgress> => {
  const equipped = equippedItems ?? { weapon: null, armor: null, accessory: null };
  const slots = [equipped.weapon, equipped.armor, equipped.accessory];
  const equippedCount = slots.filter(Boolean).length;

  // Determine the minimum rarity among equipped items to check full sets
  let minRarity: ItemRarity | 'none' = 'none';
  const equippedIds = slots.filter((id): id is string => id !== null);
  if (equippedIds.length === 3 && itemAssets) {
    const rarities = equippedIds.map(id => {
      const asset = itemAssets.find(a => a.id === id);
      return asset?.rarity;
    });
    if (rarities.every(r => r !== undefined)) {
      const rarityOrder: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const minIndex = Math.min(...rarities.map(r => rarityOrder.indexOf(r!)));
      minRarity = rarityOrder[minIndex];
    }
  }

  return {
    fully_equipped: {
      completed: equippedCount >= 3,
      progress: Math.min(equippedCount, 3),
      target: 3,
    },
    style_points: {
      completed: minRarity === 'rare' || minRarity === 'epic' || minRarity === 'legendary',
      progress: minRarity === 'rare' || minRarity === 'epic' || minRarity === 'legendary' ? 1 : 0,
      target: 1,
    },
    epic_wardrobe: {
      completed: minRarity === 'epic' || minRarity === 'legendary',
      progress: minRarity === 'epic' || minRarity === 'legendary' ? 1 : 0,
      target: 1,
    },
    complete_set: {
      completed: minRarity === 'legendary',
      progress: minRarity === 'legendary' ? 1 : 0,
      target: 1,
    },
  };
};

/**
 * Calculate forge achievement progress.
 */
export const calculateForgeAchievements = (
  fusionCount: number,
  salvageCount: number,
  maxUpgradeLevel: number,
): Record<string, AchievementProgress> => {
  return {
    apprentice_smith: {
      completed: fusionCount >= 1,
      progress: Math.min(fusionCount, 1),
      target: 1,
    },
    seasoned_smith: {
      completed: fusionCount >= 10,
      progress: Math.min(fusionCount, 10),
      target: 10,
    },
    master_smith: {
      completed: fusionCount >= 50,
      progress: Math.min(fusionCount, 50),
      target: 50,
    },
    salvager: {
      completed: salvageCount >= 10,
      progress: Math.min(salvageCount, 10),
      target: 10,
    },
    scrapper: {
      completed: salvageCount >= 100,
      progress: Math.min(salvageCount, 100),
      target: 100,
    },
    upgrader: {
      completed: maxUpgradeLevel >= 5,
      progress: Math.min(maxUpgradeLevel, 5),
      target: 5,
    },
  };
};

// ─── Main Check Function ─────────────────────────────────────────────────────

export interface AchievementCheckResult {
  newlyUnlocked: AchievementDef[];
  progress: AchievementProgressMap;
}

export interface AchievementExtraContext {
  pveWins?: number;
  monsterKills?: Record<string, number>;
  fusionCount?: number;
  salvageCount?: number;
  maxUpgradeLevel?: number;
  glassCannonFight?: boolean;
  pacifistFight?: boolean;
  luckyDayRoll?: boolean;
  totalXpEarned?: number;
  pveStreak?: number;
  equippedSetRarity?: ItemRarity | null;
  allMonstersKilled?: boolean;
}

/**
 * Check all achievements against current character state and return newly unlocked achievements.
 *
 * @param character - Current character state
 * @param currentProgress - Current achievement progress map
 * @param itemAssets - Item asset definitions for collection/equipment checks
 * @param extraContext - Optional extra context for PvE, forge, and secret achievements
 * @returns Object with newly unlocked achievements and updated progress
 */
export const checkAchievements = (
  character: Character,
  currentProgress: AchievementProgressMap,
  itemAssets: PixelItemAsset[],
  extraContext?: AchievementExtraContext,
): AchievementCheckResult => {
  const inventory = character.inventory || [];
  const level = character.level || 1;
  const totalXp = extraContext?.totalXpEarned ?? character.experience ?? 0;

  // Calculate progress for each category
  const combatProgress = calculateCombatAchievements(character);
  const pveProgress = calculatePveAchievements(
    extraContext?.pveWins ?? 0,
    extraContext?.monsterKills ?? {},
  );
  const collectionProgress = calculateCollectionAchievements(inventory, itemAssets);
  const levelingProgress = calculateLevelingAchievements(level, totalXp);
  const equipmentProgress = calculateEquipmentAchievements(character.equippedItems, itemAssets);
  const forgeProgress = calculateForgeAchievements(
    extraContext?.fusionCount ?? 0,
    extraContext?.salvageCount ?? 0,
    extraContext?.maxUpgradeLevel ?? 0,
  );

  // Merge calculated progress with existing progress
  const updatedProgress: AchievementProgressMap = { ...currentProgress };
  const newlyUnlocked: AchievementDef[] = [];

  const allCalculated: Record<string, AchievementProgress> = {
    ...combatProgress,
    ...pveProgress,
    ...collectionProgress,
    ...levelingProgress,
    ...equipmentProgress,
    ...forgeProgress,
  };

  // Handle secret achievements from extra context
  if (extraContext?.luckyDayRoll) {
    allCalculated['lucky_break'] = {
      completed: true,
      progress: 1,
      target: 1,
    };
  }
  if (extraContext?.glassCannonFight) {
    allCalculated['close_call'] = {
      completed: true,
      progress: 1,
      target: 1,
    };
  }
  if (extraContext?.pacifistFight) {
    allCalculated['flawless'] = {
      completed: true,
      progress: 1,
      target: 1,
    };
  }

  // Preserve existing progress for secret achievements not in extra context
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.category === 'secret' && !allCalculated[def.id]) {
      allCalculated[def.id] = currentProgress[def.id] || {
        completed: false,
        progress: 0,
        target: def.target,
      };
    }
  }

  for (const def of ACHIEVEMENT_DEFS) {
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

// ─── Reward Applier ──────────────────────────────────────────────────────────

/**
 * Apply an achievement reward to a character.
 * Returns a new character object with the reward applied.
 */
export const applyAchievementReward = (character: Character, reward: AchievementReward): Character => {
  const updated = { ...character };

  switch (reward.type) {
    case 'essence': {
      const value = reward.value ?? 0;
      updated.essence = (updated.essence ?? 0) + value;
      updated.achievementEssenceBonus = (updated.achievementEssenceBonus ?? 0) + value;
      break;
    }
    case 'title': {
      updated.achievementTitle = reward.title ?? null;
      break;
    }
    case 'lootbox': {
      // Track bonus lootbox entitlement as a cosmetic flag
      const cosmetics = updated.achievementCosmetics ?? [];
      if (!cosmetics.includes('bonus_lootbox')) {
        updated.achievementCosmetics = [...cosmetics, 'bonus_lootbox'];
      }
      break;
    }
    case 'cosmetic': {
      const cosmetics = updated.achievementCosmetics ?? [];
      if (reward.cosmeticId && !cosmetics.includes(reward.cosmeticId)) {
        updated.achievementCosmetics = [...cosmetics, reward.cosmeticId];
      }
      break;
    }
    case 'xp_bonus': {
      const value = reward.value ?? 1;
      updated.achievementXpBonus = (updated.achievementXpBonus ?? 0) + value;
      break;
    }
    case 'stat_point': {
      const value = reward.value ?? 1;
      if (reward.stat) {
        updated[reward.stat] = ((updated as any)[reward.stat] ?? 10) + value;
      }
      break;
    }
  }

  return updated;
};
