export default {
  baseUrl: process.env.QA_BASE_URL || 'https://bitbrawler.vercel.app',
  fightsPerRun: 5,
  pveCount: 2,
  /** Fraction of fights that should be PvE (e.g. 0.33 = every 3rd fight). Set env QA_PVE_RATIO. */
  pveRatio: parseFloat(process.env.QA_PVE_RATIO || '0.33'),
  /** If true, all fights are PvE. Set env QA_PVE_ONLY=true. */
  pveOnly: process.env.QA_PVE_ONLY === 'true',
  fightTimeout: parseInt(process.env.QA_FIGHT_TIMEOUT || '90000', 10),
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
  /** Level at which all Forge tabs (Salvage + Fusion + Upgrade) are unlocked */
  forgeUnlockLevel: 6,
  /** Level at which Shop becomes available */
  shopUnlockLevel: 5,
  /** Persistent QA character (#731): reuse a dedicated character across runs so
   *  equipment, streak, essence, shop purchases and mid-game levels accumulate
   *  (longitudinal data). Set env QA_PERSISTENT_CHARACTER=false to disable. */
  persistentCharacter: process.env.QA_PERSISTENT_CHARACTER !== 'false',
  /** Fixed name of the persistent QA character (created once, reused forever). */
  persistentCharacterName: process.env.QA_PERSISTENT_CHARACTER_NAME || 'QA-PERSIST',
  /** Day of week (0=Sunday..6=Saturday) for the weekly fresh-character run used
   *  to calibrate the first-session experience (#473). Default 1 = Monday. */
  freshCharacterDay: parseInt(process.env.QA_FRESH_CHARACTER_DAY || '1', 10),
  /** Recreate the persistent character once it reaches this level (controlled
   *  reset, #731). Default 30 = the boss unlock cap. */
  persistentCharacterMaxLevel: parseInt(process.env.QA_PERSISTENT_MAX_LEVEL || '30', 10),
  /** Recreate the persistent character once it is older than this many days
   *  (controlled reset by age, #731). 0 disables the age-based reset. */
  persistentCharacterMaxAgeDays: parseInt(process.env.QA_PERSISTENT_MAX_AGE_DAYS || '30', 10),
}
