# BITBRAWLER - 8-Bit Arena

Bitbrawler is a retro 8-bit arena experience where players create a pixel fighter, battle in the arena, and climb the Hall of Fame.

## Features
- 8-bit UI with SVG pixel rendering
- Character creation with RPG stats (STR, VIT, DEX, LUK, INT, FOC)
- Arena fights with XP gain, level ups, and enhanced combat (crit + magic + focus)
- Strict same-level matchmaking with power balancing, daily opponent rotation, and animated opponent scan
- Daily lootbox + inventory items (auto-applied stat bonuses, rarity-based)
- Bot engine with population management, real combat simulation, full-energy fights, and daily lootbox usage (hourly scheduler)
- Anti-cheat fight reservation (pending fights resolve even if player quits mid-matchmaking)
- Global daily reset for fights/opponent tracking (scripted, Paris midnight w/ DST-safe cron)
- Hall of Fame rankings
- Arena settings modal with Auto mode toggle, combat logs, and safe character delete
- Home PATCH NOTES modal for quick update summaries
- PWA install experience (mobile and desktop)
- Error boundary and connection-aware UX
- Responsive layout for mobile, tablet, desktop, and large displays

## Offline and Sync Behavior
- Gameplay requires Firebase; actions that need a connection show a blocking modal
- Home page is available offline; Rankings display a "Connection required" state
- Offline snapshot is kept in local storage; it’s cleared only on logout, corrupted data, or missing server record
- Service worker caches the app shell and assets; updates apply silently with a one-time reload when the new worker activates

## Tech Stack
- React 18 + TypeScript + Vite
- Firebase Firestore
- Vitest + Testing Library
- Sass

## Getting Started
1. Install dependencies
   ```bash
   npm install
   ```
2. Configure Firebase (see `.env.example`)
3. Run locally
   ```bash
   npm run dev
   ```

## Scripts
```bash
# Run tests
npm test -- --run

# Build for production
npm run build

# Run bot simulation engine (Firebase Admin required)
npm run bots:run

# Run daily reset (Paris midnight schedule in GitHub Actions)
npm run daily-reset:run
```

## Project Structure
```
src/
  components/        UI building blocks (PixelCharacter, ConnectionModal, ErrorBoundary)
  config/            Firebase + combat balancing configuration
  context/           Game state and persistence
  hooks/             Online status and connection gates
  pages/             Home, Login, Creation, Arena, Rankings
  scripts/           Bot engine + daily reset scripts
  styles/            Global and page styles
  test/              Vitest suite
  utils/             Game logic (combat, XP, random)
public/
  sw.js              Service worker
  manifest.json      PWA config
  icon.svg           App icon (pixel style)
```

## Notes
See `NOTES.md` for recent UI/UX decisions and implementation details.

## Handoff Notes
- Settings modal now owns combat logs (no header icon). Check `src/pages/Arena.tsx` + `src/styles/pages/_arena.scss`.
- Rankings list is read-only (no character switching) and uses internal scroll.
- Daily reset and lootbox gating align to Paris day; bot fights use same-level pools (`scripts/bot-engine.ts`).
