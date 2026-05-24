export default {
  baseUrl: process.env.QA_BASE_URL || 'https://bitbrawler.vercel.app',
  fightsPerRun: 5,
  screenshotsDir: './screenshots',
  statsFile: './stats.json',
  timeZone: process.env.QA_TIME_ZONE || 'Europe/Paris',
  autoModeStartHour: parseInt(process.env.QA_AUTO_MODE_START_HOUR || '19', 10),
  headless: process.env.QA_HEADLESS !== 'false',
  slowMo: parseInt(process.env.QA_SLOW_MO || '0', 10),
}
