export default {
  baseUrl: process.env.QA_BASE_URL || 'https://bitbrawler.vercel.app',
  fightsPerRun: 5,
  pveCount: 2,
  /** Fraction of fights that should be PvE (e.g. 0.33 = every 3rd fight). Set env QA_PVE_RATIO. */
  pveRatio: parseFloat(process.env.QA_PVE_RATIO || '0.33'),
  /** If true, all fights are PvE. Set env QA_PVE_ONLY=true. */
  pveOnly: process.env.QA_PVE_ONLY === 'true',
  fightTimeout: parseInt(process.env.QA_FIGHT_TIMEOUT || '45000', 10),
  screenshotsDir: './screenshots',
  statsFile: './stats.json',
  stateFile: './state.json',
  timeZone: process.env.QA_TIME_ZONE || 'Europe/Paris',
  headless: process.env.QA_HEADLESS !== 'false',
  slowMo: parseInt(process.env.QA_SLOW_MO || '0', 10),
}
