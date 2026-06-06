# BITBRAWLER - Architecture & Technical Design

This document describes the **technical architecture**, **database schema**, **game systems**, and **design patterns** used in Bitbrawler.

---

## Table of Contents

- [System Overview](#system-overview)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Database Schema](#database-schema)
- [Game Systems](#game-systems)
- [Key Design Patterns](#key-design-patterns)
- [Performance Considerations](#performance-considerations)

---

## System Overview

Bitbrawler is a **full-stack web application** with the following layers:

```
┌─────────────────────────────────────────┐
│        Frontend (React + TypeScript)     │
│   (Components, Pages, Game Logic)       │
└──────────────┬──────────────────────────┘
               │
        ┌──────▼─────────┐
        │  Supabase SDK  │
        └──────┬─────────┘
               │
┌──────────────▼──────────────────────────┐
│   Supabase Backend (PostgreSQL + Auth)  │
│   (Database, Real-time, Auth, Storage)  │
└─────────────────────────────────────────┘
```

### Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend Build** | Vite | Fast HMR development, production build |
| **Frontend Framework** | React 18 | UI rendering, state management |
| **Type Safety** | TypeScript 5 | Compile-time type checking |
| **Styling** | Sass (SCSS) | Component styling with nesting |
| **Testing** | Vitest + RTL | Unit & integration tests (266+ tests) |
| **Database** | Supabase (PostgreSQL) | Relational data, real-time subscriptions |
| **Authentication** | Supabase Auth | Email/password auth with JWT |
| **CI/CD** | GitHub Actions | Automated testing, building, deployment |
| **Hosting** | Vercel | CDN, serverless deployment, preview PRs |
| **Autonomous Dev** | OpenCode Agents | AI-powered development automation |

---

## Frontend Architecture

### Directory Structure

```
src/
├── components/              # Reusable UI components
│   ├── CombatView.tsx       # Arena fight display
│   ├── InventoryModal.tsx   # Item management
│   ├── PixelCharacter.tsx   # Pixel art rendering
│   └── ...
│
├── pages/                   # Full-page routes
│   ├── Arena.tsx            # Main game arena
│   ├── CharacterCreation.tsx # Character creation
│   ├── HomePage.tsx         # Landing page + patch notes
│   ├── Rankings.tsx         # Hall of Fame
│   └── ...
│
├── context/                 # React Context (state management)
│   └── GameContext.tsx      # Game state, persistence
│
├── hooks/                   # Custom React hooks
│   ├── useOnlineStatus.ts   # Connection detection
│   └── ...
│
├── config/                  # Configuration & constants
│   ├── gameRules.ts         # Game constants, balance values
│   ├── combatBalance.ts     # Combat formulas, scaling
│   └── supabase.ts          # Supabase client init
│
├── data/                    # Static game data
│   ├── itemAssets.ts        # Items, rarities, stats
│   └── updateNotes.ts       # Version history
│
├── types/                   # TypeScript definitions
│   ├── Character.ts         # Character type
│   ├── Item.ts              # Item type
│   └── ...
│
├── utils/                   # Game logic utilities
│   ├── combatUtils.ts       # Fight calculations
│   ├── xpUtils.ts           # XP & leveling
│   ├── matchmakingUtils.ts  # Opponent selection
│   ├── characterUtils.ts    # Character operations
│   ├── lootboxUtils.ts      # Loot distribution
│   └── ...
│
├── styles/                  # Global Sass styles
│   └── ...
│
└── test/                    # Test suite (266+ tests, 39 files)
    └── ...
```

### State Management

**Game state is managed via React Context + localStorage**:

```typescript
// GameContext provides:
- currentCharacter (Character)
- characterList (Character[])
- gameStatus (connected/disconnected/error)
- auth (user, session)

// Persisted to localStorage for offline support
- Automatic sync on reconnection
```

### Routing

**Simple SPA routing without external router**:

```typescript
// App.tsx uses conditional rendering based on:
- authState (logged in? / sign up?)
- gameStatus (connected? / error?)
- currentPage (arena / rankings / creation)
```

---

## Backend Architecture

### Supabase Structure

**Supabase provides**:
- PostgreSQL relational database
- Real-time subscriptions (for live rankings, opponent changes)
- Authentication (email + password, magic links)
- Storage (for CDN, file uploads if needed)

### Scripts & Utilities

#### `scripts/bot-engine.ts`
- **Purpose**: Simulate bot activity (fights, leveling, progression)
- **Trigger**: Manually or via `bot-activity.yml` (GitHub Actions)
- **Function**: Manages bot population, activity pacing, protection rebalance
- **Output**: Updates bot characters in Supabase

#### `scripts/daily-reset-engine.ts`
- **Purpose**: Global daily reset at midnight (Paris timezone)
- **Trigger**: Manually or via `daily-reset.yml` (GitHub Actions)
- **Function**: Reset player fights, opponent tracking, seasonal stats
- **Output**: Updates character data in Supabase

#### `scripts/analyze-qa-stats.ts`
- **Purpose**: Analyze gameplay stats for balancing insights
- **Trigger**: Via tech-lead.yml (daily)
- **Input**: `qa/stats.json`
- **Output**: `qa/analysis-latest.json` with trends & recommendations

---

## Database Schema

### Main Tables

#### `characters`
```sql
id              UUID PRIMARY KEY
user_id         UUID FOREIGN KEY (auth.users)
name            TEXT
level           INT (1-100)
exp             INT
max_hp          INT
current_hp      INT
stats           JSONB {
  str: INT (1-99),
  vit: INT (1-99),
  dex: INT (1-99),
  luk: INT (1-99),
  int: INT (1-99),
  foc: INT (1-99)
}
inventory       JSONB [Item]
equipped_items  JSONB {
  weapon: Item,
  armor: Item,
  ...
}
rank            INT (calculated)
wins            INT
losses          INT
created_at      TIMESTAMP
updated_at      TIMESTAMP
last_fight_at   TIMESTAMP
last_reset_at   TIMESTAMP (daily reset tracking)
is_bot          BOOLEAN
bot_activity_profile TEXT ('active' | 'casual' | 'inactive')
```

#### `fights`
```sql
id              UUID PRIMARY KEY
player_id       UUID FOREIGN KEY (characters)
opponent_id     UUID FOREIGN KEY (characters)
winner_id       UUID
xp_gained       INT
loot_rarity     TEXT ('common' | 'rare' | 'epic')
damage_dealt    INT
damage_taken    INT
duration_ms     INT
created_at      TIMESTAMP
```

#### `fight_opponents`
Tracks **daily opponent rotation** (one opponent per day, no repeats):
```sql
id              UUID PRIMARY KEY
character_id    UUID FOREIGN KEY (characters)
opponent_id     UUID FOREIGN KEY (characters)
reset_date      DATE
created_at      TIMESTAMP
```

#### `daily_lootbox`
Tracks **lootbox claim status**:
```sql
id              UUID PRIMARY KEY
character_id    UUID FOREIGN KEY (characters)
claimed_at      TIMESTAMP
rarity          TEXT ('common' | 'rare' | 'epic')
reset_date      DATE
```

### View: `character_rankings`
```sql
SELECT
  characters.id,
  characters.name,
  characters.level,
  characters.exp,
  characters.wins,
  ROW_NUMBER() OVER (ORDER BY level DESC, exp DESC) AS rank
FROM characters
WHERE is_bot = false
ORDER BY level DESC, exp DESC
```

---

## Game Systems

### 1. Character Creation & Stats

**Initial Stats** (random with min/max constraints):
```
STR (Strength):   7-13 → Affects damage, physical skills
VIT (Vitality):   7-13 → Affects max HP, survivability
DEX (Dexterity):  7-13 → Affects speed, accuracy, critical chance
LUK (Luck):       7-13 → Affects loot rarity
INT (Intelligence): 7-13 → Affects magic damage
FOC (Focus):      7-13 → Affects focus pool, special abilities
```

**Initial HP Calculation**:
```
max_hp = 20 + (VIT * 2) + random(5-15)
```

### 2. Combat System

#### Combat Flow

1. **Opponent Selection** → Strict same-level matchmaking
2. **Turn-based Combat** → Player vs Bot
3. **Damage Calculation**:
   ```
   base_damage = STR + weapon_bonus + random(-10% to +20%)
   critical = 5% + (DEX * 0.5)% chance
   if critical: damage *= 1.5
   ```
4. **Victory Conditions**:
   - Opponent reaches 0 HP → Player wins ✅
   - Player reaches 0 HP → Player loses ❌

#### XP & Leveling

- **XP per fight**: 25-75 (depends on opponent level)
- **Level up threshold**: `base_xp * (level ^ 1.5)`
- **Level up reward**: +1 random stat (1-3 points), heal 25% HP

### 3. Matchmaking

**Goal**: Same-level fights, fair & interesting

**Algorithm**:
1. Get all available opponents at same level
2. Exclude **daily opponent** (one per day, no repeats)
3. Exclude **defeated opponents** (if too recent)
4. Randomly select from pool

**Opponent Rotation**: Daily reset clears opponent tracking

### 4. Lootbox System

**Rarity Distribution**:
- **Common**: 85% (small stat bonuses)
- **Rare**: 12% (medium stat bonuses + 1 rare modifier)
- **Epic**: 3% (large stat bonuses + 2 rare modifiers)

**Stat Bonuses**:
```
Common: +1-2 to random stat
Rare:   +3-5 to 2 random stats
Epic:   +5-10 to all stats
```

**Daily Limit**: 1 lootbox per day (resets at midnight)

### 5. Bot Activity

**Bot Population Management**:
- Maintain minimum active bots at each level
- Distribute fights evenly (no single bot overused)
- Activity profiles: `active` (fights daily) | `casual` (fights 2-3x/week) | `inactive` (on vacation)

**Protection Rebalance**:
- Prevent same bot from being fought 2x in a row
- Rotate bot lineup daily
- Occasionally "retire" overpowered bots

### 6. Daily Reset

**Triggers at midnight (Paris timezone)**:

1. **Fight Tracker Reset**
   - Clear daily fight counter
   - Allow fresh fights

2. **Opponent Rotation**
   - Clear opponent tracking (see new opponents)
   - Reshuffle bot lineup

3. **Lootbox Reset**
   - Allow new daily lootbox claim
   - Reset lootbox timestamp

4. **Seasonal Stats**
   - Backup wins/losses to seasonal table
   - Calculate rankings

---

## Key Design Patterns

### 1. Context + Hooks

**Problem**: Prop drilling, scattered state

**Solution**: React Context + custom hooks

```typescript
// GameContext manages centralized state
const { character, updateCharacter } = useGame();

// Custom hooks for specific features
const { findOpponent } = useMatchmaking();
const { rollLootbox } = useLootbox();
```

### 2. Utility Functions

**Problem**: Logic scattered in components

**Solution**: Pure utility functions in `src/utils/`

```typescript
// Combat is predictable, testable, and reusable
const damage = calculateDamage(attacker, defender, weapon);

// Matchmaking logic is separate from components
const opponent = selectOpponent(character, availableOpponents);
```

### 3. Type Safety

**All major data structures have TypeScript types**:

```typescript
interface Character {
  id: UUID;
  name: string;
  level: number;
  stats: Stats;
  inventory: Item[];
  // ...
}

interface Item {
  id: UUID;
  name: string;
  type: 'weapon' | 'armor' | 'accessory';
  rarity: 'common' | 'rare' | 'epic';
  bonuses: StatBonus[];
}
```

### 4. Responsive Data Fetching

**Real-time Supabase subscriptions**:

```typescript
// Listen for live updates (character changes, rankings)
const subscription = supabase
  .from('characters')
  .on('UPDATE', (payload) => {
    updateCharacter(payload.new);
  })
  .subscribe();
```

### 5. Offline Support

**Progressive enhancement**:
- Data cached in localStorage
- Auto-sync on reconnection
- Conflict resolution: server wins

---

## Performance Considerations

### Frontend Optimization

1. **Code Splitting**
   - Route-based lazy loading in `src/routes/lazyPages.ts`
   - Components loaded on-demand

2. **Caching**
   - Static item data cached in memory
   - Character data in localStorage
   - Service Worker for offline support

3. **Rendering**
   - Memoization for expensive components
   - Avoid unnecessary re-renders
   - Efficient pixel rendering with Canvas/SVG

### Database Optimization

1. **Indexes**
   ```sql
   CREATE INDEX idx_characters_user_id ON characters(user_id);
   CREATE INDEX idx_characters_level ON characters(level);
   CREATE INDEX idx_fights_created_at ON fights(created_at);
   CREATE INDEX idx_daily_lootbox_reset_date ON daily_lootbox(reset_date);
   ```

2. **Query Optimization**
   - Batch updates where possible
   - Use views for complex queries
   - Avoid N+1 queries

3. **Real-time Subscriptions**
   - Only subscribe to necessary data
   - Unsubscribe on cleanup
   - Debounce updates if too frequent

### Build Optimization

1. **Vite Configuration**
   - Tree-shaking for unused code
   - CSS minification
   - JavaScript minification & mangling

2. **Bundle Size**
   - Monitor with `npm run build`
   - Lazy load non-critical dependencies
   - Use dynamic imports

---

## Testing Strategy

### Unit Tests

- **Utility functions**: combatUtils, xpUtils, matchmakingUtils, etc.
- **Framework**: Vitest
- **Coverage**: 266+ tests, 39 files

### Integration Tests

- **Component tests**: React Testing Library
- **API mocking**: Supabase mock client
- **Test data**: Fixtures in `src/test/fixtures`

### E2E Tests

- **Framework**: Playwright
- **Target**: Live site (bitbrawler.vercel.app)
- **Frequency**: Scheduled daily
- **Output**: `qa/stats.json` with gameplay data

---

## Deployment

### Local Development

```bash
npm install
npm run dev
# Runs on localhost:5173 with HMR
```

### Production Build

```bash
npm run build
# Outputs to dist/
# Ready for Vercel
```

### Deployment Pipeline

1. **Push to `master`** → GitHub
2. **CI Workflow** (lint, test, build)
3. **Preview** on Vercel (auto-generated URL)
4. **Merge to `master`** → Vercel deployment
5. **Live** on bitbrawler.vercel.app

---

## Scaling Considerations

### Current Limits

- PostgreSQL handles 1000+ active players
- Real-time subscriptions scale to 100+ concurrent clients
- Vercel Edge Functions for API routes if needed

### Future Optimizations

1. **Database**
   - Sharding by player level/region
   - Archive historical fight data

2. **Frontend**
   - Service Worker improvements
   - Advanced caching strategies

3. **Backend**
   - API layer for bot operations
   - WebSocket for real-time events
   - Cache layer (Redis) for frequently accessed data

---

## References

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev)
- [Vitest Documentation](https://vitest.dev)
