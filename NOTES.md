Project Notes (Latest)

Overview
- Bitbrawler is a retro 8-bit arena brawler with Firebase Firestore as the source of truth.
- Core loop: create a character, fight in the arena, earn XP, level up, climb rankings.

Data model (Character)
- Core fields: `level`, `experience`, stats (STR/VIT/DEX/LUK/INT/FOC), `hp`, `maxHp`, `wins`, `losses`.
- Daily fields: `fightsLeft`, `lastFightReset`, `fightHistory` (cap 20), `foughtToday` (Firestore IDs).
- Progression fields: `statPoints` for level-up allocation, `focus` is an active stat, not derived.
- Inventory fields: `inventory` (item IDs), `lastLootRoll` (timestamp ms), optional `equipped` reserved for future.
- Anti-cheat: `pendingFight` holds `status`, `startedAt`, optional `opponent` snapshot, and `matchType`.
- `pendingFight.opponent.isBot` is only stored when it is a boolean (avoid Firestore undefined values).

Matchmaking + anti-cheat
- Strict same-level matchmaking in `src/utils/matchmakingUtils.ts`.
- Returns `{ opponent, matchType, candidates }` for the intro scan animation.
- `startMatchmaking` reserves fight energy and stores `pendingFight` immediately.
- If a match is found, the opponent snapshot is stored in `pendingFight`.
- If no match is found while pending, energy is refunded and `pendingFight` cleared.
- `resolvePendingFight` runs on load if a pending fight exists and resolves via `simulateCombat`
  without consuming extra energy.

Combat rules
- `calculateCombatStats` includes FOC and inventory bonuses; diminishing returns at higher stats.
- Combat tuning constants are centralized in `src/config/combatBalance.ts` for quicker balancing edits.
- Hit chance is DEX/FOC weighted; crit chance from LUK (capped), magic surge from INT.
- Comeback boost when HP < 35% (damage + hit chance).
- `simulateCombat` returns a timeline for HP animations and combat logs.

Lootbox + inventory
- Daily lootbox gating uses the same Paris day reset as fight energy (`canRollLootbox`).
- `canRollLootbox` accepts Firestore timestamp shapes (`seconds`/`toMillis`) to avoid double rolls.
- Inventory capacity is 24; items are auto-applied (no manual equip flow).
- Lootbox rolls exclude items already owned; if all items are owned, no new loot is granted.
- Items are defined in `src/data/itemAssets.ts` with `common` and `uncommon` rarities.
- `equipmentUtils` aggregates inventory bonuses; arena + combat use `applyEquipmentToCharacter`.
- Inventory modal shows item details on hover/tap and a total bonus summary.

Bots and automation
- Bot engine: `scripts/bot-engine.ts`.
- Keeps population above minimums, spawns growth per scheduled run.
- Same-level fights only; uses shared combat + XP logic for parity.
- Maintains a dynamic protected reserve of level 1 bots based on current level 1 human demand.
- Bots auto-roll the daily lootbox (logs: opened, inventory full, already opened).
- Daily reset script clears `foughtToday` and restores fight energy at Paris midnight.
- Bot activity now uses per-bot profiles and run budgets for more organic pacing.
- Name generator adds a short letter suffix to avoid duplicates in a session.

Offline behavior
- Home works offline; Rankings show “Connection required” state when offline.
- Arena supports read-only view from local snapshot; fights are blocked offline.
- Local storage snapshot is kept except logout, corrupted data, or missing server record.
- Service worker caches the app shell and reloads once on update activation.

UI tuning
- Level-up overlay is responsive, supports deferring stat allocation, and avoids internal scroll.
- Stat rows compress on very small screens; action buttons remain readable.
- Matchmaking intro is an animated opponent scan with a lock effect.
- Inventory modal is larger on desktop, with hover/tap item details and bonus chips.
- Combat actions include subtle 8-bit impact overlays and reaction animations; mobile overlay avoids grid flashes.
- Arena settings modal owns Auto mode toggle, combat logs, and safe delete actions.
- Rankings list is read-only, stats hidden, with internal scroll.
- Home page includes a PATCH NOTES button that opens update notes in a modal.

Testing
- Unit: combat math, lootbox gating, equipment bonuses, XP, stats, RNG.
- Integration: matchmaking, pending fights, lootbox persistence, arena inventory/bonuses,
  offline routing, Firebase failover.

Ops
- GitHub Actions: daily reset scheduled for Paris midnight with a double cron (CET/CEST)
  and a script-side midnight window guard; bot engine runs hourly (UTC top of hour).

Handoff (Next Agent)
- Arena settings logs are rendered inside the same modal (view switch), not a separate popup.
- Bot engine opponent pool is fetched per-level (`where('level','==', level)`, limit 50).
- Lootbox and daily reset are aligned to Paris day.
- Name generator pools were expanded for more variety.
