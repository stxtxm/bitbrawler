export type UpdateNote = {
  version: string;
  date: string;
  title: string;
  changes: string[];
};

export const UPDATE_NOTES: UpdateNote[] = [
  {
    version: '2.1.0',
    date: '2026-05-25',
    title: 'Full feature catalog — pixel art, sound, PWA, inventory & more',
    changes: [
      'Procedural pixel art rendering system: seed-based character generation with 15 head variants, 7 skin tones, 9 hair colors, 6 body types, and 18 unique pixel icons.',
      'Sound system powered by Web Audio API synthesis: 8 retro sound effects (nav, click, hit, crit, levelup, lootbox, victory, defeat) with volume and toggle controls.',
      'PWA support with install prompt component, service worker (v3 caching), Web App Manifest with maskable icons, Apple touch icons, and standalone mode detection.',
      'Full inventory system: 24-slot grid, 3 equipment slots (weapon/armor/accessory), 4 rarities (common to epic), 10 tiers, 21 items with stat bonuses and pixel art icons.',
      'Character creation page with themed name generator (6 pools: nature, elemental, shadow, tech, mythic, celestial), gender selection, stat re-rolling, and DB uniqueness check.',
      'Rankings page (Hall of Fame) with top character listing and alpha DB reset tool.',
      'Custom 404 page with sad pixel character artwork.',
      'Level-up overlay with manual stat point allocation, auto-allocate to lowest stat, and auto-dismiss after 12s.',
      'Matchmaking system: exact-level matching, power-based sorting, fought-today exclusion, random pick from top 3 closest-power opponents.',
      'Fight energy system: 5 fights per day, visual energy pips, fight button states (FIGHT!/REST NOW/OFFLINE).',
      'Pending fight reconnect resolution for interrupted combat sessions.',
      'Combat log analysis with action type detection (hit/crit/magic/miss/counter) and archetype labels (Berserker, Tank, Speedster, Mage, Sharpshooter).',
      'Lazy-loaded pages with React.lazy() and arena prefetching via requestIdleCallback for faster navigation.',
      'Online/offline detection with connection gate, retry mechanism via server_time ping, and offline mode banner.',
      'Haptic feedback (navigator.vibrate) on fight start and name generation for tactile immersion.',
      'Auto-mode delegation: human players with auto-mode enabled are processed alongside bots during bot engine runs.',
      'Error boundary component for crash recovery and StatusScreen component for info/warning/error states.',
      'Focus trap hook for accessible modal keyboard navigation.',
      'GitHub Actions CI/CD: 6 automated workflows (CI checks, daily reset, bot activity, QA tester, tech lead, opencode agent).',
      'QA E2E testing system using Playwright: automated character creation, fight sequences, lootbox checks, auto-mode verification, and screenshot capture.',
      'Vite build optimizations with manual chunking (router, react, vendor) and Vercel deployment configuration.',
      '239 tests passing across 41 test files — unit, integration, and component tests.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-05-24',
    title: 'AI takes the reins — autonomous development',
    changes: [
      'AI is now fully in charge of Bitbrawler development — from code to deployment.',
      'Every feature, fix, and patch note (including this one) is crafted by an autonomous AI agent.',
      'The project enters a new era of self-evolving, AI-driven development.',
      'No human intervention required — the AI designs, codes, reviews, and ships everything.',
      'All future updates will be autonomously conceived and delivered by AI.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-24',
    title: 'Supabase migration & infrastructure',
    changes: [
      'Firebase Firestore replaced with Supabase as the database backend.',
      'All character data, matchmaking, and fight logic now runs on PostgreSQL via Supabase.',
      'Bot engine and daily reset scripts migrated to Supabase with full end-to-end verification.',
      'GitHub Actions workflows updated to use Supabase secrets.',
      'Real-time offline support preserved with local storage snapshot fallback.',
      'Fixed test mocks for Supabase compatibility (179 tests passing).',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-05-17',
    title: 'Combat balance & XP progression',
    changes: [
      'Focus stat now contributes more to total power, hit accuracy, and magic surge chance.',
      'Focus surge is easier to trigger and deals more bonus damage.',
      'Critical hit cap raised from 28% to 30% for luck-focused builds.',
      'Comeback mechanic slightly stronger when low on HP.',
      'XP earned per fight scales faster at high levels (8% per level instead of 5%).',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-02-15',
    title: 'Organic combat activity',
    changes: [
      'Bots now attack random targets with organic pacing and finish remaining fights before daily reset.',
      'Arena settings combat logs now include incoming attacks without exposing attacker type and without XP lines.',
      'Early lootboxes now include extra low-power level 1 common and uncommon items.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-02-15',
    title: 'Daily reset reliability',
    changes: [
      'Reset window now covers 23:00-01:00 (Europe/Paris).',
      'Duplicate scheduled runs are deduped with a maintenance reset key.',
      'Daily lootbox and fight reset stay aligned to the same Paris day.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-02-14',
    title: 'Bot progression & fairness',
    changes: [
      'Minimum level 1 bot population is enforced each run.',
      'Bots use same-level opponent pools and shared combat logic.',
      'Bot growth and activity cadence were tuned for stable matchmaking pools.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-02-11',
    title: 'Arena UX refresh',
    changes: [
      'Settings modal now owns auto mode, logs, and safe delete flow.',
      'Combat logs moved into settings for cleaner arena HUD.',
      'Rankings list became read-only with internal scrolling.',
    ],
  },
];
