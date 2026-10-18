export interface QaBotConfig {
  baseUrl: string
  fightsPerRun: number
  pveCount: number
  pveRatio: number
  pveOnly: boolean
  fightTimeout: number
  idleObservationMs: number
  timeBudgetMs: number
  screenshotsDir: string
  statsFile: string
  stateFile: string
  timeZone: string
  headless: boolean
  slowMo: number
  pvpUnlockLevel: number
  forgeUnlockLevel: number
  shopUnlockLevel: number
  persistentCharacter: boolean
  persistentCharacterName: string
  freshCharacterDay: number
  persistentCharacterMaxLevel: number
  persistentCharacterMaxAgeDays: number
  /** Cohortes QA v2 (#1230) : profils de dépense par tranche de niveau. */
  cohorts: Array<{
    name: string
    minLevel?: number
    maxLevel?: number
    essenceBudget: number
  }>
  /** Cohorte forcée pour ce run (QA_COHORT), sinon résolution par niveau. */
  cohort: string | null
}

declare const config: QaBotConfig
export default config
