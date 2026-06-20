# BitBrawler Codebase Documentation Index

This directory contains comprehensive documentation of the BitBrawler codebase.

## Overview

BitBrawler is a React-based pixel-art fighting arena game with sophisticated offline/idle combat system. The codebase consists of 136 source files (~10,616 lines of code) built with:

- **Framework**: React 18.2 + TypeScript 5.2
- **Build**: Vite 5.0
- **Styling**: SCSS (mobile-responsive)
- **Testing**: Vitest + React Testing Library + Playwright
- **Backend**: Supabase (PostgreSQL)

## Documentation Files

### 1. CODEBASE_OVERVIEW.md (21 KB, 719 lines) ⭐ START HERE

**Comprehensive architectural guide covering all aspects of the project:**

- **Section 1: Code Structure & Architecture** - Project layout, patterns, React Context
- **Section 2: Mobile Experience** - PWA setup, responsive design, touch handling, test files
- **Section 3: Idle Mode & Background Fighting** - useIdleCombat hook, efficiency system, visual integration
- **Section 4: Feedback System** - Notifications, modals, overlays, user feedback mechanisms
- **Section 5: UI/Graphics & Rendering** - SVG pixel art, procedural generation, animations, styling
- **Section 6: Performance Optimizations** - Memoization, lazy loading, device detection, persistence
- **Section 7: Mobile Test Files** - E2E test inventory and coverage analysis
- **Section 8: Testing Infrastructure** - 62 test files, testing stack, how to run tests
- **Section 9: Data Structures & Types** - Character, Item, IdleCombat interfaces
- **Section 10: Strengths & Gaps Summary** - What works well, improvement opportunities
- **Section 11: Key Files to Know** - Must-read files, config, types, UI
- **Section 12: Build & Run** - Dependencies, scripts, environment setup
- **Conclusion** - Summary and next steps

**Best for**: Getting a complete understanding of the codebase, understanding architecture decisions, deep dives into specific systems.

### 2. QUICK_REFERENCE.md (13 KB, 505 lines) ⭐ FOR QUICK LOOKUPS

**Tabular reference guide for rapid information lookup:**

- **File Directory Map** - All files with line counts and purposes
  - Pages (6 files)
  - Components (19 files)
  - Hooks (6 files)
  - Utils (22 files)
  - Config (4 files)
  - Data (4 files)
  - Types (3 files)
  - Styles (29 SCSS files)
  - Tests (62 files)

- **Key Constants & Values** - Game balance numbers, mobile breakpoints, performance budgets
- **Critical Data Flows** - User joining, idle combat tick, offline gains, combat victory, lootbox
- **Component Props & State Patterns** - Arena.tsx, IdleRunnerScene.tsx, CombatView.tsx
- **Testing Quick Start** - Commands, mobile testing setup, device specs
- **Performance Budget** - Particle limits, animation FPS, lazy loading strategy
- **Common Tasks & File Locations** - How to add items, adjust balance, add mobile features, fix styling
- **Browser APIs Used** - Standard APIs, PWA features, future opportunities
- **Debugging Tips** - Console commands, offline testing, mobile layout checking
- **Dependencies Summary** - All packages organized by category
- **Git Workflow Notes** - Agent-based automation system

**Best for**: Finding specific files quickly, understanding game constants, executing common tasks, quick lookups during development.

## Key Discoveries

### Architectural Strengths
- ✓ React Context + Hooks architecture (well-organized state management)
- ✓ Custom idle combat system (414-line useIdleCombat hook) with efficiency multipliers
- ✓ Full offline support (LocalStorage + Supabase fallback)
- ✓ Comprehensive test coverage (62 test files)
- ✓ Mobile-first responsive design (SCSS mixins for 380px, 600px, 768px breakpoints)
- ✓ Zero external UI libraries (pure React + SCSS)
- ✓ Performance-conscious (lazy loading, memoization, low-perf detection)

