import type { MonsterId } from '../../data/monsterAssets';
import type { IdleEfficiencyData, ScenePhase } from '../../types/IdleCombat';
import type { ItemStats } from '../../types/Item';
import type { StatKey } from '../../utils/statUtils';

export type StatIconType = StatKey;

export interface ArenaStatOption {
  key: StatKey;
  label: string;
  value: number;
  hint: string;
  icon: StatIconType;
}

export interface ArenaIdleViewModel {
  currentMonster: MonsterId | null;
  scenePhase: ScenePhase;
  lastCombatResult: 'win' | 'lose' | null;
  lastCombatXp: number;
  offlineGains: { fights: number; xp: number; levels: number; essence: number; timeAway: number } | null;
  clearOfflineGains: () => void;
  recentLevelUp: { newLevel: number } | null;
  currentStreak: number;
  streakMilestone: number | null;
  efficiency: number | null;
  xpPerMinute: number | null;
  essencePerMinute: number | null;
  powerRatio: number | null;
  idleFightsCount: number;
  totalKills: number;
  efficiencyData: IdleEfficiencyData | null;
  remainingSeconds: number | null;
}

export type InventoryStatKey = keyof ItemStats;

export interface InventoryStatEntry {
  key: InventoryStatKey;
  value: number;
}

export type InventoryStatMetaMap = Record<InventoryStatKey, {
  icon: StatIconType;
  label: string;
}>;
