# BITBRAWLER - Architecture & Technical Design

This document describes the **technical architecture**, **database schema**, **game systems**, and **design patterns** used in Bitbrawler.

---

## Table of Contents

- [System Overview](#system-overview)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Database Schema](#database-schema)
- [Game Systems](#game-systems)
- [Key Design Patterns](#key-design-patterns)
- [Performance Considerations](#performance-considerations)

---

## System Overview

Bitbrawler is a **full-stack web application** with the following layers:

```
┌─────────────────────────────────────────┐
│        Frontend (React + TypeScript)     │
│   (Components, Pages, Game Logic)       │
└──────────────┬──────────────────────────┘
               │
        ┌──────▼─────────┐
        │  Supabase SDK  │
        └──────┬─────────┘
               │
┌──────────────▼──────────────────────────┐
│   Supabase Backend (PostgreSQL + Auth)  │
│   (Database, Real-time, Auth, Storage)  │
└─────────────────────────────────────────┘
```

### Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend Build** | Vite | Fast HMR development, production build |
| **Frontend Framework** | React 18 | UI rendering, state management |
| **Type Safety** | TypeScript 5 | Compile-time type checking |
| **Styling** | Sass (SCSS) | Component styling with nesting |
| **Testing** | Vitest + RTL | Unit & integration tests (1482 tests, 99 files) |
| **Database** | Supabase (PostgreSQL) | Relational data, real-time subscriptions |
| **Authentication** | Supabase Auth | Email/password auth with JWT |
| **CI/CD** | GitHub Actions | Automated testing, building, deployment |
| **Hosting** | Vercel | CDN, serverless deployment (app + API), preview PRs |
| **Autonomous Dev** | OpenCode Agents | AI-powered development automation |

### Architecture Layers

```
┌──────────────────────────────────────────┐
│         Frontend (React + TypeScript)     │
│   Vite build → Vercel CDN               │
│   (Components, Pages, Game Logic)       │
└──────────────┬───────────────────────────┘
               │
         ┌─────▼────────────┐
         │  Vercel API      │
         │  api/*.ts        │
         │  (idle-processor)│
         └─────┬────────────┘
               │
         ┌─────▼────────────┐
         │  Supabase SDK    │
         └─────┬────────────┘
               │
┌──────────────▼───────────────────────────┐
│   Supabase Backend (PostgreSQL + Auth)   │
│   (Database, Real-time, Auth, Storage)   │
└──────────────────────────────────────────┘
```

---

## Frontend Architecture

### Directory Structure

```
src/
├── components/              # UI building blocks
│   ├── arena/               # Arena sub-components (extracted from Arena.tsx, Phase 3)
│   │   ├── ActionPanel.tsx      # PvP/PvE/Boss fight actions
│   │   ├── ArenaHeader.tsx      # Character name, level, nav buttons
│   │   ├── CharacterDisplay.tsx # Scene + XP bar + stats
│   │   ├── ExperienceBar.tsx    # XP bar + gain popup + max level
│   │   ├── InventoryPanel.tsx   # Inventory modal (incl. Shop tab)
│   │   ├── SceneBox.tsx         # PvE idle runner vs PvP avatar
│   │   ├── SettingsPanel.tsx    # Settings modal (auto-mode, delete, logs, medals)
│   │   ├── StatsPanel.tsx       # Stat grid + HP + efficiency
│   │   └── arenaTypes.ts        # Shared arena view models & prop types
│   ├── forge/               # Forge sub-components
│   │   ├── SalvagePanel.tsx     # Salvage items → essence
│   │   ├── FusionPanel.tsx      # Fuse 3 items → higher tier
│   │   ├── UpgradePanel.tsx     # Upgrade item stats with essence
│   │   └── ShopPanel.tsx        # 8-Bit Emporium (shop)
│   ├── procedural/          # Procedural terrain & biomes
│   │   ├── ProceduralTerrain.tsx
│   │   ├── BiomeTerrain.tsx
│   │   ├── biomeTerrainConfig.ts
│   │   └── terrainShared.ts
│   ├── AffinityBadge.tsx    # Weapon element badge
│   ├── CombatView.tsx       # Arena fight display (intro/VS/combat/result)
│   ├── ConnectionModal.tsx  # DB connection gate
│   ├── GameLogo.tsx         # 8-bit SVG logo
│   ├── IdleRunnerScene.tsx  # PvE idle combat scene with level-up FX
│   ├── LoadingScreen.tsx    # Loading spinner
│   ├── MedalCard.tsx        # PvE medal card
│   ├── MedalUnlockToast.tsx # Medal unlock toast
│   ├── NotificationDisplay.tsx # Toast notifications
│   ├── PixelAssets.ts       # Pixel art asset definitions
│   ├── PixelCharacter.tsx   # Seed-based character SVG
│   ├── PixelIcon.tsx        # Generic 8×8 pixel icon
│   ├── PixelItemIcon.tsx    # Item sprite SVG
│   ├── PixelMonster.tsx     # Monster 16×16 SVG
│   ├── PushOptInBanner.tsx  # Push notification opt-in
│   ├── SceneBackground.tsx  # Idle scene background
│   ├── StatusScreen.tsx     # Status display
│   ├── StreakIndicator.tsx  # Lootbox streak progress
│   └── ErrorBoundary.tsx    # Error boundary
│
├── pages/                   # Full-page routes
│   ├── Arena.tsx            # Main game arena (244 lines — refactored from 1066)
│   ├── Forge.tsx            # Forge page (salvage/fusion/upgrade/shop)
│   ├── Achievements.tsx     # Achievements page
│   ├── CharacterCreation.tsx # Character creation
│   ├── HomePage.tsx         # Landing page + patch notes
│   ├── Login.tsx            # Login/signup
│   ├── Rankings.tsx         # Hall of Fame
│   └── NotFound.tsx         # 404
│
├── routes/                  # Lazy-loaded route components
│   └── lazyPages.ts         # React.lazy page imports
│
├── context/                 # React Context (global state)
│   ├── GameContext.tsx      # Game state, persistence, Supabase sync
│   └── NotificationContext.tsx # Toast notification queue
│
├── hooks/                   # Custom React hooks (feature state)
│   ├── useArenaCombat.ts    # PvP/PvE/Boss combat orchestration
│   ├── useIdleCombat.ts     # Idle PvE combat engine (timers, efficiency)
│   ├── useInventory.ts      # Inventory/lootbox/equipment state
│   ├── useSettings.ts       # Settings modal + auto-mode + delete
│   ├── useArenaLevelUp.ts   # Level-up FX + stat allocation
│   ├── useConnectionGate.ts # DB connection gate modal
│   ├── useNotification.ts   # Toast consumer
│   ├── useOnlineStatus.ts   # Connection detection
│   ├── usePushReminders.ts  # Push subscription management
│   ├── useSound.ts          # WebAudio sound effects
│   ├── useFocusTrap.ts      # Modal focus trap
│   ├── useLowPerformanceMode.ts # Low-perf device detection
│   └── useTerrainAnimation.ts   # Terrain RAF animation
│
├── config/                  # Configuration & constants
│   ├── gameRules.ts         # Game constants, balance values
│   ├── idleConfig.ts        # Idle/essence/efficiency config
│   ├── progressionConfig.ts # Feature unlock thresholds
│   ├── combatBalance.ts     # Combat formulas, scaling
│   ├── terrainConfig.ts     # Terrain quality scaling
│   └── supabase.ts          # Supabase client init
│
├── data/                    # Static game data
│   ├── itemAssets.ts        # Items, rarities, stats (140+ items)
│   ├── monsterAssets.ts     # Monster definitions & palettes
│   ├── bossAssets.ts        # Raid boss definitions (VOID TITAN)
│   ├── biomes.ts            # Biome definitions (plains, volcanic, ...)
│   ├── achievements.ts      # Achievement definitions
│   ├── medals.ts            # PvE medal definitions
│   ├── forgeConstants.ts    # Essence yield, fusion/upgrade costs
│   ├── shopConstants.ts     # Shop offer config
│   ├── backgrounds.ts       # Scene backgrounds
│   └── updateNotes.ts       # Version history
│
├── types/                   # TypeScript definitions
│   ├── Character.ts         # Character type
│   ├── Item.ts              # Item type
│   └── IdleCombat.ts        # Idle combat types
│
├── utils/                   # Game logic utilities (pure functions)
│   ├── combatUtils.ts       # Fight calculations
│   ├── combatBalance.ts     # Combat balance formulas
│   ├── xpUtils.ts           # XP & leveling
│   ├── matchmakingUtils.ts  # Opponent selection
│   ├── characterUtils.ts    # Character operations
│   ├── lootboxUtils.ts      # Loot distribution
│   ├── equipmentUtils.ts    # Equipment, loadouts, bonuses
│   ├── forgeUtils.ts        # Salvage, fusion, upgrade
│   ├── shopUtils.ts         # Shop offers, purchases, rerolls
│   ├── medalUtils.ts        # PvE medal logic
│   ├── achievementUtils.ts  # Achievement logic
│   ├── bossUtils.ts         # Raid boss logic
│   ├── monsterUtils.ts      # Monster generation
│   ├── idleEfficiencyUtils.ts # Idle efficiency math
│   ├── idleXpUtils.ts       # Idle XP/essence math
│   ├── idleSnapshotUtils.ts # Idle snapshot persistence
│   ├── persistenceUtils.ts  # localStorage + Supabase sync
│   ├── particleSystem.ts    # Pooled DOM particle effects
│   ├── statUtils.ts         # Stat allocation & scaling
│   ├── supabaseUtils.ts     # Supabase <-> app converters
│   ├── dailyReset.ts        # Daily reset helpers
│   ├── botBehaviorUtils.ts  # Bot logic
│   ├── pushNotifications.ts # Web push helpers
│   ├── reminderScheduler.ts # Session reminders
│   ├── timezoneUtils.ts     # Paris timezone helpers
│   └── ...
│
├── styles/                  # Global Sass styles
│   ├── main.scss            # Entry point
│   ├── _variables.scss      # Design tokens
│   ├── base/                # Reset, layout, typography, animations
│   ├── components/          # Per-component styles (incl. _forge.scss)
│   └── pages/               # Per-page styles (incl. _arena*.scss)
│
└── test/                    # Test suite (1482 tests, 99 files)
    ├── unit/                # Pure function tests
    ├── components/          # Component tests (RTL)
    ├── integration/         # Cross-system integration tests
    └── utils/               # Test helpers (router, supabaseMock)
```

### State Management

**Game state is managed via React Context (`GameContext`) + localStorage cache + Supabase sync**:

```typescript
// GameContext provides (via useGame()):
- activeCharacter (Character)
- loading, dbAvailable (connection state)
- lastXpGain, lastLevelUp, lastUnlockedMedal, pityCount
- actions: login, logout, setCharacter, useFight, useBossFight,
  startMatchmaking, allocateStatPoint, saveStatAllocations,
  saveEquipment, rollLootbox, setAutoMode, deleteCharacter,
  syncCharacterToBackend, salvageItems, fuseItems, upgradeItem,
  buyShopOffer, rerollShopOffers, addEssence, spendEssence
- essence (number)

// Persisted to localStorage for offline support
- Automatic sync to Supabase on every action
- Conflict resolution: server wins
```

**Feature state lives in dedicated hooks**, which consume `useGame()` and expose
view models / handlers to presentational components:

```
GameContext (useGame)
   │
   ├─ useArenaCombat   → actionPanelProps, combatData, mode, handlers
   ├─ useIdleCombat    → currentMonster, scenePhase, efficiencyData, offlineGains
   ├─ useInventory     → inventory props, preview stats, equip/unequip/lootbox handlers
   ├─ useSettings      → settings modal state, auto-mode toggle, delete flow
   ├─ useArenaLevelUp  → XP bar animation, level-up FX, stat allocation
   └─ useSound         → WebAudio SFX (equip, loot, lootbox, hit, ...)
   │
   └─ Presentational components (props-only)
        Arena.tsx composes: ArenaHeader, CharacterDisplay, ActionPanel,
        InventoryPanel, SettingsPanel, CombatView
        Forge.tsx composes: SalvagePanel, FusionPanel, UpgradePanel, ShopPanel
```

### Routing

**`react-router-dom` v6 with lazy-loaded pages** (`src/routes/lazyPages.ts`):

```typescript
// App.tsx uses <Routes>/<Route> with React.lazy pages:
- /            → HomePage (or auto-redirect to /arena if a character exists)
- /login       → Login
- /create-character → CharacterCreation
- /arena       → Arena
- /forge       → Forge
- /rankings    → Rankings
- /achievements → Achievements
- *           → NotFound
```

---

## Backend Architecture

### Supabase Structure

**Supabase provides**:
- PostgreSQL relational database
- Real-time subscriptions (for live rankings, opponent changes)
- Authentication (email + password, magic links)
- Storage (for CDN, file uploads if needed)

### Scripts & Utilities

#### `api/idle-processor.ts`
- **Purpose**: Server-side idle combat processing (self-contained Vercel serverless function)
- **Trigger**: 
  - On-demand: client POSTs `{ character_id }` on reconnect
  - Cron: 1-minute cron from cron-job.org (no character_id → processes all stale characters)
- **Function**: Simulates offline combat, applies XP/levels, updates `last_idle_check` watermark
- **Output**: Returns `{ fights, xp, levels, updated }` JSON
- **Why self-contained**: Vercel only compiles `api/` to JS; all utilities (monsters, combat, XP, efficiency) are inlined
- **XP curve**: `Math.floor(100 * Math.pow(level, 1.6))` — must match `src/utils/xpUtils.ts`
- **Cron URL**: `https://bitbrawler.vercel.app/api/idle-processor`
- **Env required**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

#### `scripts/idle-processor.ts`
- **Purpose**: Local testing version of the idle processor
- **Trigger**: `npx tsx scripts/idle-processor.ts`
- **Difference**: Imports utilities from `src/` (not self-contained)

#### `scripts/bot-engine.ts`
- **Purpose**: Simulate bot activity (fights, leveling, progression)
- **Trigger**: Manually or via `bot-activity.yml` (GitHub Actions)
- **Function**: Manages bot population, activity pacing, protection rebalance
- **Output**: Updates bot characters in Supabase

#### `scripts/daily-reset-engine.ts`
- **Purpose**: Global daily reset at midnight (Paris timezone)
- **Trigger**: Manually or via `daily-reset.yml` (GitHub Actions)
- **Function**: Reset player fights, opponent tracking, seasonal stats
- **Output**: Updates character data in Supabase

#### `scripts/analyze-qa-stats.ts`
- **Purpose**: Analyze gameplay stats for balancing insights
- **Trigger**: Via tech-lead.yml (daily)
- **Input**: `qa/stats.json`
- **Output**: `qa/analysis-latest.json` with trends & recommendations

#### `scripts/push-notifier.ts`
- **Purpose**: Send web push notifications (streak reminders, lootbox ready, events)
- **Trigger**: Manually or via `push-notify:run` npm script
- **Function**: Iterates subscribed characters and sends capped (max 1/day) notifications

#### `scripts/run-migration.ts` / `scripts/reset-and-migrate.ts`
- **Purpose**: Apply SQL migrations from `supabase/migrations/`; reset + re-migrate for dev
- **Trigger**: `npm run db:migrate`, `npm run db:reset`

#### `scripts/verify-stat-constraints.ts`
- **Purpose**: Verify stat constraint integrity after migrations
- **Trigger**: `npm run db:verify-constraints`

#### `scripts/supabaseAdmin.ts`
- **Purpose**: Shared Supabase admin client (service role) for scripts

---

## Database Schema

### Main Tables

#### `characters`
```sql
id              UUID PRIMARY KEY
user_id         UUID FOREIGN KEY (auth.users)
name            TEXT
gender          TEXT ('male' | 'female')
seed            TEXT (pixel art seed)
level           INT (1-100)
experience      INT
max_hp          INT
hp              INT
stats           JSONB {
  strength, vitality, dexterity,
  luck, intelligence, focus
}
inventory       JSONB [item ids]
equipped_items  JSONB { weapon, armor, accessory }
wins            INT
losses          INT
fights_left     INT (daily PvP gauge)
pve_fights_left INT (daily PvE gauge)
last_fight_reset TIMESTAMP
is_bot          BOOLEAN
auto_mode       BOOLEAN (delegated to bot engine)
stat_points     INT (unspent level-up points)
last_loot_roll  TIMESTAMP (daily lootbox)
lootbox_streak  INT
lootbox_pity_count INT
pending_fight   JSONB (in-progress fight)
fight_history   JSONB [recent fights]
incoming_fight_history JSONB [incoming attacks]
fought_today    JSONB [opponent ids]
essence         NUMERIC (forge/shop currency)
item_upgrades   JSONB { itemId: level }
idle_streak     INT
idle_max_streak INT
idle_total_kills INT
idle_total_xp   INT
last_idle_check TIMESTAMP
last_active     TIMESTAMP
boss_progress   JSONB { bossHp, bossMaxHp, ... }
medal_progress  JSONB
monster_kills   JSONB { monsterId: count }
achievement_progress JSONB
achievement_title TEXT
push_subscribed BOOLEAN
push_endpoint   TEXT
push_keys       TEXT
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### `fights`
```sql
id              UUID PRIMARY KEY
player_id       UUID FOREIGN KEY (characters)
opponent_id     UUID FOREIGN KEY (characters)
winner_id       UUID
xp_gained       INT
loot_rarity     TEXT ('common' | 'uncommon' | 'rare' | 'epic' | 'legendary')
damage_dealt    INT
damage_taken    INT
duration_ms     INT
created_at      TIMESTAMP
```

#### `fight_opponents`
Tracks **daily opponent rotation** (one opponent per day, no repeats):
```sql
id              UUID PRIMARY KEY
character_id    UUID FOREIGN KEY (characters)
opponent_id     UUID FOREIGN KEY (characters)
reset_date      DATE
created_at      TIMESTAMP
```

#### `daily_lootbox`
Tracks **lootbox claim status**:
```sql
id              UUID PRIMARY KEY
character_id    UUID FOREIGN KEY (characters)
claimed_at      TIMESTAMP
rarity          TEXT ('common' | 'rare' | 'epic')
reset_date      DATE
```

### View: `character_rankings`
```sql
SELECT
  characters.id,
  characters.name,
  characters.level,
  characters.exp,
  characters.wins,
  ROW_NUMBER() OVER (ORDER BY level DESC, exp DESC) AS rank
FROM characters
WHERE is_bot = false
ORDER BY level DESC, exp DESC
```

---

## Game Systems

### 1. Character Creation & Stats

**Stats are generated via weighted random allocation** (`generateInitialStats` in
`src/utils/characterUtils.ts`), producing natural archetypes with constant total points:

```
- All 6 stats start at base 5
- 1 primary stat (15x weight), 1-2 secondary stats (5x weight), others (1x weight)
- Dynamic weight adjustment: stats below 7 get 2x boost (no dump stats),
  stats above 13 get diminishing returns (no extreme outliers)
- TOTAL_POINTS = 66 distributed across STR/VIT/DEX/LUK/INT/FOC
```

| Stat | Effect |
|------|--------|
| STR (Strength) | Damage, physical skills |
| VIT (Vitality) | Max HP, survivability |
| DEX (Dexterity) | Speed, accuracy, critical chance |
| LUK (Luck) | Loot rarity |
| INT (Intelligence) | Magic damage |
| FOC (Focus) | Accuracy / control |

**Initial HP**: `max_hp = BASE_HP (100) + VIT scaling + random variance`
(see `statUtils.ts` / `combatBalance.ts`)

### 2. Combat System

**Three arena modes**, orchestrated by `useArenaCombat` (`src/hooks/useArenaCombat.ts`):

| Mode | Type | Opponent | Energy pool |
|------|------|----------|-------------|
| **PvP** | Turn-based | Real bots (same-level matchmaking) | 5 fights/day |
| **PvE** | Turn-based | Monsters (idle scene with phases) | 5 fights/day |
| **Boss** | Turn-based | Raid boss (persistent HP pool) | 5 attacks/day, unlocked level 30 |

```
Arena.tsx
   └─ useArenaCombat({ character, startMatchmaking, useFight, useBossFight })
        ├─ mode: 'pve' | 'pvp'  (defaults to pve/boss)
        ├─ onFight() → matchmaking OR boss generation → combatData
        ├─ onCombatComplete(won, xp, bossHpLeft?) → useFight/useBossFight → level-up
        └─ CombatView renders the fight overlay (intro/VS/combat/result)
```

#### Combat Flow

1. **Opponent Selection** → Strict same-level matchmaking (`matchmakingUtils.ts`)
2. **Turn-based Combat** → Player vs Bot (or monster / boss)
3. **Damage Calculation**:
   ```
   base_damage = STR + weapon_bonus + random(-10% to +20%)
   critical = 5% + (DEX * 0.5)% chance
   if critical: damage *= 1.5
   ```
4. **Victory Conditions**:
   - Opponent reaches 0 HP → Player wins ✅
   - Player reaches 0 HP → Player loses ❌

#### XP & Leveling

- **XP curve**: `100 × level^1.6` (power curve) — defined in `src/utils/xpUtils.ts`
- **XP per fight**: 25-75 base (depends on opponent level), scales +8% per player level
- **Level up reward**: +1 stat point, HP recalculated from vitality formula
- **getXpProgress**: computes current XpInLevel, xpForNextLevel, percentage for display
- **gainXp**: applies XP and levels up without adding stat points (caller adds them)
- **Auto level-up**: `useArenaLevelUp` triggers FX + auto-allocates stat points by archetype weights

#### Raid Boss (VOID TITAN)

See [BOSS_PVE.md](BOSS_PVE.md) for full mechanics. Boss logic lives in
`src/utils/bossUtils.ts` + `src/data/bossAssets.ts`:
- Persistent HP pool (`boss_progress` on the character), no regen between attacks/days
- Stats scale from the player: `LEVEL_BOOST = 2`, `STAT_MULTIPLIER = 1.2`,
  `HP_MULTIPLIER = 12.0`
- Kill grants `XP_MODIFIER = 4.0` XP + 60 essence, then starts a tougher cycle
- Boss background rendered by a data-driven engine (`BossBackgroundDef`)

### 3. Idle Combat System (PvE)

**Architecture**: Two-tier processing — on-demand + cron fallback

```
Player returns after idle
       │
       ▼
┌──────────────────┐
│ Client detects   │
│ idle > 30s       │
│ lastActive check │
└────┬─────────────┘
     │
     ├─▶ 1) Preview locally (immediate)
     │     calculateOfflinePreview() → {fights, xp, levels}
     │     Shows popup instantly (no server latency)
     │
     └─▶ 2) POST /api/idle-processor (async)
           Body: { character_id }
           Server applies gains + updates watermarks
           Returns updated character data
           Client updates popup with real numbers
     
If client POST fails → cron-job.org triggers every 1 min:
     GET /api/idle-processor (no character_id)
     → Process all stale characters (last_idle_check > 60s ago)
     → Catches bots, network failures, lost connections
```

#### Watermark System (two separate timestamps)

| Watermark | Updated by | Purpose |
|-----------|-----------|---------|
| `lastActive` | Client only (visibility change) | Tracks when player was last active |
| `last_idle_check` | Client ticks + server idle-processor | Tracks last processed idle time |

- On **visibilitychange → hidden**: client advances both watermarks via `onSyncCharacter`
- On **unmount**: client advances ONLY `lastIdleCheck` (not `lastActive`) — preserves idle time for character switching
- Server idle-processor advances `last_idle_check` after processing

#### Efficiency & XP/min

- **calculateCombatStats** includes equipment bonuses via `applyEquipmentToCharacter`
- **computeEfficiency** uses power ratio (player/monster) + dexterity speed bonus
- **effectiveInterval**: `BASE_INTERVAL (12s) / efficiency`, clamped to `[4.5s, 12s]`
  (`IDLE_CONFIG.EFFICIENCY` in `src/config/idleConfig.ts`)
- **XP/min**: always visible in stats panel, recalculates on any character change
- **Next-level ETA**: `remaining_XP / XP_per_minute` displayed as `⬆ Xm Ys`
- **Efficiency breakdown**: shows `⚡ X.xx` (multiplier) and `🎯 X.xx` (power ratio)
- **Streak bonuses**: `STREAK_BONUS_PER_STEP` (+1% per streak) capped at +25%,
  milestones at 5/10/25/50/100 (confetti FX)
- **Essence generation**: idle fights yield essence (`IDLE_CONFIG.ESSENCE`,
  base rate 0.2/s, loss ratio 0.3, level scale 0.08)

### 4. Matchmaking

**Goal**: Same-level fights, fair & interesting

**Algorithm**:
1. Get all available opponents at same level
2. Exclude **daily opponent** (one per day, no repeats)
3. Exclude **defeated opponents** (if too recent)
4. Randomly select from pool

**Opponent Rotation**: Daily reset clears opponent tracking

### 5. Lootbox System

**Rarity Distribution** (`LOOTBOX_RARITY_WEIGHTS` in `src/utils/lootboxUtils.ts`):
- **Common**: 45.8% (small stat bonuses)
- **Uncommon**: 20% (medium stat bonuses)
- **Rare**: 17% (good stat bonuses)
- **Epic**: 15% (large stat bonuses)
- **Legendary**: 4% (highest stat bonuses)

Weights scale with player level (`getLootboxRarityWeights`) and streak bonuses
(`STREAK_TIERS`, up to +25%). A **pity counter** (`PITY_THRESHOLD = 30`) forces a
legendary after 30 consecutive non-legendary rolls.

**Daily Limit**: 1 lootbox per day (resets at midnight, tracked via `lastLootRoll`
+ `lootboxStreak`).

**Stat Bonuses** (via `rollSimpleLootbox` for the shop lootbox — no streak/pity):
```
Common: +1-2 to random stat
Rare:   +3-5 to 2 random stats
Epic:   +5-10 to all stats
```

### 6. Equipment & Loadouts

**3 equipment slots** (`src/utils/equipmentUtils.ts`):
- Weapon ⚔️ / Armor 🛡️ / Accessory 💍

**6 weapon elements** with an affinity system (`src/utils/affinityUtils.ts`):
- fire / water / wind / earth / light / dark
- +15% damage vs bot archetypes with matching elemental weakness

**Functions**:
- `equipItem` / `unequipItem` — manage equipped items
- `autoEquipBestItems` — auto-equip best-in-slot
- `getEquipmentBonuses` — aggregate stat bonuses (STR/VIT/DEX/LUK/INT/FOC/HP)
- `applyEquipmentToCharacter` — produce the "effective" character used in combat

### 7. Forge & Essence Economy

**Essence** is the crafting currency, earned from fights and salvaging items
(`ESSENCE_YIELD` in `src/data/forgeConstants.ts`):
```
common: 5 | uncommon: 20 | rare: 50 | epic: 80 | legendary: 400
```

**Forge operations** (`src/utils/forgeUtils.ts`):
- **Salvage** — destroy an item → essence
- **Fusion** — combine 3 same-rarity items → 1 of the next tier
  (`FUSION_COST`: common 10, uncommon 40, rare 150, epic 500)
- **Upgrade** — spend essence to boost item stats up to `MAX_UPGRADE_LEVEL = 5`

**Shop (8-Bit Emporium)** (`src/utils/shopUtils.ts` + `shopConstants.ts`):
- 4 daily offers (item/lootbox mix) generated via seeded RNG per character + day
- Prices in essence (150-350), one offer is a guaranteed epic item
- 1 reroll per day for 25 essence
- Purchases persisted via `shopPurchases` and reset daily

### 8. Bot Activity

**Bot Population Management**:
- Maintain minimum active bots at each level
- Distribute fights evenly (no single bot overused)
- Activity profiles: `active` (fights daily) | `casual` (fights 2-3x/week) | `inactive` (on vacation)

**Protection Rebalance**:
- Prevent same bot from being fought 2x in a row
- Rotate bot lineup daily
- Occasionally "retire" overpowered bots

### 9. Daily Reset

**Triggers at midnight (Paris timezone)**:

1. **Fight Tracker Reset**
   - Clear daily fight counter
   - Allow fresh fights

2. **Opponent Rotation**
   - Clear opponent tracking (see new opponents)
   - Reshuffle bot lineup

3. **Lootbox Reset**
   - Allow new daily lootbox claim
   - Reset lootbox timestamp

4. **Shop Reset**
   - Reset daily shop purchases and allow a fresh reroll

5. **Boss Reset**
   - Replenish daily boss attacks (`ensureBossDailyReset`)

### 10. Medals & Achievements

**PvE Medals** (`src/utils/medalUtils.ts` + `src/data/medals.ts`):
- 25 PvE medals: 16 hunter medals (8 monsters × 2 tiers: 5/25 kills), 3 PvE streak
  medals (3/5/10 consecutive wins), 6 high-progression medals (levels 30/50/75/100/150/200)
- Verified automatically after every fight; rewards include HP, stat points,
  inventory slots, XP bonus, titles, and cosmetic auras

**Achievements** (`src/utils/achievementUtils.ts` + `src/data/achievements.ts`):
- 7 categories (combat, pve, collection, leveling, equipment, forge, secret)
- Rewards: titles, essence, lootboxes, cosmetics, XP bonuses, stat points
- Checked on relevant game actions via `GameContext`

### 11. Notifications & Push

- **In-app toasts**: `NotificationContext` (queue, auto-dismiss, max 3, vibration)
- **Web push**: opt-in banner → `usePushReminders` / `pushNotifications` →
  reminders for streak in danger, daily lootbox ready, new events (max 1/day)
- **Script**: `scripts/push-notifier.ts` sends notifications on schedule

---

## Key Design Patterns

### 1. Context + Hooks

**Problem**: Prop drilling, scattered state

**Solution**: React Context + custom hooks

```typescript
// GameContext manages centralized state
const { character, setCharacter, useFight, salvageItems, buyShopOffer } = useGame();

// Feature hooks consume useGame() and expose view models / handlers
const inventory = useInventory({ character, rollLootbox, saveEquipment, ... });
const settings = useSettings({ character, setAutoMode, deleteCharacter, ... });
const combat = useArenaCombat({ character, startMatchmaking, useFight, ... });
const idle = useIdleCombat({ character, isPaused, onCharacterUpdate, ... });
```

The page (`Arena.tsx`) stays declarative: it composes hooks and renders
props-only components with the returned view models.

### 2. Props-only Presentational Components

**Problem**: Components reaching into context directly are hard to test/reuse

**Solution**: Sub-components receive props + callbacks (`src/components/arena/`,
`src/components/forge/`):

```typescript
<InventoryPanel
  inventory={inventory.inventory}
  equippedItems={inventory.equippedItems}
  canRollDailyLoot={inventory.canRollDailyLoot}
  onEquip={inventory.handleEquipItem}
  onUnequip={inventory.handleUnequipItem}
  onLootboxRoll={inventory.handleLootboxRoll}
  onClose={inventory.closeInventory}
/>
```

### 3. Utility Functions

**Problem**: Logic scattered in components

**Solution**: Pure utility functions in `src/utils/`

```typescript
// Combat is predictable, testable, and reusable
const damage = calculateDamage(attacker, defender, weapon);

// Matchmaking logic is separate from components
const opponent = selectOpponent(character, availableOpponents);
```

### 4. Type Safety

**All major data structures have TypeScript types**:

```typescript
interface Character {
  id: UUID;
  name: string;
  level: number;
  stats: Stats;
  inventory: Item[];
  // ...
}

interface Item {
  id: UUID;
  name: string;
  type: 'weapon' | 'armor' | 'accessory';
  rarity: 'common' | 'rare' | 'epic';
  bonuses: StatBonus[];
}
```

### 5. Responsive Data Fetching

**Real-time Supabase subscriptions**:

```typescript
// Listen for live updates (character changes, rankings)
const subscription = supabase
  .from('characters')
  .on('UPDATE', (payload) => {
    updateCharacter(payload.new);
  })
  .subscribe();
```

### 6. Offline Support

**Progressive enhancement**:
- Data cached in localStorage
- Auto-sync on reconnection
- Conflict resolution: server wins

---

## Performance Considerations

### Frontend Optimization

1. **Code Splitting**
   - Route-based lazy loading in `src/routes/lazyPages.ts`
   - Components loaded on-demand

2. **Caching**
   - Static item data cached in memory
   - Character data in localStorage
   - Service Worker for offline support

3. **Rendering**
   - Memoization for expensive components
   - Avoid unnecessary re-renders
   - Efficient pixel rendering with Canvas/SVG

4. **Particle System** (`src/utils/particleSystem.ts`)
   - Object-pooled DOM particles (max 60 by default, `maxParticles` cap)
   - 19 particle types (dust, spark, xp_star, damage, crit, magic, confetti, ...)
   - Single RAF loop; `unmount()` cleans up timers/particles
   - Used by CombatView + IdleRunnerScene for hit/damage/level-up FX

### Database Optimization

1. **Indexes**
   ```sql
   CREATE INDEX idx_characters_user_id ON characters(user_id);
   CREATE INDEX idx_characters_level ON characters(level);
   CREATE INDEX idx_fights_created_at ON fights(created_at);
   CREATE INDEX idx_daily_lootbox_reset_date ON daily_lootbox(reset_date);
   ```

2. **Query Optimization**
   - Batch updates where possible
   - Use views for complex queries
   - Avoid N+1 queries

3. **Real-time Subscriptions**
   - Only subscribe to necessary data
   - Unsubscribe on cleanup
   - Debounce updates if too frequent

### Build Optimization

1. **Vite Configuration**
   - Tree-shaking for unused code
   - CSS minification
   - JavaScript minification & mangling

2. **Bundle Size**
   - Monitor with `npm run build`
   - Lazy load non-critical dependencies
   - Use dynamic imports

---

## Testing Strategy

### Unit Tests

- **Utility functions**: combatUtils, xpUtils, matchmakingUtils, etc.
- **Framework**: Vitest
- **Coverage**: 1482 tests, 99 files

### Integration Tests

- **Component tests**: React Testing Library
- **API mocking**: Supabase mock client (`src/test/utils/supabaseMock.ts`)
- **Test utils**: router helper (`src/test/utils/router.tsx`)

### E2E Tests

- **Framework**: Playwright
- **Target**: Live site (bitbrawler.vercel.app)
- **Frequency**: Scheduled daily
- **Output**: `qa/stats.json` with gameplay data

---

## Deployment

### Local Development

```bash
npm install
npm run dev
# Runs on localhost:3000 with HMR (port set in vite.config.ts)
```

### Production Build

```bash
npm run build
# TypeScript check (tsc) + Vite production build → dist/
# Ready for Vercel
```

### Vercel Configuration

`vercel.json` defines SPA rewrites:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- **`/api/*`** → serverless functions in `api/` (e.g. `idle-processor.ts`)
- **Everything else** → `index.html` (React Router handles client-side routes)
- **Environment variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (frontend) + `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (serverless API)

### Deployment Pipeline

1. **dev-agent pushes** a feature branch → GitHub Actions creates a PR
2. **CI Workflow** (lint, type check, test, build) on the PR
3. **Reviewer** approves & merges to `master`
4. **Vercel** auto-deploys `master` → production (`bitbrawler.vercel.app`)
5. Preview deployments on Vercel for every PR

---

## Scaling Considerations

### Current Limits

- PostgreSQL handles 1000+ active players
- Real-time subscriptions scale to 100+ concurrent clients
- Vercel Edge Functions for API routes if needed

### Future Optimizations

1. **Database**
   - Sharding by player level/region
   - Archive historical fight data

2. **Frontend**
   - Service Worker improvements
   - Advanced caching strategies

3. **Backend**
   - API layer for bot operations
   - WebSocket for real-time events
   - Cache layer (Redis) for frequently accessed data

---

## References

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev)
- [Vitest Documentation](https://vitest.dev)
