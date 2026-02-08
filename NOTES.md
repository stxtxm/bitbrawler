Project Notes (Latest)

Overview
- Bitbrawler is a retro 8-bit arena brawler with Firebase Firestore as the source of truth.
- Core loop: create a character, fight in the arena, earn XP, level up, climb rankings.

Data model (Character)
- Key fields: `level`, `experience`, stats (STR/VIT/DEX/LUK/INT), `fightsLeft`, `lastFightReset`, `fightHistory`, `foughtToday`, `isBot`.
- `fightHistory` entries include: `date`, `won`, `xpGained`, `opponentName` (latest 20).
- `foughtToday` stores Firestore IDs already fought today to prevent repeats.

Matchmaking
- `src/utils/matchmakingUtils.ts` uses exact same-level matchmaking only.
- Filters out the current player and any opponents in `foughtToday`.
- Selects by closest total stat power and randomizes within the top 3; returns `balanced` or `similar`.

Combat rules
- `simulateCombat` in `src/utils/combatUtils.ts` drives combat for players and bots.
- Hit chance is 70-95% based on DEX; crit chance from LUK with a 1.6x multiplier.
- Magic Surge is INT-based and adds `magicPower * 0.6`; damage variance is ±20%.
- Comeback boost when HP < 40%: +15% damage and +5 hit chance (log includes "🔥").

Fight tracking
- `GameContext.useFight` updates `fightHistory` (cap 20) and `foughtToday` (unique IDs).
- `foughtToday` is persisted to Firestore with each fight.

Bots and automation
- Bot engine: `scripts/bot-engine.ts`.
- Enforces `GAME_RULES.BOTS.MIN_POPULATION` and `MIN_LVL1_BOTS`, and always triggers hourly growth.
- Bots fight same-level opponents only; if none exist, the bot skips fights.
- Uses shared combat + XP logic for parity with player outcomes.
- Daily reset: `scripts/daily-reset-engine.ts` resets fights and clears `foughtToday` for characters last reset before UTC day start.

Service worker and updates
- `public/sw.js` caches the app shell and assets (stale-while-revalidate), and uses network-first for navigation.
- Updates are silent: the new worker skips waiting and a single reload happens on `controllerchange`.
- Current SW version is `v3` (bumped to force cache refresh).

Offline behavior
- Home page is accessible offline.
- Rankings show "Connection required" when offline or Firebase is unavailable.
- Login, New Game, and Arena actions use `useConnectionGate` to block actions and show `ConnectionModal`.
- Arena is accessible offline in read-only mode using the last synced snapshot; fights are disabled and a warning banner is shown.
- Local storage is kept on Firebase/network errors to allow offline snapshots; it's cleared only on logout, corrupted data, or missing server record.
- `/arena` redirects to `/` when there is no active character and offline/unavailable.
- Daily reset is gated by a loading screen to avoid stat “flash” when energy resets.

UI tuning
- Arena header action buttons are larger and spaced more on mobile/tablet.
- Arena has an Inventory modal (backpack icon) with a responsive grid of empty slots.
- Character creation layout tuned for mobile and small screens.
- Small mobile overrides reduce stat density to avoid vertical scroll.
- Action buttons are positioned to fill remaining space without forcing scroll.
- Creation form uses `min-height: clamp(200px, 34vh, 340px)`.

Icons
- `public/icon.svg` matches the PNG icon style; Apple touch icons are in `public/`.
- `PixelIcon` includes a backpack icon for the Inventory button.

Known warnings (build)
- Sass deprecations resolved: `@import` replaced with `meta.load-css`, `darken()` replaced with `color.adjust`, Vite Sass API set to `modern`.
- Bundle size warning resolved via Rollup `manualChunks`; routes are lazy-loaded with prefetch on Login/Character creation.
