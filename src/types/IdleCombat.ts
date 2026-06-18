export interface IdleCombatEntry {
  timestamp: number
  monsterId: string
  monsterName: string
  won: boolean
  xpGained: number
  damageTaken: number
}

export type ScenePhase = 'running' | 'monster_appears' | 'combat' | 'result'
