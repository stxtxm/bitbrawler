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

Bitbrawler is a retro 8-bit arena experience where players create a pixel fighter, battle in the arena, and climb the Hall of Fame. Built with React, TypeScript, and Supabase.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [CI/CD](#cicd)
- [OpenCode Agents](#opencode-agents)
- [Project Structure](#project-structure)
- [License](#license)

---

## Features

- **8-bit UI** with SVG pixel rendering
- **Character creation** with RPG stats (STR, VIT, DEX, LUK, INT, FOC)
- **Arena fights** with XP gain, level ups, and enhanced combat (crit + magic + focus)
- **Strict same-level matchmaking** with power balancing, daily opponent rotation, and animated opponent scan
- **Daily lootbox + inventory** — auto-applied stat bonuses with rarity system
- **Bot engine** — population management with organic activity pacing
- **Anti-cheat** — fight reservations ensure pending fights resolve even if the player quits mid-matchmaking
- **Global daily reset** — scripted resets at midnight (Paris) for fights and opponent tracking
- **Hall of Fame** rankings
- **PWA** install experience

## Screenshots

> Screenshots and gameplay GIF coming soon. Contributions welcome!

## Tech Stack

| Layer          | Technology                                      |
| -------------- | ----------------------------------------------- |
| Frontend       | React 18 + TypeScript + Vite                    |
| Backend / Auth | Supabase (PostgreSQL, real-time, auth)          |
| Testing        | Vitest + React Testing Library + jsdom          |
| Styling        | Sass (SCSS)                                     |
| Fonts          | Press Start 2P (via Fontsource)                 |
| Scripting      | tsx (TypeScript executor)                       |
| CI/CD          | GitHub Actions + Vercel                         |

## Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/bitbrawler/bitbrawler.git
   cd bitbrawler
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Supabase**
   Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key:
   ```bash
   cp .env.example .env
   ```

4. **Run locally**
   ```bash
   npm run dev
   ```

## Scripts

```bash
npm test               # Run test suite (Vitest)
npm run build          # TypeScript check + Vite production build
npm run lint           # ESLint check
npm run dev            # Start Vite dev server
npm run preview        # Preview production build
npm run bots:run       # Run bot simulation engine
npm run daily-reset:run  # Run daily reset script
```

## CI/CD

- **CI**: Automatic on every PR (`lint` → `tsc` → `test` → `build`) — [ci.yml](.github/workflows/ci.yml)
- **OpenCode**: Autonomous agents create, review, and merge PRs via `/oc` commands — [opencode.yml](.github/workflows/opencode.yml)
- **Bot Activity**: Scheduled bot engine runs — [bot-activity.yml](.github/workflows/bot-activity.yml)
- **Daily Reset**: Scheduled daily reset — [daily-reset.yml](.github/workflows/daily-reset.yml)
- **Deployment**: Vercel (auto-deploy on push to `main`)

## OpenCode Agents

Bitbrawler uses [OpenCode](https://opencode.ai) agents for autonomous development workflows.

| Agent       | Role                                      |
| ----------- | ----------------------------------------- |
| `dev-agent` | Default — implements, reviews, and merges |
| `reviewer`  | Specialized code review                   |

Use `/oc` or `/opencode` in any issue or PR to trigger an agent.

## Project Structure

```
bitbrawler/
├── .github/workflows/       # CI/CD pipelines (ci, opencode, bot-activity, daily-reset)
├── .opencode/agents/        # OpenCode agent definitions
├── public/
│   ├── sw.js                # Service worker (PWA)
│   ├── icon.svg             # App icon
│   └── icon-*.png           # PWA icons
├── src/
│   ├── components/          # UI building blocks
│   │   ├── CombatView.tsx
│   │   ├── ConnectionModal.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── Footer.tsx
│   │   ├── GameLogo.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── PixelAssets.ts
│   │   ├── PixelCharacter.tsx
│   │   ├── PixelIcon.tsx
│   │   ├── PixelItemIcon.tsx
│   │   ├── PwaInstallPrompt.tsx
│   │   └── StatusScreen.tsx
│   ├── config/              # Supabase client, combat balance, game rules
│   │   ├── combatBalance.ts
│   │   ├── gameRules.ts
│   │   └── supabase.ts
│   ├── context/             # Game state and persistence
│   ├── data/                # Static game data (items, update notes)
│   │   ├── itemAssets.ts
│   │   └── updateNotes.ts
│   ├── hooks/               # Online status, connection gates
│   ├── pages/               # Route pages
│   │   ├── Arena.tsx
│   │   ├── CharacterCreation.tsx
│   │   ├── HomePage.tsx
│   │   ├── Login.tsx
│   │   ├── NotFound.tsx
│   │   └── Rankings.tsx
│   ├── routes/              # Lazy loading configuration
│   │   └── lazyPages.ts
│   ├── styles/              # Global and page Sass styles
│   ├── test/                # Vitest test suite
│   ├── types/               # TypeScript type definitions
│   │   ├── Character.ts
│   │   └── Item.ts
│   └── utils/               # Game logic (combat, XP, random, matchmaking, Supabase helpers)
└── .env.example             # Environment variables template
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
