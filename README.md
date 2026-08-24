# BITBRAWLER - 8-Bit Arena

<p align="center">
  <img src="public/icon.svg" alt="Bitbrawler Logo" width="128" height="128" />
</p>

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/stxtxm/bitbrawler/ci.yml?branch=master&label=CI&logo=github" alt="CI Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite" alt="Vite 5" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/PWA-ready-5A0FC8" alt="PWA Ready" />
</p>

Bitbrawler is a **retro 8-bit arena experience** where players create a pixel fighter, battle in the arena, and climb the Hall of Fame. Built with React, TypeScript, and Supabase. The entire development process is **autonomous** using OpenCode agents.

---

## 🚀 Quick Start

### For Players
- Visit **[bitbrawler.vercel.app](https://bitbrawler.vercel.app)** to play live
- Create a character and start fighting!

### For Developers
See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, development guidelines, and how to contribute.

### For AI/OpenCode Agents
See [AGENTS.md](AGENTS.md) for autonomous agent workflows and responsibilities.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Quick Links](#quick-links)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [CI/CD & Workflows](#cicd--workflows)
- [Autonomous Development](#autonomous-development)
- [License](#license)

---

## Features

- **8-bit UI** with SVG pixel rendering
- **Character creation** with RPG stats (STR, VIT, DEX, LUK, INT, FOC)
- **Arena fights** with XP gain, level ups, and enhanced combat (crit + magic + focus)
- **PvE Monster Battles** — fight 11 8-bit monsters (Goblin/Ogre/Wraith/Slime/Wolf/Skeleton/Chimera/Dragon Spawn + Magma Golem/Lava Hound/Cinder Imp from the volcanic biome) with separate energy pool (5 fights/day), idle combat scene with phase animations (monster appears → combat → result) and auto-resolve
- **Auto level-up** — stat points auto-allocate by archetype weights (primary 3×, secondary 1.5×, others 0.5×) with in-scene gold glow FX + floating "⬆ LVL X!" text
- **Strict same-level matchmaking** with power balancing, daily opponent rotation, and animated opponent scan
- **Daily lootbox + inventory** — 140+ items across 3 slots (weapon/armor/accessory), 5 rarities (common→legendary), stat bonuses including HP
- **Equipment loadouts** — manual equip/unequip with 6 weapon elements (fire/water/wind/earth/light/dark), affinity system (+15% damage vs bot archetypes)
- **6 bot archetypes** (bruiser/tank/rogue/mage/lucky/zen) with elemental weakness mapping
- **Equipment Forge** — salvage unwanted items for essence (fractional counter in header with .toFixed(2) display), fuse 3 same-rarity items for a higher tier, spend essence to upgrade stats up to +5
- **🏪 8-Bit Emporium (Shop)** — onglet Shop dans la Forge : 4 offres quotidiennes dont 1 item épique garanti, achetées contre de l'essence. Possibilité de relancer les offres une fois par jour pour 25 essence.
- **🏅 PvE Medal System** — 25 médailles PvE : 16 médailles de chasseur (8 monstres × 2 paliers : 5/25 kills), 3 médailles de streak PvE (3/5/10 victoires consécutives), 6 médailles de progression haute (niveaux 30/50/75/100/150/200). Les médailles sont vérifiées automatiquement après chaque combat.
- **Monster kill tracking** — chaque monstre affronté en PvE est enregistré. Les kills cumulés débloquent les médailles de chasseur. Visible dans le panneau des médailles.
- **Progression déverrouillée dès le level 1** — PvP et Forge accessibles immédiatement après la création du personnage. Plus de paliers de déblocage.
- **Courbe XP monotone** (EARLY_SHIFT=0) — coût exponentiel croissant dès le niveau 1 (~5-15 kills par niveau en early game), sans spam de montées de niveau.
- **Essence doublée en début de jeu** — les nouveaux joueurs accumulent 2× plus d'essence pour forger et acheter au Shop dès leurs premiers combats.
- **11 pixel monsters** — Goblin, Ogre, Wraith (all levels), Slime (1-8), Wolf (5-18), Skeleton (10-28), Chimera (20-40), Dragon Spawn (30-50) with tiered difficulty and specialty growth rates, plus volcanic biome exclusives Magma Golem, Lava Hound, Cinder Imp
- **Efficiency panel** — always visible XP/min with next-level ETA, power/speed/magic ratios, and streak bonus
- **Offline gains** — when reconnecting, popup shows fights/XP/essence/levels earned while away, claim with one click
- **Bot engine** — population management with organic activity pacing, depleted-bot skipping, and protection rebalance
- **Global daily reset** — scripted resets at midnight (Paris) for fights and opponent tracking
- **Hall of Fame** rankings with real-time updates
- **PWA** install experience (works offline)
- **🔔 Push notifications & session reminders** — opt-in web push ("Se rappeler de moi") with auto nudges for streak in danger, daily lootbox ready, and new events (max 1/day, no spam)
- **🐉 Raid Boss PvE (VOID TITAN)** — unlocked at level 30, a 3rd Arena mode: 5 daily attacks against a persistent HP-pool boss (no regen between attacks/days), kill grants 4× XP + 60 essence and starts a fresh, tougher cycle. Boss stats scale with the player (see [BOSS_PVE.md](BOSS_PVE.md))
- **🌋 Biome engine** — data-driven idle PvE biomes: the **volcanic biome** unlocks after your first boss kill and brings a scrolling parallax backdrop (BiomeTerrain: volcanoes, lava flows, ash, embers) plus 3 exclusive fire monsters (Magma Golem, Lava Hound, Cinder Imp). Next biomes (forest, desert, abyss…) plug in via `src/data/biomes.ts` without touching components.
- **Autonomous CI/CD** with agent-driven development — bot PRs are always review-gated: opencode.yml re-dispatches CI even when the head commit carries a `[skip ci]` marker, and the reviewer runs the full lint/tsc/tests/build gate itself whenever a PR has no CI checks

## Architecture Overview

Bitbrawler is a **frontend-first game** with a thin serverless layer:

```
┌─────────────────────────────────────────────┐
│  React SPA (Vite build → Vercel CDN)        │
│  ┌───────────────────────────────────────┐  │
│  │ GameContext (src/context/GameContext) │  │  ← global state, Supabase sync, persistence
│  └───────────────┬───────────────────────┘  │
│                  │ useGame()                │
│  ┌───────────────▼───────────────────────┐  │
│  │ Feature hooks (src/hooks/)            │  │  ← useArenaCombat, useIdleCombat,
│  │  useInventory, useSettings,           │  │    useInventory, useSettings,
│  │  useArenaLevelUp, useSound, ...       │  │    useArenaLevelUp, ...
│  └───────────────┬───────────────────────┘  │
│                  │ props / view models      │
│  ┌───────────────▼───────────────────────┐  │
│  │ Presentational components             │  │  ← arena/, forge/, procedural/
│  │  (src/components/)                    │  │    + shared components
│  └───────────────────────────────────────┘  │
└──────────────┬──────────────────────────────┘
               │ Supabase SDK
┌──────────────▼──────────────────────────────┐
│  Supabase Backend (PostgreSQL + Auth)       │
└─────────────────────────────────────────────┘
               ▲
┌──────────────┴──────────────────────────────┐
│  Vercel Serverless API (api/idle-processor) │  ← offline idle combat processing
└─────────────────────────────────────────────┘
```

**Data flow**: `GameContext` exposes `useGame()` — the single source of truth for the
active character and all game actions (fights, lootbox, equipment, forge, shop, medals).
Feature-specific hooks (`useArenaCombat`, `useIdleCombat`, `useInventory`, `useSettings`,
`useArenaLevelUp`, `useSound`) consume `useGame()` and produce **view models / props** that
are passed down to presentational components in `src/components/arena/` (ActionPanel,
CharacterDisplay, InventoryPanel, SettingsPanel, StatsPanel, ...) and `src/components/forge/`
(SalvagePanel, FusionPanel, UpgradePanel, ShopPanel). All game logic lives in pure utilities
under `src/utils/` and static data under `src/data/`.

**Refactoring note**: `src/pages/Arena.tsx` was refactored from 1066 → 244 lines (Phase 3) by
extracting state into hooks (`useInventory`, `useSettings`, `useArenaCombat`) and UI into
`src/components/arena/` components. New arena features should follow this pattern: hook for
state + presentational component for UI. See [AGENTS.md](AGENTS.md) for the full refactoring workflow.

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical design, database schema, system overview |
| [WORKFLOWS.md](WORKFLOWS.md) | CI/CD pipelines, GitHub Actions, deployment flow |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, coding conventions, PR process |
| [AGENTS.md](AGENTS.md) | OpenCode agent workflows, responsibilities, automation |
| [TESTING.md](TESTING.md) | Testing guidelines, test structure, writing tests |
| [BOSS_PVE.md](BOSS_PVE.md) | Raid boss system: mechanics, balance invariants, persistence, tests |

---

## Tech Stack

| Layer          | Technology                                      |
| -------------- | ----------------------------------------------- |
| Frontend       | React 18 + TypeScript + Vite                    |
| Backend / Auth | Supabase (PostgreSQL, real-time, auth)          |
| Testing        | Vitest + React Testing Library + jsdom — **1482 tests, 99 files**          |
| Styling        | Sass (SCSS)                                     |
| Fonts          | Press Start 2P (via Fontsource)                 |
| Scripting      | tsx (TypeScript executor)                       |
| CI/CD          | GitHub Actions + OpenCode + Vercel              |
| E2E Testing    | Playwright                                      |

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/stxtxm/bitbrawler.git
cd bitbrawler
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
# Fill in your Supabase URL and anon key
```

### 4. Run locally
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

**See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup instructions.**

---

## Scripts

```bash
# Development
npm run dev                        # Start Vite dev server (localhost:3000)
npm run preview                    # Preview production build

# Testing & Quality
npm test                           # Run test suite (Vitest — 1482 tests, 99 files)
npm run lint                       # ESLint check
npm run build                      # TypeScript check + Vite production build

# Game Systems (for testing)
npm run bots:run                   # Run bot simulation engine once
npm run daily-reset:run            # Run daily reset script once

# Analytics
npx tsx scripts/analyze-qa-stats.ts  # Analyze QA stats (HP growth, loot rarity, trends)
```

See [WORKFLOWS.md](WORKFLOWS.md) for how these scripts are used in CI/CD.

---

## Project Structure

```
bitbrawler/
├── .github/workflows/              # GitHub Actions CI/CD pipelines
│   ├── ci.yml                      # Lint, type check, test, build
│   ├── opencode.yml                # OpenCode agent implementation workflow
│   ├── reviewer.yml                # Auto code review + merge
│   ├── tech-lead.yml               # Daily analysis + issue creation
│   ├── qa-tester.yml               # Playwright E2E tests (live site)
│   ├── bot-activity.yml            # Scheduled bot engine runs
│   └── daily-reset.yml             # Scheduled global daily reset
│
├── .opencode/                      # OpenCode agent configuration
│   ├── agents/                     # Agent definitions
│   │   ├── dev-agent.md            # Autonomous developer
│   │   ├── reviewer.md             # Autonomous code reviewer
│   │   ├── orchestrator.md         # Campaign planner
│   │   ├── supervisor.md           # Campaign validator
│   │   ├── tech-lead.md            # Autonomous tech lead
│   │   └── qa-tester.md            # Autonomous QA tester
│   └── memory/                     # Per-agent + shared learning memory
│       ├── shared.json             # Common constraints & known issues
│       ├── dev.json                # Dev agent lessons
│       └── ...                     # reviewer/orchestrator/supervisor/tech-lead/qa-tester
│
├── api/                            # Vercel serverless functions
│   └── idle-processor.ts           # Offline idle combat processing (on-demand + cron)
│
├── public/                         # Static assets
│   ├── sw.js                       # Service worker (PWA)
│   ├── icon.svg                    # App icon
│   └── icon-*.png                  # PWA manifest icons
│
├── scripts/                        # Automation scripts
│   ├── bot-engine.ts               # Bot simulation engine
│   ├── daily-reset-engine.ts       # Global daily reset logic
│   ├── idle-processor.ts           # Local testing version of idle processor
│   ├── push-notifier.ts            # Push notification sender
│   ├── analyze-qa-stats.ts         # QA stats analysis
│   ├── run-migration.ts            # Run SQL migrations
│   ├── reset-and-migrate.ts        # Reset + migrate database
│   ├── verify-stat-constraints.ts  # Verify stat constraints
│   └── supabaseAdmin.ts            # Supabase admin utilities
│
├── qa/                             # QA & E2E testing
│   ├── qa-bot.mjs                  # Playwright E2E tests
│   ├── qa-bot.config.js            # QA configuration
│   ├── stats.json                  # Fight stats (auto-generated)
│   └── state.json                  # QA bot persistent state
│
├── supabase/                       # Database migrations
│   └── migrations/                 # SQL migration files
│
├── src/
│   ├── components/                 # UI building blocks
│   │   ├── arena/                  # Arena sub-components (extracted from Arena.tsx)
│   │   │   ├── ActionPanel.tsx     # PvP/PvE/Boss fight actions
│   │   │   ├── ArenaHeader.tsx     # Character name, level, nav buttons
│   │   │   ├── CharacterDisplay.tsx# Scene + XP bar + stats
│   │   │   ├── ExperienceBar.tsx   # XP bar + gain popup + max level
│   │   │   ├── InventoryPanel.tsx  # Inventory modal (incl. Shop tab)
│   │   │   ├── SceneBox.tsx        # PvE idle runner vs PvP avatar
│   │   │   ├── SettingsPanel.tsx   # Settings modal (auto-mode, delete, logs, medals)
│   │   │   ├── StatsPanel.tsx      # Stat grid + HP + efficiency
│   │   │   └── arenaTypes.ts       # Shared arena types
│   │   ├── forge/                  # Forge sub-components
│   │   │   ├── SalvagePanel.tsx    # Salvage items → essence
│   │   │   ├── FusionPanel.tsx     # Fuse 3 items → higher tier
│   │   │   ├── UpgradePanel.tsx    # Upgrade stats with essence
│   │   │   └── ShopPanel.tsx       # 8-Bit Emporium (shop)
│   │   ├── procedural/             # Procedural terrain/biomes
│   │   │   ├── ProceduralTerrain.tsx
│   │   │   ├── BiomeTerrain.tsx
│   │   │   ├── biomeTerrainConfig.ts
│   │   │   └── terrainShared.ts
│   │   ├── AffinityBadge.tsx       # Weapon element badge
│   │   ├── CombatView.tsx          # Fight overlay (intro/VS/combat/result)
│   │   ├── ConnectionModal.tsx     # DB connection gate modal
│   │   ├── GameLogo.tsx            # 8-bit SVG logo
│   │   ├── IdleRunnerScene.tsx     # PvE idle combat scene with level-up FX
│   │   ├── LoadingScreen.tsx       # Loading spinner
│   │   ├── MedalCard.tsx           # PvE medal card
│   │   ├── MedalUnlockToast.tsx    # Medal unlock toast
│   │   ├── NotificationDisplay.tsx # Toast notification display
│   │   ├── PixelAssets.ts          # Pixel art asset definitions
│   │   ├── PixelCharacter.tsx      # Seed-based character SVG
│   │   ├── PixelIcon.tsx           # Generic 8×8 pixel icon
│   │   ├── PixelItemIcon.tsx       # Item sprite SVG
│   │   ├── PixelMonster.tsx        # Monster 16×16 SVG
│   │   ├── PushOptInBanner.tsx     # Push notification opt-in banner
│   │   ├── SceneBackground.tsx     # Idle scene background
│   │   ├── StatusScreen.tsx        # Status display component
│   │   ├── StreakIndicator.tsx     # Lootbox streak progress
│   │   └── ErrorBoundary.tsx       # React error boundary
│   │
│   ├── config/                     # Game configuration
│   │   ├── gameRules.ts            # Game constants & balance values
│   │   ├── idleConfig.ts           # Idle/essence/efficiency config
│   │   ├── progressionConfig.ts    # Feature unlock thresholds
│   │   ├── combatBalance.ts        # Combat formulas & scaling
│   │   ├── terrainConfig.ts        # Terrain quality scaling config
│   │   └── supabase.ts             # Supabase client initialization
│   │
│   ├── context/                    # React context (global state)
│   │   ├── GameContext.tsx         # "God context": character, fights, loot, forge, shop
│   │   └── NotificationContext.tsx # Toast notification queue
│   │
│   ├── data/                       # Static data
│   │   ├── itemAssets.ts           # Item definitions, stats, rarities
│   │   ├── monsterAssets.ts        # Monster definitions & palettes
│   │   ├── bossAssets.ts           # Raid boss definitions
│   │   ├── biomes.ts               # Biome definitions (plains, volcanic, ...)
│   │   ├── achievements.ts         # Achievement definitions
│   │   ├── medals.ts               # PvE medal definitions
│   │   ├── forgeConstants.ts       # Essence yield/fusion costs
│   │   ├── shopConstants.ts        # Shop offer config
│   │   ├── backgrounds.ts          # Scene background assets
│   │   └── updateNotes.ts          # Version history, patch notes
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── useArenaCombat.ts       # PvP/PvE/Boss combat orchestration
│   │   ├── useIdleCombat.ts        # Idle PvE combat engine (timers, efficiency)
│   │   ├── useInventory.ts         # Inventory/lootbox/equipment state
│   │   ├── useSettings.ts          # Settings modal + auto-mode + delete
│   │   ├── useArenaLevelUp.ts      # Level-up FX + stat allocation
│   │   ├── useConnectionGate.ts    # DB connection gate modal
│   │   ├── useNotification.ts      # Toast consumer
│   │   ├── useOnlineStatus.ts      # Online/offline detection
│   │   ├── usePushReminders.ts     # Push subscription management
│   │   ├── useSound.ts             # WebAudio sound effects
│   │   ├── useFocusTrap.ts         # Modal focus trap
│   │   ├── useLowPerformanceMode.ts# Low-perf device detection
│   │   └── useTerrainAnimation.ts  # Terrain RAF animation
│   │
│   ├── pages/                      # Route pages
│   │   ├── Arena.tsx               # Main arena (244 lines — refactored)
│   │   ├── Forge.tsx               # Forge page (salvage/fusion/upgrade/shop)
│   │   ├── Achievements.tsx        # Achievements page
│   │   ├── CharacterCreation.tsx
│   │   ├── HomePage.tsx
│   │   ├── Login.tsx
│   │   ├── Rankings.tsx
│   │   └── NotFound.tsx
│   │
│   ├── routes/                     # Lazy-loaded routes
│   │   └── lazyPages.ts            # React.lazy page imports
│   │
│   ├── styles/                     # Global Sass styles
│   │   ├── main.scss               # Entry point
│   │   ├── _variables.scss         # Design tokens
│   │   ├── base/                   # Reset, layout, typography, animations
│   │   ├── components/             # Per-component styles
│   │   └── pages/                  # Per-page styles
│   │
│   ├── test/                       # Vitest test suite (1482 tests, 99 files)
│   │   ├── unit/                   # Pure function tests
│   │   ├── components/             # Component tests (RTL)
│   │   ├── integration/            # Cross-system integration tests
│   │   └── utils/                  # Test helpers (router, supabaseMock)
│   │
│   ├── types/                      # TypeScript type definitions
│   │   ├── Character.ts
│   │   ├── Item.ts
│   │   └── IdleCombat.ts
│   │
│   └── utils/                      # Game logic utilities
│       ├── combatUtils.ts          # Fight calculations
│       ├── combatBalance.ts        # Combat balance formulas
│       ├── characterUtils.ts       # Character operations
│       ├── matchmakingUtils.ts     # Opponent selection
│       ├── lootboxUtils.ts         # Loot rarity & distribution
│       ├── xpUtils.ts              # XP & leveling
│       ├── equipmentUtils.ts       # Equipment, loadouts, bonuses
│       ├── forgeUtils.ts           # Salvage, fusion, upgrade
│       ├── shopUtils.ts            # Shop offers, purchases
│       ├── medalUtils.ts           # PvE medal logic
│       ├── achievementUtils.ts     # Achievement logic
│       ├── bossUtils.ts            # Raid boss logic
│       ├── monsterUtils.ts         # Monster generation
│       ├── idleEfficiencyUtils.ts  # Idle efficiency math
│       ├── idleXpUtils.ts          # Idle XP/essence math
│       ├── idleSnapshotUtils.ts    # Idle snapshot persistence
│       ├── persistenceUtils.ts     # localStorage + Supabase sync
│       ├── particleSystem.ts       # Pooled DOM particle effects
│       ├── statUtils.ts            # Stat allocation & scaling
│       ├── supabaseUtils.ts        # Supabase <-> app converters
│       ├── dailyReset.ts           # Daily reset helpers
│       ├── botBehaviorUtils.ts     # Bot logic
│       ├── pushNotifications.ts    # Web push helpers
│       ├── reminderScheduler.ts    # Session reminders
│       └── ...
│
├── .env.example                    # Environment template
├── AGENTS.md                       # OpenCode agent documentation
├── ARCHITECTURE.md                 # Technical design & system overview
├── WORKFLOWS.md                    # CI/CD & automation flows
├── CONTRIBUTING.md                 # Developer guidelines
├── TESTING.md                      # Testing guidelines
├── BOSS_PVE.md                     # Raid boss system docs
├── PLAN.md                         # Remaining work plan (phases 3-7)
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite build configuration
└── README.md                       # This file
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed database schema and system design.

---

## CI/CD & Workflows

Bitbrawler uses **automated GitHub Actions workflows** for continuous integration and deployment:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | PR opened/updated | Lint, type check, test, build |
| **OpenCode** | Issue with `/oc` | Autonomous agent implementation |
| **Reviewer** | PR created | Auto code review + merge if approved |
| **Tech Lead** | Daily @ 21h (Paris) | Analyze QA stats, create strategic issues |
| **QA Tester** | Manual / scheduled | Run E2E tests on live site, collect stats |
| **Bot Activity** | Manual / scheduled | Run bot simulation engine |
| **Daily Reset** | Daily @ 00h (Paris) | Reset characters, fights, opponent tracking |

**See [WORKFLOWS.md](WORKFLOWS.md) for detailed workflow documentation.**

---

## Autonomous Development

Bitbrawler uses [**OpenCode**](https://opencode.ai) agents for **autonomous development**:

| Agent | Role | Trigger |
|-------|------|---------|
| **dev-agent** | Implements features from issues (TDD) | `/oc` in issue body |
| **reviewer** | Reviews PRs, approves & merges | Automatic on PR |
| **orchestrator** | Decomposes complex issues into campaigns | `/proposal` or `proposition` label |
| **supervisor** | Validates campaigns, updates patch notes | All campaign sub-issues closed |
| **tech-lead** | Daily analysis, creates strategic issues | Scheduled @ 21h (Paris) |
| **qa-tester** | E2E tests on live site, collects stats | Manual / scheduled |

### How it works

1. **Create an issue** with `/oc` in the description
2. **dev-agent** implements the feature automatically (writes tests first, then code)
3. **CI checks** run (lint, type check, test, build)
4. **reviewer** reviews the code
5. **If approved** → automatic squash merge ✅
6. **If issues** → feedback on PR ❌

### Complex features

Features too large for a single implementation (3+ files or multiple subsystems) are
**decomposed by the orchestrator** into sub-issues labeled `campaign-<N>` + `sub-issue`,
each with its own `/oc`. The supervisor validates the full campaign once all sub-issues
are merged, bumps patch notes, and closes the parent issue. See [AGENTS.md](AGENTS.md).

**See [AGENTS.md](AGENTS.md) for detailed agent documentation.**

---

## 🔧 Offline Idle Processing (Cron)

The idle system uses an external free cron service to process inactive characters in batch.

### Configuration on cron-job.org

| Field | Value |
|-------|-------|
| URL | `https://bitbrawler.vercel.app/api/idle-processor` |
| Method | `POST` |
| Content-Type | `application/json` |
| Body | `{}` |
| Frequency | Every 1 minute |
| Timeout | 30s |

### How it works

1. **On-demand** (primary) — When a player returns to the game, the frontend calls `POST /api/idle-processor` with `{ character_id }`. This processes idle gains instantly.
2. **Cron fallback** (secondary) — The cron calls the same endpoint **without** `character_id`, which processes ALL characters with pending idle time. This handles bots and network failures.

### ⚠️ Important

- Reconfigure cron-job.org after each Vercel project URL change
- The cron is a fallback — idle gains are processed instantly when the player reconnects
- The `/api/idle-processor` cron mode only picks up characters with `last_idle_check` older than 60s, preventing double-processing

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Need Help?

- **Setup Issues?** → See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Want to contribute?** → Read [CONTRIBUTING.md](CONTRIBUTING.md)
- **Understanding workflows?** → Check [WORKFLOWS.md](WORKFLOWS.md)
- **How agents work?** → Read [AGENTS.md](AGENTS.md)
- **Testing guidelines?** → See [TESTING.md](TESTING.md)
- **Architecture questions?** → Check [ARCHITECTURE.md](ARCHITECTURE.md)