### Main Files to Know
1. `src/hooks/useIdleCombat.ts` (414 lines) - Core idle system ⭐
2. `src/pages/Arena.tsx` (1063 lines) - Main game page
3. `src/context/GameContext.tsx` (~900 lines) - State management
4. `src/utils/idleEfficiencyUtils.ts` - Efficiency calculations
5. `src/config/idleConfig.ts` - Idle timing & balance

### Key Features Implemented
- **Idle Combat**: Automatic background fighting with efficiency-based speedup
- **Offline Gains**: Server-validated offline progress calculation
- **Streak System**: Win counter with bonus multipliers (1% per step, capped at 25%)
- **Mobile Scaling**: Dynamic character size based on viewport (6-8x scale)
- **Low-Perf Mode**: Automatic particle reduction (60 → 20) for low-end devices
- **Dual Persistence**: LocalStorage + Supabase with fallback logic

### Testing Coverage
- 62 test files total:
  - Unit tests: 5+ files (lazy-pages, useSound, persistence, etc.)
  - Integration tests: 20+ files (arena flows, combat, offline, etc.)
  - Component tests: 5+ files (overlays, icons, etc.)
- Testing stack: Vitest + React Testing Library + Playwright
- Mobile E2E testing: 4 test files (mobile-test-final.mjs most comprehensive)

### Opportunities for Enhancement
1. **Mobile Features**: Vibration API, screen wake lock, fullscreen API, gesture detection
2. **Feedback System**: Centralized toast queue, sound effects, haptic feedback
3. **Performance**: Service workers, Web Workers for async combat, code splitting
4. **Testing**: Visual regression, performance benchmarking, accessibility audits
5. **Infrastructure**: Battery saver integration, PWA manifest, analytics

## Quick Start

### Reading the Documentation
1. **Start**: Read CODEBASE_OVERVIEW.md (15-20 min read)
   - Understand overall architecture
   - Learn about each major system
   - See data flow diagrams

2. **Lookup**: Use QUICK_REFERENCE.md for specific information
   - Find file locations
   - Check game constants
   - Execute common tasks

3. **Deep Dive**: Open specific source files mentioned in the docs
   - Read core files: GameContext, useIdleCombat, Arena
   - Study utility modules: idleEfficiencyUtils, combatUtils
   - Review configuration: idleConfig, gameRules

### Running the Project
```bash
npm run dev              # Start dev server (port 5173)
npm test                 # Run Vitest
npm run qa:run           # Run QA bot
node mobile-test-final.mjs  # E2E mobile test (requires: npm run dev + port 3456)
```

### Key Commands
- **Check linting**: `npm run lint` (0 warnings enforced)
- **Build production**: `npm run build` (TypeScript check + Vite build)
- **Run specific test**: `npm test -- useIdleCombat`
- **Run with coverage**: `npm test -- --coverage`

## Project Statistics

| Metric | Value |
|--------|-------|
| Source Files | 136 |
| Total Lines of Code | ~10,616 |
| Component Files | 19 |
| Hook Files | 6 |
| Utility Files | 22 |
| Config Files | 4 |
| Style Files | 29 (SCSS) |
| Test Files | 62 |
| Type Definition Files | 3 |

## File Organization

```
bitbrawler/
├── CODEBASE_OVERVIEW.md    ⭐ Start here for deep understanding
├── QUICK_REFERENCE.md      ⭐ Use for quick lookups
├── DOCUMENTATION_INDEX.md  ← You are here
├── src/
│   ├── App.tsx             Root routing
│   ├── main.tsx            Entry point
│   ├── components/         19 React components
│   ├── pages/              6 lazy-loaded pages
│   ├── hooks/              6 custom hooks
│   ├── context/            Game state (GameContext.tsx)
│   ├── utils/              22 utility modules
│   ├── config/             Game constants
│   ├── types/              TypeScript interfaces
│   ├── styles/             29 SCSS files
│   ├── data/               Static data (items, monsters, tiles)
│   ├── routes/             Lazy page imports
│   └── test/               62 test files
├── index.html              PWA metadata
├── mobile-test-final.mjs   E2E mobile test (412×915 iPhone SE)
└── package.json            Dependencies
```

