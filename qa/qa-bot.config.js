export default {
  baseUrl: process.env.QA_BASE_URL || 'https://bitbrawler.vercel.app',
  fightsPerRun: 5,
  screenshotsDir: './screenshots',
  statsFile: './stats.json',
  headless: process.env.QA_HEADLESS !== 'false',
  slowMo: parseInt(process.env.QA_SLOW_MO || '0', 10),
}
