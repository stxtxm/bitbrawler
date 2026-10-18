export default {
  baseUrl: process.env.QA_BASE_URL || 'https://bitbrawler.pages.dev',
  // 1 combat par run : la partie n'accorde que COMBAT.MAX_DAILY_FIGHTS (5) par
  // jour, et le premier run de la journée les consommait tous — les 2-3 runs
  // suivants cliquaient dans le vide (`fights: []`, motif `no_start`). Un
  // combat par run répartit l'allocation sur la journée : chaque run QA
  // rapporte désormais de vraies données au tech-lead.
  // Le mode reste PvP : le boss PvE est verrouillé sous le niveau 30, donc un
  // combat unique tenté en PvE serait perdu en repli. L'observation idle PvE
  // (idleObserveMs) continue de couvrir ce pan-là.
  fightsPerRun: parseInt(process.env.QA_FIGHTS_PER_RUN || '1', 10),
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
  /** Cohortes QA v2 (#1230). Le harnais ne mesurait qu'un profil — le
   *  persistant, qui thésaurise (435 💎 en moyenne pour une offre min à 24 💎)
   *  et achetait donc mécaniquement : real_purchase_rate saturé (83,8 %,
   *  100 % sur les 20 derniers runs), cinq cycles de hausse des prix +10 %
   *  (#1033→#1182) sans effet mesurable. Chaque cohorte cappe la dépense d'une
   *  offre à son budget : la métrique redevient sensible au prix, et le
   *  tech-lead l'analyse par profil.
   *
   *  Le profil est résolu depuis le niveau du personnage au DÉBUT du run (les
   *  générations du persistant traversent naturellement 1→30 ; le run
   *  « fresh character » hebdomadaire alimente QA-FRESH). `QA_COHORT` force un
   *  profil pour un run ciblé.
   *
   *  Les budgets reflètent l'essence qu'un joueur de ce stade peut réellement
   *  consacrer à UNE offre — pas la thésaurisation du bot. */
  cohorts: [
    { name: 'QA-FRESH', minLevel: 1, maxLevel: 5, essenceBudget: 50 },
    { name: 'QA-MID', minLevel: 6, maxLevel: 21, essenceBudget: 150 },
    { name: 'QA-END', minLevel: 22, essenceBudget: 400 },
  ],
  /** Cohorte forcée (QA-FRESH | QA-MID | QA-END) — QA_COHORT env. */
  cohort: process.env.QA_COHORT || null,
}
