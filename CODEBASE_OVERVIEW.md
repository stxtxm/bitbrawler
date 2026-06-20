# BITBRAWLER PROJECT - COMPREHENSIVE CODEBASE OVERVIEW

## Project Summary
- **Type**: React + TypeScript web game (pixel art fighting arena)
- **Total Source Files**: 136 files (10,616 lines of code)
- **Framework**: React 18.2 + React Router 6.8 + TypeScript 5.2
- **Build Tool**: Vite 5.0
- **Styling**: SCSS (mobile-responsive)
- **Testing**: Vitest + React Testing Library + Playwright
- **Backend**: Supabase (PostgreSQL)

---

## 1. CODE STRUCTURE & ARCHITECTURE

### Directory Layout
```
src/
├── App.tsx                    # Root component with routing
├── main.tsx                   # Entry point
├── components/                # React components (19 files)
├── pages/                     # Page components (6 files)
├── hooks/                     # Custom React hooks (6 files)
├── context/                   # React Context (GameContext)
├── utils/                     # Utility functions (22 files)
├── config/                    # Game configuration (4 files)
├── data/                      # Static data assets (itemAssets, monsters, tiles)
├── types/                     # TypeScript interfaces (3 files)
├── styles/                    # SCSS stylesheets (29 files)
├── routes/                    # Lazy-loaded page imports
├── generation/                # Procedural content generation
├── assets/                    # Images and visual assets
└── test/                      # Test files (62 files)
    ├── unit/                  # Unit tests
    ├── integration/           # Integration tests
    ├── components/            # Component tests
    └── utils/                 # Utility tests
```

### Key Architectural Patterns

1. **React Context** (GameContext.tsx)
   - Single source of truth for game state
   - Character management, combat, lootbox system
   - Handles both online and offline operations
   - ~900 lines - complex state management

2. **Custom Hooks** Architecture
   - `useIdleCombat.ts` (414 lines) - Idle/background fighting system
   - `useOnlineStatus.ts` - Network connectivity detection
   - `useConnectionGate.ts` - Ensures DB connection before critical ops
   - `useLowPerformanceMode.ts` - Detects low-end devices
   - `useSound.ts` - Audio management
   - `useFocusTrap.ts` - Modal accessibility

3. **Lazy Loading** (routes/lazyPages.ts)
   - All pages lazy-loaded with `React.lazy()`
   - Suspense boundaries with LoadingScreen fallback
   - Prefetch capability for Arena page

4. **Component Organization**
   - SVG-based pixel art characters and monsters
   - Procedural terrain and decor generation
   - Animated combat sequences
   - Status screens and inventory UI

---

## 2. MOBILE EXPERIENCE

### Mobile Setup (Excellent Foundation)

**HTML Meta Tags** (index.html)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

### Responsive Design (SCSS Mixins)
**File**: `src/styles/_variables.scss`

```scss
@mixin mobile {
    @media (max-width: 600px) { @content; }
}

@mixin small-mobile {
    @media (max-width: 380px) { @content; }
}

@mixin tablet {
    @media (max-width: 768px) { @content; }
}
```

**Usage Locations**:
- Layout adjustments: `base/_layout.scss`
- Typography scaling: `base/_typography.scss`
- Component styling: Footer, Status Screen, Buttons
- Page styling: Arena, Forms, etc.

### Mobile-Aware Features

1. **Dynamic Scaling in IdleRunnerScene.tsx** (lines 58-64)
   ```typescript
   const charScale = useMemo(() => {
     const w = typeof window !== 'undefined' ? window.innerWidth : 768
     if (w < 480) return 6
     if (w < 768) return 7
     return 8
   }, [])
   ```

2. **Low Performance Mode Detection** (`useLowPerformanceMode.ts`)
   - Detects: CPU cores ≤ 4 AND memory ≤ 4GB
   - Reduces particle count from 60 to 20
   - Used in `IdleRunnerScene.tsx` and particle systems

3. **Touch-Friendly UI** (Implicit)
   - Large button targets (retro pixel style)
   - Modal-based inventory and settings
   - No hover-only interactions

### Mobile Test Files
Located in project root:
- `mobile-test.mjs` - Basic E2E test
- `mobile-test2.mjs` - Enhanced version
- `mobile-test3.mjs` - Advanced testing
- `mobile-test-final.mjs` (7.8 KB, ~176 lines)
  - **Viewport**: 412x915 (iPhone SE size)
  - **Device Scale**: 2.5x
  - Tests: Login → Character Creation → Arena → PvE Layout

