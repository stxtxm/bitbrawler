export interface QaBotConfig {
  baseUrl: string
  fightsPerRun: number
  pveCount: number
  pveRatio: number
  pveOnly: boolean
  fightTimeout: number
  screenshotsDir: string
  statsFile: string
  stateFile: string
  timeZone: string
  headless: boolean
  slowMo: number
  pvpUnlockLevel: number
  forgeUnlockLevel: number
  shopUnlockLevel: number
}

declare const config: QaBotConfig
export default config
