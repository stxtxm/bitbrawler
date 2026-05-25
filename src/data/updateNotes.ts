export type UpdateNote = {
  version: string;
  date: string;
  title: string;
  changes: string[];
  archived?: boolean;
};

export const UPDATE_NOTES: UpdateNote[] = [
  {
    version: '2.3.0',
    date: '2026-05-25',
    title: 'Stats tooltips, XP alignment & code cleanup',
    changes: [
      'Stat tooltips: detailed descriptions for all 6 stats (STR/VIT/DEX/LUK/INT/FOC) with retro pixel tooltip component on hover.',
      'STAT_DESCRIPTIONS lookup table in statUtils.ts with short and long descriptions for each stat.',
      'Tooltips integrated in Arena compact stats, CharacterCreation stat cards, and LevelUpOverlay.',
      'Pending fight XP values aligned with GAME_RULES.COMBAT: XP_WIN=100, XP_LOSS=25 (was hardcoded 50/20).',
      'calculatePendingFightXp moved from GameContext to persistenceUtils for consistency.',
      'QA bot XP regex improved: targets "+N XP" format for more reliable stat capture.',
      'Removed orphaned duplicate SCSS file _arena-level-up.scss.',
      'Tech-lead workflow YAML indentation fixed for reliable parsing.',
      'Custom pixel tooltip component (_tooltip.scss) with retro border, arrow, multi-line & touch-device support.',
      '256 tests passing across 41 test files.',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-05-25',
    title: 'Bot-engine rebalance, QA enrichment & codebase cleanup',
    changes: [
      'HP tracking now captures max HP growth (character progression) instead of current HP — game restores HP after every fight.',
      'Lootbox rarity captured in QA stats (.lootbox-result-rarity + .lootbox-stat-value).',
      'Bot-engine: skipped bots with 0 fights left AND no lootbox AND no daily reset — no wasted DB queries.',
      'Bot protection rebalanced: protect only ~10 level-1 bots (opponent pool) instead of ~40 — 30+ bots fight and level up each run.',
      'Newly spawned bots (reserve + growth) are exempt from protection — they fight immediately to provide active opponents.',
      'New config MIN_LVL1_PROTECTED=5 ensures enough opponents for 1 new player even at minimum population.',
      'selectProtectedLevelOneBotIds extracted to botBehaviorUtils.ts with proper BotCharacter type (Character + firestoreId + battleCount).',
      'QA stats analyzer script (scripts/analyze-qa-stats.ts) with HP growth, loot rarity distribution, multi-window trends, min/max/median durations.',
      'Stats reset: corrupted data from level-up overlay bug removed — fresh start.',
      'Tech-lead workflow updated with structured 6-section analysis (HP, rarities, trends, stats).',
      'Removed dead code: scripts/bot-data.ts (unused BOT_LEVEL_TARGETS).',
      '256 tests passing (was 242), 14 new unit tests for protection logic with exemptFromProtection.',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-05-25',
    title: 'AI-driven fixes, QA automation & flag unification',
    changes: [
      'Level-up overlay properly handled by QA bot (stat allocation + retry before FIGHT click).',
      '$isBot$ and $autoMode$ flags unified: toggling auto mode now also sets $isBot$, bot engine uses single $is_bot = true$ query.',
      'QA bot fight timeout raised to 45s, CombatView $handleFinish$ now awaits $onComplete$ before closing.',
      'QA bot W/L stats capture fixed with combined regex and debug screenshot before reading.',
      'Level-up overlay dismissed at start of runFightSequence for reused characters with pending stat points.',
      'New test coverage for $setAutoMode$ sync, unified flag mapping, and Supabase failover scenarios.',
      '242 tests passing across 41 test files.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-05-24',
    title: 'Autonomous AI development',
    changes: [
      'AI now fully drives Bitbrawler development — coding, testing, reviewing, and deploying.',
      'QA E2E testing with Playwright: automated fights, lootbox rolls, and screenshot capture.',
      'GitHub Actions CI/CD: daily reset, bot activity, QA tester, tech lead, and opencode agent workflows.',
      'External cron scheduling via cron-job.org for reliable QA tester and bot activity triggers.',
      'Vite build with chunked bundles and Vercel deployment.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-24',
    title: 'Supabase migration & infrastructure',
    changes: [
      'Firebase Firestore replaced with Supabase (PostgreSQL).',
      'Bot engine and daily reset scripts migrated, offline snapshot fallback preserved.',
    ],
    archived: true,
  },
  {
    version: '0.9.0',
    date: '2026-05-17',
    title: 'Combat balance & XP progression',
    changes: [
      'Focus stat rebalanced, crit cap raised (30%), XP scaling improved.',
    ],
    archived: true,
  },
  {
    version: '0.8.0',
    date: '2026-02-15',
    title: 'Combat activity & lootbox tuning',
    changes: [
      'Bots use organic pacing, settings show incoming combat logs.',
    ],
    archived: true,
  },
  {
    version: '0.7.0',
    date: '2026-02-15',
    title: 'Daily reset reliability',
    changes: [
      'Reset window 23:00-01:00 Paris time, deduped scheduled runs.',
    ],
    archived: true,
  },
  {
    version: '0.6.0',
    date: '2026-02-14',
    title: 'Bot progression & fairness',
    changes: [
      'Minimum level 1 bots enforced, same-level opponent pools.',
    ],
    archived: true,
  },
  {
    version: '0.5.0',
    date: '2026-02-11',
    title: 'Arena UX refresh',
    changes: [
      'Settings modal, combat logs, read-only rankings.',
    ],
    archived: true,
  },
];
