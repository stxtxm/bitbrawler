# Agent Handoff

## Core Behavior Guardrails
- Daily combat reset is centralized in `scripts/daily-reset-engine.ts` (Paris midnight logic).
- Bot simulation is in `scripts/bot-engine.ts`.
- Bot daily reset/loot processing runs for all bots, including protected level 1 reserve bots.
- End-of-day bot catch-up is enabled from `GAME_RULES.BOTS.END_OF_DAY_DRAIN_START_HOUR` (Paris hour) to drain remaining fights before reset.

## Player-Facing Privacy Rules
- Arena settings combat logs must not expose attacker type (`[BOT]` / `[PLAYER]` hidden).
- Arena settings combat logs must not show XP lines.
- Incoming combat logs are informational only (no progression impact).

## Testing Conventions
- Router tests should use `renderWithRouter` from `src/test/utils/router.tsx`.
- Keep React Router future flags enabled in tests to avoid v7 migration warnings.
- For lazy route prefetch behavior, validate both online and offline flows (`src/routes/lazyPages.ts`).

## High-Value Regression Checks
- `npm test -- --run`
- `npm run build`
- `npm run lint`

## Change Tracking
- Update player-visible changes in `src/data/updateNotes.ts`.
- Update technical handoff notes in `NOTES.md`.
- Update public summary in `README.md` when behavior or operations change.
