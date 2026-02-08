Project Notes (Latest)

Overview
- Bitbrawler is a retro 8-bit arena brawler with Firebase Firestore as the source of truth.
- Core loop: create a character, fight in the arena, earn XP, level up, climb rankings.

Data model (Character)
- Core fields: `level`, `experience`, stats (STR/VIT/DEX/LUK/INT/FOC), `hp`, `maxHp`, `wins`, `losses`.
- Daily fields: `fightsLeft`, `lastFightReset`, `fightHistory` (cap 20), `foughtToday` (Firestore IDs).
- Progression fields: `statPoints` for level-up allocation, `focus` is an active stat, not derived.
- Inventory fields: `inventory` (item IDs), `lastLootRoll` (UTC timestamp), optional `equipped` reserved for future.
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
- Hit chance is DEX/FOC weighted; crit chance from LUK (capped), magic surge from INT.
- Comeback boost when HP < 40% (damage + hit chance).
- `simulateCombat` returns a timeline for HP animations and combat logs.

Lootbox + inventory
- Daily lootbox gating uses UTC day (`canRollLootbox`).
- Inventory capacity is 24; items are auto-applied (no manual equip flow).
- Items are defined in `src/data/itemAssets.ts` with `common` and `uncommon` rarities.
- `equipmentUtils` aggregates inventory bonuses; arena + combat use `applyEquipmentToCharacter`.
- Inventory modal shows item details on hover/tap and a total bonus summary.

Bots and automation
- Bot engine: `scripts/bot-engine.ts`.
- Keeps population above minimums, runs hourly growth.
- Same-level fights only; uses shared combat + XP logic for parity.
- Bots auto-roll the daily lootbox (logs: opened, inventory full, already opened).
- Daily reset script clears `foughtToday` and restores fight energy.

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

Testing
- Unit: combat math, lootbox gating, equipment bonuses, XP, stats, RNG.
- Integration: matchmaking, pending fights, lootbox persistence, arena inventory/bonuses,
  offline routing, Firebase failover.
