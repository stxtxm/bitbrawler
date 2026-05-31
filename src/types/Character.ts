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
}

export interface PendingFight {
  status: 'searching' | 'matched';
  startedAt: number;
  opponent?: PendingFightOpponent;
  matchType?: 'balanced' | 'similar';
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
}
