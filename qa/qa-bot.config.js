export default {
  baseUrl: process.env.QA_BASE_URL || 'https://bitbrawler.vercel.app',
  fightsPerRun: 5,
  pveCount: 2,
  /** Fraction of fights that should be PvE (e.g. 0.33 = every 3rd fight). Set env QA_PVE_RATIO. */
  pveRatio: parseFloat(process.env.QA_PVE_RATIO || '0.33'),
  /** If true, all fights are PvE. Set env QA_PVE_ONLY=true. */
  pveOnly: process.env.QA_PVE_ONLY === 'true',
  fightTimeout: parseInt(process.env.QA_FIGHT_TIMEOUT || '45000', 10),
  /** Idle PvE observation duration in ms. Set env QA_IDLE_OBSERVATION_MS. */
  idleObservationMs: parseInt(process.env.QA_IDLE_OBSERVATION_MS || '20000', 10),
  /** Global run time budget in ms (workflow timeout is 10 min). Set env QA_TIME_BUDGET_MS. */
  timeBudgetMs: parseInt(process.env.QA_TIME_BUDGET_MS || '480000', 10),
  screenshotsDir: './screenshots',
  statsFile: './stats.json',
  stateFile: './state.json',
  timeZone: process.env.QA_TIME_ZONE || 'Europe/Paris',
  headless: process.env.QA_HEADLESS !== 'false',
  slowMo: parseInt(process.env.QA_SLOW_MO || '0', 10),
  /** Level at which PvP mode becomes available */
  pvpUnlockLevel: 1,
  /** Level at which Forge (Salvage) becomes available */
  forgeUnlockLevel: 1,
  /** Level at which Shop becomes available */
  shopUnlockLevel: 20,
}