**What's Being Tested**:
- Login and character creation flows
- Arena page loads
- PvE (idle runner) scene rendering
- PvP combat system
- Lootbox claiming
- Equipment equipping
- Responsive layout measurements

---

## 3. IDLE MODE & BACKGROUND FIGHTING

### Core Idle System

**File**: `src/hooks/useIdleCombat.ts` (414 lines) ⭐ KEY FILE

**Features**:
1. **Automatic Background Combat**
   - Generates random monsters every 10 seconds
   - Simulates full combat with damage calculation
   - Awards XP with efficiency bonuses

2. **Offline Processing**
   - Detects inactivity > 30 seconds
   - Calculates offline gains using efficiency multipliers
   - Displays preview popup with estimated gains
   - Server syncs actual results via `/api/idle-processor`

3. **Efficiency System** (idleEfficiencyUtils.ts)
   - Power ratio calculation: Player stats vs Monster stats
   - Effective combat interval: 4.5s - 10s based on power ratio
   - XP bonuses: Up to 30% from efficiency
   - Streak bonuses: 1% per streak step (capped at 25%)

4. **Visibility Tracking**
   ```typescript
   // Pauses combat when tab loses focus
   document.visibilityChange → isPausedRef.current
   ```

5. **Streak System**
   - `idleStreak` - Current win streak
   - `idleMaxStreak` - Personal record
   - `idleTotalKills` - Cumulative kills
   - `idleTotalXp` - Total idle XP earned
   - Streak milestones: 5, 10, 25, 50, 100

**Config** (`src/config/idleConfig.ts`):
```typescript
TIMER_INTERVAL: 10000,              // 10s base
MONSTER_APPEAR_DURATION: 1500,      // 1.5s appear animation
COMBAT_DURATION: 1500,              // 1.5s combat animation
RESULT_DURATION: 1500,              // 1.5s result display
EFFICIENCY.MIN_INTERVAL: 4500,      // Fastest: 4.5s
EFFICIENCY.STREAK_BONUS_PER_STEP: 0.01,  // 1% per streak
EFFICIENCY.STREAK_BONUS_CAP: 0.25,  // Max 25% bonus
```

### Offline Gains Calculation (useIdleCombat.ts, lines 100-147)

```typescript
// 1. Check time since lastActive
const idleMs = Date.now() - lastActive

// 2. Calculate fights with efficiency multiplier
const fights = calculateOfflineFightsWithEfficiency(
  lastActive, 
  Date.now(), 
  effectiveInterval  // Dynamic based on power ratio
)

// 3. Simulate each fight and accumulate XP
for (let i = 0; i < fights; i++) {
  // Simulate combat
  const won = result.winner === 'attacker'
  
  // Apply bonuses
  const xpBonus = computeEfficiency(...).xpBonusMultiplier
  const streakBonus = Math.min(streak * 0.01, 0.25)
  const finalXp = Math.floor(baseXp * (1 + xpBonus) * (1 + streakBonus))
}
```

### IdleRunnerScene Component (useIdleCombat integration)
**File**: `src/components/IdleRunnerScene.tsx` (241 lines)

**Visual Elements**:
- Animated pixel character sprite
- Procedural terrain background
- Floating damage numbers and particles
- XP gain popups
- Combat result animations
- Streak indicator with milestones

**Performance Optimizations**:
- 12 FPS animation loop (vs 60 FPS for combat)
- Particle system with low-perf fallback (20 vs 60 particles)
- Memoized cloud positions and sky gradients
- Ref-based particle system to avoid re-renders

---

## 4. FEEDBACK SYSTEM (Notifications & Alerts)

### Notification Mechanisms

1. **XP Gain Display** (Arena.tsx, lines 561-567)
   ```typescript
   {showXpGain && lastXpGain && (
     <div className="xp-gain-popup">
       +{lastXpGain} XP
     </div>
   )}
   ```
   - Triggered: `lastXpGain` state from GameContext
   - Duration: 3 seconds auto-hide
   - Position: Center screen

2. **Level Up Overlay** (`src/components/LevelUpOverlay.tsx`, 118 lines)
   - Displays level progression (old → new)
   - Shows HP gained
   - Lists stat point allocations
   - Auto-closes after 800ms if no stat points remain
   - Fully styled with retro badge effect

3. **Connection Modal** (`src/components/ConnectionModal.tsx`)
   - Shows when DB connection fails
   - Block critical operations
   - Dismissible by clicking
   - Accessibility: `role="dialog"`, `aria-modal="true"`
   - Uses `useFocusTrap` hook for keyboard handling

4. **Offline Gains Popup** (IdleRunnerScene.tsx)
   - Shows fights, total XP, levels earned during absence
   - Auto-dismissible after viewing
   - Separated from main state to avoid re-renders

