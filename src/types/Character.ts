export interface FightHistory {
  date: number; // Timestamp
  opponentName: string;
  won: boolean;
  xpGained: number;
}

export interface PendingFightOpponent {
  firestoreId?: string;
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
}

export interface PendingFight {
  status: 'searching' | 'matched';
  startedAt: number;
  opponent?: PendingFightOpponent;
  matchType?: 'balanced' | 'similar';
}

export interface Character {
  id?: number;
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
  avatar?: string; // Optional fallback

  // Daily System
  fightsLeft: number;
  lastFightReset: number; // Timestamp
  firestoreId?: string; // For updates
  isBot?: boolean; // To identify automated characters
  fightHistory?: FightHistory[];
  foughtToday?: string[]; // Array of firestoreIds fought today
  statPoints?: number; // Unspent stat points from level-ups
  inventory?: string[]; // Item ids
  equipped?: {
    weapon?: string;
    armor?: string;
    accessory?: string;
  };
  lastLootRoll?: number; // Timestamp (UTC) of daily lootbox roll
  pendingFight?: PendingFight;
}