## Technology Stack

### Core
- React 18.2
- React Router 6.8
- TypeScript 5.2
- Supabase 2.106

### Build & Dev
- Vite 5.0
- SASS Embedded 1.97
- ESLint 9.39

### Testing
- Vitest 1.3
- Playwright 1.55
- React Testing Library 14.2
- JSDOM 24.0

### No External UI Libraries!
- Zero Material-UI, Ant Design, etc.
- Everything is custom React + SCSS
- SVG-based procedural pixel art

## Important Notes

### Mobile Experience
- Viewport configured for notch support (`viewport-fit=cover`)
- PWA meta tags for iOS and Android
- Responsive design with SCSS mixins
- Dynamic character scaling (6-8x based on screen size)
- Low-performance mode detection (cores ≤4 AND RAM ≤4GB)

### Idle/Offline System
- **Base interval**: 10 seconds between fights
- **Min interval**: 4.5 seconds (when player is overpowered)
- **Offline gains**: Calculated server-side with client preview
- **Efficiency bonus**: 0-30% from power ratio
- **Streak bonus**: +1% per consecutive win, max 25%
- **Offline detection**: Inactivity > 30 seconds

### State Management
- Single GameContext for all game state
- Character persisted to LocalStorage for offline fallback
- Supabase sync with conflict resolution
- Online/offline routing (can't access arena without character or connection)

### Testing Strategy
- 62 test files covering unit, integration, and component tests
- Mobile E2E testing with Playwright (412×915 viewport)
- Focus on critical paths: combat, leveling, offline, equipment
- Vitest for fast unit tests
- React Testing Library for component testing

## Common Workflows

### To Understand Idle Combat System
1. Read: **CODEBASE_OVERVIEW.md Section 3**
2. Check: `src/config/idleConfig.ts` for timing constants
3. Read: `src/hooks/useIdleCombat.ts` (414 lines, well-commented)
4. Review: `src/utils/idleEfficiencyUtils.ts` for efficiency math
5. See: `src/components/IdleRunnerScene.tsx` for UI integration

### To Adjust Game Balance
1. Check: `src/config/gameRules.ts` (XP values, daily limits)
2. Check: `src/config/idleConfig.ts` (idle timings)
3. Check: `src/config/combatBalance.ts` (damage multipliers)
4. Test: `npm test` to verify changes
5. Check mobile: `node mobile-test-final.mjs` (after `npm run dev`)

### To Add a Mobile Feature
1. Create hook: `src/hooks/useNewFeature.ts`
2. Update styles: `src/styles/_variables.scss` (if responsive)
3. Integrate: `src/pages/Arena.tsx` or relevant component
4. Test: `npm test` and mobile device testing
5. Check responsive: F12 → Device toolbar → iPhone SE (412×915)

### To Run Tests
```bash
npm test                           # All tests
npm test -- idle                   # Tests with "idle" in name
npm test -- --coverage             # Coverage report
npm test -- --watch                # Watch mode
npm test -- ui.test.tsx            # Specific file

# Mobile E2E testing
npm run dev                         # Start dev server (port 5173)
node mobile-test-final.mjs          # Run mobile tests (port 3456 by default)
```

## Contact & Development

This project uses autonomous agents (from AGENTS.md):
- **Dev Agent**: Implements issues with `/oc` tag
- **Reviewer Agent**: Reviews and merges PRs
- **Tech Lead Agent**: Daily analysis at 21:00 (Paris time)
- **QA Tester Agent**: E2E gameplay testing

## License & Attribution

BitBrawler is built with:
- React (Facebook)
- Vite (Evan You)
- TypeScript (Microsoft)
- Supabase (Open Source)
- Pixel art by custom generation

---

**Last Updated**: June 20, 2026
**Documentation Version**: 1.0
**Project Status**: Active development with autonomous agent support
