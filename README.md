# BITBRAWLER - 8-Bit Arena

Bitbrawler is a retro 8-bit arena experience where players create a pixel fighter, battle in the arena, and climb the Hall of Fame.

## Features
- 8-bit UI with SVG pixel rendering
- Character creation with RPG stats (STR, VIT, DEX, LUK, INT, FOC)
- Arena fights with XP gain, level ups, and enhanced combat (crit + magic + focus)
- Strict same-level matchmaking with power balancing, daily opponent rotation, and animated opponent scan
- Daily lootbox + inventory items (auto-applied stat bonuses, rarity-based)
- Bot engine with population management and organic activity pacing
- Anti-cheat fight reservation (pending fights resolve even if player quits mid-matchmaking)
- Global daily reset for fights/opponent tracking (scripted, Paris midnight)
- Hall of Fame rankings
- PWA install experience

## Tech Stack
- React 18 + TypeScript + Vite
- Supabase (PostgreSQL)
- Vitest + Testing Library
- Sass

## Getting Started
1. Install dependencies
   ```bash
   npm install
   ```
2. Configure Supabase (see `.env.example`)
3. Run locally
   ```bash
   npm run dev
   ```

## Scripts
```bash
npm test          # Run tests
npm run build     # TypeScript check + production build
npm run bots:run  # Run bot simulation engine
npm run daily-reset:run  # Run daily reset
```

## CI/CD
- **CI**: Automatique sur chaque PR (`lint` → `tsc` → `test` → `build`)
- **OpenCode**: Les agents autonomes creent, reviewent et mergent les PRs via `/oc`
- **Deploiement**: Vercel (auto-deploy sur push main)

## Agents OpenCode
- `dev-agent` (default): Implemente, review et merge automatiquement
- `reviewer`: Revue de code specialisee

Utilise `/oc` ou `/opencode` dans une issue/PR pour declencher un agent.

## Project Structure
```
src/
  components/        UI building blocks (includes Footer)
  config/            Supabase + combat balancing
  context/           Game state and persistence
  hooks/             Online status and connection gates
  pages/             Home, Login, Creation, Arena, Rankings
  scripts/           Bot engine + daily reset scripts
  styles/            Global and page styles
  test/              Vitest suite
  utils/             Game logic (combat, XP, random, matchmaking, supabase)
public/
  sw.js              Service worker
.opencode/
  agents/            Agent definitions
.github/workflows/   CI/CD pipelines
```

## Notes
See `NOTES.md` for implementation details.
