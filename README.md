# BITBRAWLER - 8-Bit Arena

Bitbrawler is a retro 8-bit arena experience where players create a pixel fighter, battle in the arena, and climb the Hall of Fame.

## Features
- 8-bit UI with SVG pixel rendering
- Character creation with RPG stats (STR, VIT, DEX, LUK, INT)
- Arena fights with XP gain and level ups
- Hall of Fame rankings
- PWA install experience (mobile and desktop)
- Error boundary and connection-aware UX
- Responsive layout for mobile, tablet, desktop, and large displays

## Offline and Sync Behavior
- Gameplay requires Firebase; actions that need a connection show a blocking modal
- Home page is available offline; Rankings display a "Connection required" state
- Local storage is cleared when Firebase is unavailable to prevent stale data
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
```

## Project Structure
```
src/
  components/        UI building blocks (PixelCharacter, ConnectionModal, ErrorBoundary)
  config/            Firebase configuration
  context/           Game state and persistence
  hooks/             Online status and connection gates
  pages/             Home, Login, Creation, Arena, Rankings
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