### State Management for Feedback
**Arena.tsx** (lines 38-40):
```typescript
const [showXpGain, setShowXpGain] = useState(false)
const [showLevelUp, setShowLevelUp] = useState(false)
const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpData | null>(null)
```

### No Traditional Toast System
⚠️ **Finding**: No centralized toast/notification library (no react-toastify, etc.)
- Uses React state + conditional rendering instead
- Suitable for retro pixel aesthetic
- Could benefit from centralized notification queue

---

## 5. UI/GRAPHICS & RENDERING

### SVG-Based Pixel Art System

1. **Character Rendering** (`PixelCharacter.tsx`, 102 lines)
   - Procedurally generates unique characters from seed
   - Components: Head (7 types male, 7 female) + Body (6 types)
   - Color palettes: skin, hair, clothes, pants, eyes (randomized)
   - Uses `useMemo` for expensive feature generation
   - Renders as SVG grid

2. **Monster Rendering** (`PixelMonster.tsx`)
   - Similar procedural generation
   - Scaled for battle display
   - Data from `monsterAssets.ts`

3. **Item Icons** (`PixelItemIcon.tsx`)
   - SVG-based equipment visualization
   - Different colors by rarity (common, rare, epic)
   - Affinity badges

4. **Procedural Generation**
   - `ProceduralTerrain.tsx` - Grass/dirt tile backgrounds
   - `ProceduralDecor.tsx` - Environmental elements
   - Uses seeded random generation for consistency

5. **Particle System** (`utils/particleSystem.ts`)
   - Custom implementation (not external library)
   - Supports: 'spark', 'heal', 'damage' particle types
   - Mounted to container div
   - Configurable for low-perf mode

### Animation System

**Idle Scene Animations** (12 FPS):
```typescript
// 80ms per frame = 12.5 FPS
const interval = setInterval(() => {
  setAnimFrame(prev => prev + 1)
}, 80)
```

**Combat Animations** (Full framerate):
- Phase-based: monster_appears → combat → result → running
- Duration: 1.5s each phase
- Timed with `setTimeout` cascades

### CSS/SCSS Styling

**Key Stylesheet Files**:
- `base/_reset.scss` - Normalize all elements
- `base/_layout.scss` - Flexbox grids, safe areas
- `base/_typography.scss` - Pixel font (Press Start 2P)
- `base/_animations.scss` - Keyframe animations
- `components/*.scss` - Component-specific styles

