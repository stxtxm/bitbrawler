export const PROGRESSION_GATES = {
  PVP_UNLOCK_LEVEL: 1,
  FORGE_UNLOCK_LEVEL: 1,
  FUSION_UNLOCK_LEVEL: 15,
  UPGRADE_UNLOCK_LEVEL: 15,
  SHOP_UNLOCK_LEVEL: 20,
} as const;

export function isFeatureUnlocked(level: number, requiredLevel: number): boolean {
  return level >= requiredLevel;
}

export function getUnlockStatus(level: number, requiredLevel: number): { unlocked: boolean; level: number } {
  return {
    unlocked: level >= requiredLevel,
    level: requiredLevel,
  };
}
