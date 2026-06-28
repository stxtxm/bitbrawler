Project Notes (Latest)

Overview
- Bitbrawler is a retro 8-bit arena brawler with Supabase (PostgreSQL) as the source of truth.
- Core loop: create a character, fight in the arena (PvP or PvE idle), earn XP, level up, climb rankings.

Data model (Character)
- Core fields: `level`, `experience`, stats (STR/VIT/DEX/LUK/INT/FOC), `hp`, `maxHp`, `wins`, `losses`.
- Daily fields: `fightsLeft` (PvP), `pveFightsLeft`, `lastFightReset`, `fightHistory` (cap 20), `foughtToday`.
- Progression fields: `statPoints` (auto-allocated by archetype on level-up), `focus` is an active stat, not derived.
- Inventory fields: `inventory` (item IDs), `equippedItems` (weapon/armor/accessory slots), `lastLootRoll`.
- Anti-cheat: `pendingFight` holds `status`, `startedAt`, optional `opponent` snapshot, and `matchType`.
- Idle fields: `lastActive` (player visible activity), `last_idle_check` (last processed idle), `idleStreak`, `idleTotalKills`, `idleTotalXp`.

PvE Idle Combat
- Toggle switch in Arena (👹 PVE / ⚔ PVP). PvE mode enables the idle runner.
- 5 PvE fights/day (separate from 5 PvP).
- Monsters: Goblin (wind), Ogre (earth), Wraith (dark), Slime (water, lvl 1-8), Wolf (fire, lvl 5-18), Skeleton (dark, lvl 10-28), Chimera (fire, lvl 20-40), Dragon Spawn (fire, lvl 30-50) — scale to player level with tiered difficulty.
- Idle processing: **Vercel serverless** (`api/idle-processor.ts`), NOT GitHub Actions.
  - On-demand: client POSTs on reconnect for instant gains.
  - Cron fallback: cron-job.org every 1 minute processes stale characters.
  - Self-contained: inlines all combat/XP/monster utilities (Vercel doesn't compile src/).
- Two watermarks: `lastActive` (client, visibility change) + `last_idle_check` (client + server).
- Unmount preserves `lastActive` (doesn't advance it) so character switching keeps idle time.
- XP/min always visible with next-level ETA, efficiency multiplier, power ratio.
- Efficiency recalculates on any character change (level, stats, equipment).

Idle Efficiency Formula
- powerRatio = playerTotalPower / monsterTotalPower (clamped 0.5–2.5)
- efficiency = 1 + max(dex-10, 0) × 0.02 + max(powerRatio-1, 0) × 0.4
- effectiveInterval = BASE_INTERVAL(10s) / efficiency (clamped 4.5–10s)
- XP bonus = 1 + (efficiency - 1) × 0.3
- Streak bonus: +1% per consecutive win, capped at 25%

XP & Leveling
- XP curve: `100 × level^1.6` (power curve, defined in `src/utils/xpUtils.ts`)
- Must match in `api/idle-processor.ts` (self-contained copy)
- gainXp does NOT add stat points — caller does it once per level
- getXpProgress: currentXpInLevel, xpForNextLevel, percentage

Matchmaking + anti-cheat
- Strict same-level matchmaking in `src/utils/matchmakingUtils.ts`.
- Returns `{ opponent, matchType, candidates }` for the intro scan animation.
- `startMatchmaking` reserves fight energy and stores `pendingFight` immediately.
- If a match is found, the opponent snapshot is stored in `pendingFight`.
- If no match is found while pending, energy is refunded and `pendingFight` cleared.
- `resolvePendingFight` runs on load if a pending fight exists and resolves via `simulateCombat` without consuming extra energy.
- Outgoing fights append an incoming defense log on the target character (no XP/progression impact).

Combat rules (v0.9.0 / v1.0.0)
- `calculateCombatStats` includes FOC, equipped item bonuses, and weapon affinity multipliers; diminishing returns at higher stats.
- Combat tuning constants are centralized in `src/config/combatBalance.ts` for quicker balancing edits.
- Hit chance is DEX/FOC weighted (FOC weight 0.35); crit chance from LUK (capped at 30%), magic surge from INT.
- Focus surge triggers up to 12% of the time with 1.12x damage multiplier. Surge chance per focus point: 0.30.
- Focus contributes to total power at 85% weight (up from 60%) — no longer a dead stat.
- Comeback boost when HP < 35% (damage ×1.12, +4 hit chance).
- `simulateCombat` returns a timeline for HP animations and combat logs.
- XP per fight scales at 8% per level above 1 (up from 5%) to sustain high-level progression.

Lootbox + inventory
- Daily lootbox gating uses the same Paris day reset as fight energy (`canRollLootbox`).
- Inventory capacity is 24; items can be manually equipped into weapon/armor/accessory loadout slots, or auto-equipped via autoEquipBestItems.
- Lootbox rolls exclude items already owned; if all items are owned, no new loot is granted.
- Items are defined in `src/data/itemAssets.ts` with rarities (common, uncommon, rare, epic, legendary), slots (weapon/armor/accessory), and optional elemental affinity (fire/water/wind/earth/light/dark).
- 50 items across 10 tiers (levels 1-10) with all 6 elements covered including water.
- `equipmentUtils` handles equip/unequip/auto-equip management and aggregates loadout bonuses; arena + combat use `applyEquipmentToCharacter`.
- `getEquipmentBonuses` reads `character.itemUpgrades` — forge upgrades apply to all stats including HP.

Bots and automation
- Bot engine: `scripts/bot-engine.ts` — fetches characters where `is_bot = true`.
- Keeps population above minimums, spawns growth per scheduled run.
- Same-level fights only; uses shared combat + XP logic for parity.
- Maintains a dynamic protected reserve of level 1 bots based on current level 1 human demand.
- Daily reset + daily lootbox pass runs for all bots each execution (including protected pool).
- Bots auto-roll the daily lootbox (logs: opened, inventory full, already opened).
- End-of-day catch-up window drains remaining fights before reset (`END_OF_DAY_DRAIN_START_HOUR`, Europe/Paris).
- Daily reset script clears `foughtToday` and restores fight energy at Paris midnight.
- Bot activity now uses per-bot profiles and run budgets for more organic pacing.
- Bot action logs now show random target + result and write incoming defense logs for targets.
- Name generator adds a short letter suffix to avoid duplicates in a session.

Auto mode vs bots (unified flags)
- `is_bot` and `auto_mode` are kept in sync: toggling auto mode in the UI also flips `is_bot`.
- A human player enabling auto mode becomes functionally a bot — the bot engine picks them up.
- The bot engine queries `is_bot = true` (no `.or()` needed — both flags are always aligned).
- `auto_mode` column is retained for UI state (toggle switch display); `is_bot` drives engine inclusion.
- The `logLabel` helper in `bot-engine.ts` uses `isBot` — auto-mode humans now log as `'Bot'`.

Offline behavior
- Home works offline; Rankings show "Connection required" state when offline.
- Arena supports read-only view from local snapshot; fights are blocked offline.
- Local storage snapshot is kept except logout, corrupted data, or missing server record.
- Service worker caches the app shell and reloads once on update activation.

UI tuning
- Level-up is automatic — points allocate instantly by archetype (weighted primary 3x, secondary 1.5x, others 0.5x) with gold glow FX + floating "⬆ LVL X!" text. No more overlay.
- Stat rows compress on very small screens; action buttons remain readable.
- Matchmaking intro is an animated opponent scan with a lock effect.
- Inventory modal shows loadout section at top + grouped grids by slot type; larger on desktop with item details and bonus chips.
- Combat actions include subtle 8-bit impact overlays and reaction animations; mobile overlay avoids grid flashes.
- Arena settings modal owns Auto mode toggle, combat logs, and safe delete actions.
- Rankings list is read-only, stats hidden, with internal scroll.
- Home page includes a PATCH NOTES button that opens update notes in a modal.
- Global Footer (`src/components/Footer.tsx`) visible on all pages: copyright, GitHub link, credits, app version.
- XP/min efficiency panel always visible (PvE + PvP): shows XP/min, next-level ETA, efficiency x, power ratio, speed ratio, magic mult, interval.
- Essence badge in header (purple 💎 counter, fractional .toFixed(2) display).
- Offline gains popup on reconnect: shows fights, XP, essence, levels earned while away with CLAIM REWARDS button.
- Idle PvE scene phases: monster_appears → combat (attacking class) → result (victory/defeat class) with XP popup (+N XP) and streak banner on milestones.
- Fight timeout watchdog: hard 95s cap prevents indefinite hangs with outlier detection.

Testing
- Unit: combat math, lootbox gating, equipment bonuses & loadout, affinity, XP, stats, RNG, matchmaking, supabase utils, item assets.
- Unit: lazy route prefetch gating, end-of-day drain window, idle efficiency, next-level time.
- Integration: matchmaking, pending fights, lootbox persistence, arena inventory/loadout/equip, offline routing, Supabase failover, arena PvE, idle efficiency display.
- Router warnings are prevented with shared `renderWithRouter` helper (`src/test/utils/router.tsx`).
- **781 tests — 71 test files** (`npm test`).

Infrastructure (v1.0.0 → v3.2.0)
- Database migrated from Firebase Firestore to Supabase (PostgreSQL).
- Scripts (`scripts/bot-engine.ts`, `scripts/daily-reset-engine.ts`) use `@supabase/supabase-js` via `scripts/supabaseAdmin.ts`.
- GitHub Actions: daily reset scheduled for Paris midnight with a double cron (CET/CEST); bot engine runs every 2 hours.
- Idle processing: **Vercel serverless** (`api/idle-processor.ts`) — replaces former GitHub Actions idle-processor workflow.
  - Cold start < 1s (vs 30s for GHA checkout + npm ci).
  - Self-contained: all utilities inlined (not imported from src/).
  - Cron trigger: cron-job.org every 1 min → `POST https://bitbrawler.vercel.app/api/idle-processor`.
- GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Handoff (Next Agent)
- Arena settings logs are rendered inside the same modal (view switch), not a separate popup.
- Bot engine opponent pool is fetched per-level (`where('level','==', level)`, limit 50).
- Lootbox and daily reset are aligned to Paris day, and final bot runs drain remaining fights.
- Name generator pools were expanded for more variety.
- Supabase service role key required for scripts (`SUPABASE_SERVICE_ROLE_KEY`). RLS open for dev.
- **Idle processor** (`api/idle-processor.ts`) is SELF-CONTAINED — no imports from `src/`.
  Vercel only compiles `api/` files to JS. If you change logic in `src/utils/xpUtils.ts`,
  `src/utils/combatUtils.ts`, `src/utils/monsterUtils.ts`, you must mirror changes in
  `api/idle-processor.ts`.
- Efficiency effect in `useIdleCombat.ts` depends on `[character]` identity — triggers on any change.
- On-demand idle: client previews locally first, then server call updates with real data.
- Two watermarks: `lastActive` (client only) + `last_idle_check` (client + server). Don't confuse them.
- XP curve: `100 × level^1.6` — must be IDENTICAL in both `src/utils/xpUtils.ts` and `api/idle-processor.ts`.
- gainXp: does NOT give stat points. caller (`simulateIdleGains` in idle-processor, `useFight` in client) gives them.
- Build must pass: `npm run build` (tsc + vite build). Check before any push.