**Retro Visual Features**:
- Press Start 2P font exclusively
- Sharp pixel borders (no smoothing)
- Retro color palette (gold #ffcc00, red #ff3333, green #00ff66)
- Pixel shadows (offset box-shadow)

---

## 6. PERFORMANCE OPTIMIZATIONS

### React Memoization

**useMemo Usage**:
- Character feature generation (PixelCharacter.tsx:14)
- Cloud positions (IdleRunnerScene.tsx:66)
- Sky gradients (IdleRunnerScene.tsx:67)
- Combat scan lists (CombatView.tsx:71)
- XP display formatting (CombatView.tsx:270)

**useCallback Usage**:
- Event handlers in GameContext (~10 functions)
- Event handlers in useIdleCombat (~8 functions)
- Combat tick execution (useIdleCombat:231)

### Performance Monitoring

**File**: `src/utils/PerformanceMonitor.ts` (20 lines)
```typescript
class PerformanceMonitor {
  fps = 60
  update() {
    this.frameCount++
    if (now - this.lastTime >= 1000) {
      this.fps = Math.round((frameCount * 1000) / elapsed)
    }
  }
}
```
(Not actively used in UI, but available for debugging)

### Lazy Page Loading

**Implementation** (routes/lazyPages.ts):
```typescript
export const Arena = lazy(() => import('../pages/Arena'))
export const prefetchArena = () => (
  canPrefetch() ? import('../pages/Arena') : Promise.resolve()
)
```

**Usage**:
- Wrapped in Suspense boundary with LoadingScreen fallback
- Prefetch triggered on Login/CharacterCreation success
- Only loads if `navigator.onLine`

### Device Capability Detection

**useLowPerformanceMode.ts**:
```typescript
return cores <= 4 && memory <= 4  // Returns boolean
```

**Application**:
- IdleRunnerScene particles: 20 (low) vs 60 (high)
- Could extend to: animation FPS, texture quality, update frequency

### Persistence Optimization

**LocalStorage Usage** (`persistenceUtils.ts`):
- Syncs character to localStorage as backup
- Max inventory: 20 items (INVENTORY_CAPACITY)
- Normalizes data on load to handle schema changes
- Fallback for DB unavailability

---

## 7. MOBILE TEST FILES (Existing Coverage)

### File Inventory

| File | Size | Focus | Notes |
|------|------|-------|-------|
| `mobile-test.mjs` | 5.2 KB | Basic flow | Login → Create → Arena |
| `mobile-test2.mjs` | 2.4 KB | Light version | Minimal tests |
| `mobile-test3.mjs` | 5.2 KB | Enhanced | Layout testing |
| `mobile-test-final.mjs` | 7.8 KB | Comprehensive | ⭐ Most detailed |

### mobile-test-final.mjs (Most Complete)

**Setup**:
- Viewport: 412 × 915 (iPhone SE)
- Device Scale: 2.5x
- Browser: Chromium headless

**Test Sequence**:
1. Login page - Enter character name
2. Character creation (if new account)
3. Arena page load detection
4. PvE scene measurements
5. Combat button interactions
6. Equipment verification
7. Inventory checks
8. Settings menu

**What It Measures**:
- Element visibility (`.arena-header`, `.idle-runner-scene`)
- Layout dimensions and positioning
- Bounding boxes for responsive elements
- Arena navigation and section headers
- Equipment and inventory panels
- Button accessibility

**Example Output**:
```
scene: 412x670 @ (0,135)
equipment-section: 412x200 @ (0,0)
inventory-count: 5 items
```

---

## 8. KEY UTILITY MODULES

### Combat System
- `combatUtils.ts` - Damage calculation, turn resolution
- `combatLogUtils.ts` - Fight history formatting
- `matchmakingUtils.ts` - Opponent selection algorithm

### XP & Leveling
- `xpUtils.ts` - XP gain, level progression
- `idleXpUtils.ts` - Idle combat XP calculation
- `idleEfficiencyUtils.ts` - Efficiency metrics and bonuses
- `statUtils.ts` - Stat allocation, HP calculation

### Equipment & Inventory
- `equipmentUtils.ts` - Item equipping, stat bonuses
- `lootboxUtils.ts` - Loot drop chances, rarity system

### Persistence & Sync
- `persistenceUtils.ts` - LocalStorage, normalization
- `supabaseUtils.ts` - DB conversion, sync logic
- `dailyReset.ts` - Daily energy reset mechanism

### Procedural Generation
- `randomUtils.ts` - Seeded RNG (mulberry32)
- `monsterUtils.ts` - Monster generation
- `characterUtils.ts` - Character creation

---

## 9. TESTING INFRASTRUCTURE

### Test Files Count: 62 files

**Unit Tests** (src/test/unit/):
- `lazy-pages.test.ts` - Route lazy loading
- `useSound.test.ts` - Audio system
- `persistence.test.ts` - LocalStorage
- `idleEfficiencyUtils.test.ts` - Efficiency calculations
- `supabase-utils.test.ts` - DB conversions

**Integration Tests** (src/test/integration/):
- `arena-auto-levelup.test.tsx` - Level up flow
- `arena-pve.test.tsx` - PvE combat
- `connection-gate.test.tsx` - DB connection handling
- `arena-offline.test.tsx` - Offline play
- `game-context.test.tsx` - State management
- `arena-inventory.test.tsx` - Equipment system
- etc. (~20+ integration tests)

**Component Tests** (src/test/components/):
- `LevelUpOverlay.test.tsx`
- `PixelMonster.test.tsx`
- `PixelItemIcon.test.tsx`
- `NotFound.test.tsx`
- `AffinityBadge.test.tsx`

### Testing Libraries
- **Framework**: Vitest (Vite-native)
- **React Testing**: @testing-library/react
- **User Events**: @testing-library/user-event
- **DOM Matchers**: @testing-library/jest-dom
- **E2E Testing**: Playwright
- **Setup**: JSDOM environment

---

## 10. DATA STRUCTURES & TYPES

### Character Type (Character.ts)
```typescript
interface Character {
  id?: string
  seed: string
  name: string
  gender: 'male' | 'female'
  level: number
  experience: number
  
  // Stats (6-stat RPG system)
  strength, vitality, dexterity, luck, intelligence, focus: number
  
  // Derived
  hp: number
  maxHp: number
  
  // Combat
  wins: number
  losses: number
  fightsLeft: number
  pveFightsLeft?: number
  lastFightReset: number
  
  // Idle System
  idleStreak?: number
  idleMaxStreak?: number
  idleTotalKills?: number
  idleTotalXp?: number
  
  // Persistence
  inventory?: PixelItemAsset[]
  equippedItems?: { weapon, armor, accessory }
  
  // Status
  autoMode?: boolean
  lastActive?: number
  lastIdleCheck?: number
}
```

### Item Type (Item.ts)
```typescript
interface PixelItemAsset {
  id: string
  name: string
  rarity: 'common' | 'rare' | 'epic'
  slot: ItemSlot  // 'weapon' | 'armor' | 'accessory'
  stats: ItemStats  // { strength?, dexterity?, etc }
  pixelData: number[][]  // SVG grid for rendering
}
```

### Idle Combat Entry (IdleCombat.ts)
```typescript
interface IdleCombatEntry {
  timestamp: number
  monsterId: string
  monsterName: string
  won: boolean
  xpGained: number
  damageTaken: number
}

type ScenePhase = 'running' | 'monster_appears' | 'combat' | 'result'

interface IdleEfficiencyData {
  powerRatio: number  // Player power / Monster power
  efficiency: number  // [0, 1]
  effectiveInterval: number  // ms between fights
  xpPerMinute: number
  streakBonus: number
  streakMilestone: number | null
  nextLevelTime: number | null  // ms to next level
}
```

---

## 11. CURRENT STATE SUMMARY

### Strengths ✅
- **Solid React architecture** with context + hooks
- **Comprehensive mobile setup** (viewport, responsive SCSS, scaling)
- **Full offline support** with LocalStorage fallback
- **Sophisticated idle system** with efficiency calculations
- **Good test coverage** (62 test files)
- **Lazy loading** for performance
- **Performance monitoring** hooks available
- **Accessibility** (modals with focus trap, semantic HTML)

### Gaps/Opportunities 📋

1. **Mobile Experience Could Add**:
   - Touch gesture detection (swipe, tap)
   - Vibration API for haptic feedback
   - Screen wake lock for idle mode
   - Fullscreen API for immersive mode

2. **Feedback System Could Add**:
   - Centralized toast/notification queue
   - Sound effects for events (UI feedback)
   - Haptic feedback integration
   - Achievement/milestone notifications

3. **Performance Could Add**:
   - Code splitting beyond lazy pages (component-level)
   - Image optimization (SVG is good, but could use compression)
   - Service worker for offline caching
   - WebWorker for idle combat simulation (offload from main thread)

4. **Testing Could Add**:
   - Visual regression testing
   - Performance benchmarking
   - Accessibility audits
   - More mobile-specific e2e tests (gestures, orientations)

5. **Mobile Optimizations**:
   - Orientation change handling
   - Keyboard appearance/dismissal
   - Network quality detection (3G vs 5G)
   - Battery saver mode integration

---

## 12. KEY FILES TO KNOW

### Must-Read Files
1. **src/App.tsx** - Route setup, online status check
2. **src/context/GameContext.tsx** - Core game state, sync logic
3. **src/hooks/useIdleCombat.ts** - Idle combat implementation
4. **src/components/IdleRunnerScene.tsx** - Idle UI rendering
5. **src/utils/idleEfficiencyUtils.ts** - Efficiency calculations
6. **src/pages/Arena.tsx** - Main game page (1063 lines!)

### Config Files
- **idleConfig.ts** - Idle timing and efficiency constants
- **gameRules.ts** - Combat balance, daily limits
- **combatBalance.ts** - Damage multipliers

### Type Definitions
- **Character.ts** - Player character structure
- **Item.ts** - Equipment and loot
- **IdleCombat.ts** - Idle combat types

---

## 13. BUILD & RUN

### Package Scripts
```bash
npm run dev              # Start Vite dev server
npm run build            # TypeScript check + Vite build
npm run lint             # ESLint (0 warnings enforced)
npm run preview          # Preview production build
npm test                 # Run Vitest
npm run qa:run           # Run QA bot (Playwright)
npm run bots:run         # Run bot engine
npm run db:migrate       # Run migrations
```

### Environment
- **Node.js**: Required
- **Vite**: Hot reload, module federation ready
- **TypeScript**: Strict mode, full type safety
- **Supabase**: PostgreSQL backend

---

## Conclusion

Bitbrawler has a **well-structured React codebase** with strong foundations for mobile gaming:
- Clean component architecture
- Sophisticated offline/idle system
- Responsive design system
- Good test coverage
- Performance-conscious (lazy loading, memoization, low-perf detection)

The main opportunities are:
1. Enhancing mobile-specific features (gestures, vibration, wake lock)
2. Improving feedback system (toast queue, haptics)
3. Advanced performance optimizations (worker threads, service workers)
4. More comprehensive mobile testing (orientation, network conditions)

**Total Codebase**: 136 source files, ~10.6K lines, battle-tested game logic.

