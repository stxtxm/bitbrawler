export interface FightHistory {
  date: number; // Timestamp
  opponentName: string;
  won: boolean;
  xpGained?: number;
}

export interface IncomingFightHistory {
  date: number; // Timestamp
  attackerName: string;
  attackerId?: string;
  attackerIsBot?: boolean;
  won: boolean; // Defender perspective
  source?: 'player' | 'bot';
}

export interface PendingFightOpponent {
  id?: string;
  name: string;
  gender: 'male' | 'female';
  seed: string;
  level: number;
  experience: number;
  strength: number;
  vitality: number;
  dexterity: number;
  luck: number;
  intelligence: number;
  focus: number;
  hp: number;
  maxHp: number;
  wins: number;
  losses: number;
  fightsLeft: number;
  lastFightReset: number;
  isBot?: boolean;
  inventory?: string[];
  equippedItems?: {
    weapon: string | null;
    armor: string | null;
    accessory: string | null;
  };
}

export interface PendingFight {
  status: 'searching' | 'matched';
  startedAt: number;
  opponent?: PendingFightOpponent;
  matchType?: 'balanced' | 'similar' | 'pve';
}

import { ItemRarity, PixelItemAsset } from './Item';

// ─── Forge System Types ────────────────────────────────────────────────────

/**
 * Result from salvaging a single item.
 */
export interface SalvageResult {
  itemId: string;
  itemName: string;
  rarity: ItemRarity;
  essenceYield: number;
}

/**
 * Result from performing a fusion of 3 items.
 */
export interface FusionResult {
  success: boolean;
  resultItem: PixelItemAsset | null;
  essenceConsumed: number;
  itemsConsumed: string[];
  lucky: boolean;
}

/**
 * Result from upgrading an item.
 */
export interface UpgradeResult {
  success: boolean;
  itemId: string;
  previousLevel: number;
  newLevel: number;
  essenceConsumed: number;
}

/**
 * Describes a forge recipe — the inputs, cost, and expected output of a fusion.
 */
export interface ForgeRecipe {
  inputItems: PixelItemAsset[];
  inputRarity: ItemRarity;
  outputRarity: ItemRarity;
  essenceCost: number;
  lucky: boolean;
}

export interface Character {
  id?: string;
  seed: string;
  name: string;
  gender: 'male' | 'female';
  level: number;
  experience: number;

  // Simplified RPG Stats (4 Stats System)
  strength: number;  // Force
  vitality: number;  // Vitalité / Endurance
  dexterity: number; // Dexterité / Précision
  luck: number;      // Chance / Critiques
  intelligence: number; // Intelligence / Magie
  focus: number;     // Focus / Précision / Contrôle

  // Derived
  hp: number;
  maxHp: number;

  wins: number;
  losses: number;

  // Daily System
  fightsLeft: number;
  pveFightsLeft?: number; // PvE fights remaining (separate pool)
  lastFightReset: number; // Timestamp
  isBot?: boolean; // To identify automated characters
  autoMode?: boolean; // Human-controlled character delegated to the bot engine
  fightHistory?: FightHistory[];
  incomingFightHistory?: IncomingFightHistory[]; // Incoming attacks (no XP/progression impact)
  foughtToday?: string[]; // Array of ids fought today
  statPoints?: number; // Unspent stat points from level-ups
  inventory?: string[]; // Item ids
  lastLootRoll?: number; // Timestamp (UTC) of daily lootbox roll
  lootboxStreak?: number; // Consecutive daily lootbox claims
  pendingFight?: PendingFight;
  equippedItems?: {
    weapon: string | null;
    armor: string | null;
    accessory: string | null;
  };

  // Idle/PvE stats
  idleStreak?: number;
  idleMaxStreak?: number;
  idleTotalKills?: number;
  idleTotalXp?: number;

  // Forge system
  essence?: number; // Essence resource for forging/upgrading
  itemUpgrades?: Record<string, number>; // Upgrade levels per item (0-MAX_UPGRADE_LEVEL)

  // Server-side idle processing watermark (timestamp)
  lastIdleCheck?: number;
  // Last user activity (for offline popup, timestamp)
  lastActive?: number;

  // Medal / Achievement system
  medalProgress?: Record<string, { completed: boolean; progress: number; unlockedAt?: number }>;
  medalInventoryBonus?: number; // Extra inventory slots from medal rewards
  medalXpBonus?: number; // Bonus XP on win from medal rewards
  medalTitle?: string; // Cosmetic title from medal
  medalAura?: boolean; // Cosmetic aura from medal

  // Monster kill tracking (per monster type for PvE medals)
  monsterKills?: Record<string, number>;

  // Achievement system
  achievementProgress?: Record<string, { completed: boolean; progress: number; target: number; unlockedAt?: number }>;
  achievementTitle?: string | null; // Cosmetic title prefix shown in Hall of Fame
  achievementXpBonus?: number; // Permanent XP bonus per win from achievements
  achievementEssenceBonus?: number; // One-time essence bonus tracking (not the essence itself)
  achievementCosmetics?: string[]; // Unlocked cosmetic flags
}
