export interface IdleCombatEntry {
  timestamp: number
  monsterId: string
  monsterName: string
  won: boolean
  xpGained: number
  damageTaken: number
}

export type ScenePhase = 'running' | 'monster_appears' | 'combat' | 'result'

export interface IdleEfficiencyData {
  powerRatio: number
  efficiency: number
  effectiveInterval: number
  xpPerMinute: number
  streakBonus: number
  streakMilestone: number | null
}
