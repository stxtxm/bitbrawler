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
}
