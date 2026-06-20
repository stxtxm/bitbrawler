# BITBRAWLER - QUICK REFERENCE GUIDE

## File Directory Map

### Core Application Files
| File | Lines | Purpose |
|------|-------|---------|
| `src/App.tsx` | 59 | Root routing, online status |
| `src/main.tsx` | - | React DOM render entry |
| `index.html` | 28 | PWA metadata, viewport setup |

### Pages (Lazy-Loaded)
| File | Lines | Route |
|------|-------|-------|
| `src/pages/HomePage.tsx` | - | `/` - Menu screen |
| `src/pages/Login.tsx` | - | `/login` - Character selection |
| `src/pages/CharacterCreation.tsx` | - | `/create-character` - New character |
| `src/pages/Arena.tsx` | 1063 | `/arena` - Main game screen |
| `src/pages/Rankings.tsx` | - | `/rankings` - Leaderboard |
| `src/pages/NotFound.tsx` | - | `/*` - 404 page |

### Components (19 files)
| File | Lines | Purpose |
|------|-------|---------|
| `IdleRunnerScene.tsx` | 241 | PvE idle animation display |
| `CombatView.tsx` | - | Combat UI and animations |
| `PixelCharacter.tsx` | 102 | Procedural character SVG |
| `PixelMonster.tsx` | - | Procedural monster SVG |
| `PixelItemIcon.tsx` | - | Equipment icon rendering |
| `LevelUpOverlay.tsx` | 118 | Level up popup |
| `ConnectionModal.tsx` | 39 | Connection error dialog |
| `StreakIndicator.tsx` | - | Idle streak display |
| `AnimatedPixelCharacter.tsx` | - | Combat animation |
| `LoadingScreen.tsx` | - | Page loading spinner |
| `GameLogo.tsx` | - | Title screen logo |
| `AffinityBadge.tsx` | - | Item affinity display |
| `ErrorBoundary.tsx` | - | Error handler |
| `Footer.tsx` | - | Page footer |
| `StatusScreen.tsx` | - | Character stats display |
| `PixelIcon.tsx` | - | Stat icons (strength, etc) |
| `PixelAssets.ts` | - | Pixel art definitions |

### Hooks (6 files)
| File | Lines | Purpose |
|------|-------|---------|
| `useIdleCombat.ts` | 414 | Core idle combat system ⭐ |
| `useOnlineStatus.ts` | 43 | Network status detection |
| `useConnectionGate.ts` | - | DB connection guard |
| `useLowPerformanceMode.ts` | 16 | Device capability detection |
| `useSound.ts` | - | Audio playback |
| `useFocusTrap.ts` | - | Modal keyboard navigation |

### Utils (22 files)
**Game Logic**:
- `combatUtils.ts` - Damage calculation
- `xpUtils.ts` - XP and leveling
- `idleXpUtils.ts` - Idle XP calculation
- `idleEfficiencyUtils.ts` - Efficiency bonuses ⭐
- `statUtils.ts` - Stat allocation
- `equipmentUtils.ts` - Item equipping
- `lootboxUtils.ts` - Loot drop system

**System Support**:
- `matchmakingUtils.ts` - Opponent selection
- `persistenceUtils.ts` - LocalStorage
- `supabaseUtils.ts` - Database sync
- `dailyReset.ts` - Energy reset

**Utilities**:
- `randomUtils.ts` - Seeded RNG
- `monsterUtils.ts` - Monster generation
- `characterUtils.ts` - Character creation
- `botBehaviorUtils.ts` - Bot AI
- `particleSystem.ts` - Visual effects
- `PerformanceMonitor.ts` - FPS tracking
- `ColorPalette.ts` - Color constants
- `combatLogUtils.ts` - History formatting
- `affinityUtils.ts` - Equipment affinity

### Config (4 files)
| File | Lines | Purpose |
|------|-------|---------|
| `idleConfig.ts` | 21 | Idle timings & efficiency |
| `gameRules.ts` | 31 | Combat balance constants |
| `combatBalance.ts` | - | Damage multipliers |
| `supabase.ts` | - | Database connection |

### Data (4 files)
| File | Lines | Purpose |
|------|-------|---------|
| `itemAssets.ts` | - | Equipment definitions |
| `monsterAssets.ts` | - | Monster data |
| `tileAssets.ts` | - | Terrain tiles |
| `updateNotes.ts` | - | Patch notes |

### Types (3 files)
| File | Lines | Purpose |
|------|-------|---------|
| `Character.ts` | 105 | Player character interface |
| `Item.ts` | - | Equipment interface |
| `IdleCombat.ts` | 20 | Idle system types |

### Styles (29 SCSS files)
**Base** (4 files):
- `_reset.scss` - Normalize
- `_layout.scss` - Flexbox, safe areas
- `_typography.scss` - Fonts, sizes
- `_animations.scss` - Keyframes

**Components** (13 files):
- `_combat-fight.scss` - Combat UI
- `_combat-intro.scss` - Battle start
- `_combat-result.scss` - Victory/loss
- `_idle-runner.scss` - Idle display ⭐
- `_status-screen.scss` - Stats
- `_buttons.scss` - Button styles
- `_forms.scss` - Input fields
- `_streak-indicator.scss` - Streak display
- `_footer.scss` - Footer
- `_game-logo.scss` - Logo
- `_containers.scss` - Box layouts
- `_pwa-install.scss` - PWA prompt
- `_combat.scss` - General combat

**Pages** (8 files):
- `_arena.scss` - Arena layout
- `_arena-equipment.scss` - Equipment panel
- `_arena-inventory.scss` - Inventory panel
- `_arena-settings.scss` - Settings panel
- `_arena-levelup.scss` - Level up UI
- `_character-creation.scss` - Character creation
- `_home.scss` - Home page
- `_login.scss` - Login page
- `_rankings.scss` - Rankings page
- `_not-found.scss` - 404 page

**Main**:
- `_variables.scss` - Colors, mixins
- `main.scss` - Import all

### Tests (62 files total)

**Unit Tests**:
- `lazy-pages.test.ts` - Route lazy loading
- `useSound.test.ts` - Audio system
- `persistence.test.ts` - LocalStorage
- `idleEfficiencyUtils.test.ts` - Efficiency
- `supabase-utils.test.ts` - DB sync

**Integration Tests** (~20+ files):
- `arena-auto-levelup.test.tsx` - Level system
- `arena-pve.test.tsx` - PvE combat
- `arena-inventory.test.tsx` - Equipment
- `arena-offline.test.tsx` - Offline play
- `game-context.test.tsx` - Game state
- `connection-gate.test.tsx` - DB handling
- `app-offline-routing.test.tsx` - Navigation
- `idle-efficiency.test.tsx` - Idle system
- `etc...`

**Component Tests** (5+ files):
- `LevelUpOverlay.test.tsx`
- `PixelMonster.test.tsx`
- `PixelItemIcon.test.tsx`
- `NotFound.test.tsx`
- `AffinityBadge.test.tsx`

---

## Key Constants & Values

### Idle System (idleConfig.ts)
```
BASE_TIMER: 10s
MIN_TIMER: 4.5s (high power ratio)
MONSTER_APPEAR: 1.5s
COMBAT_PHASE: 1.5s
RESULT_PHASE: 1.5s
XP_BONUS_MAX: 30% (power ratio dependent)
STREAK_BONUS: 1% per step, max 25%
STREAK_MILESTONES: 5, 10, 25, 50, 100 kills
```

### Game Rules (gameRules.ts)
```
DAILY_PvP_FIGHTS: 5
DAILY_PvE_FIGHTS: 5
PvP_WIN_XP: 135
PvP_LOSS_XP: 55
PvE_XP_MODIFIER: 80% (of PvP)
STAT_POINTS_PER_LEVEL: 2
TOTAL_STAT_POINTS: 66
BASE_STAT_VALUE: 10
```

### Mobile Breakpoints (_variables.scss)
```
SMALL_MOBILE: max-width 380px (very small phones)
MOBILE: max-width 600px (phones)
TABLET: max-width 768px (tablets)
DESKTOP: > 768px
```

### Responsive Scaling (IdleRunnerScene.tsx)
```
< 480px: scale 6 (small phone)
< 768px: scale 7 (phone)
>= 768px: scale 8 (tablet+)
```

### Performance Detection (useLowPerformanceMode.ts)
```
LOW_PERF: CPU cores <= 4 AND RAM <= 4GB
- Particles: 20 (normal: 60)
- Other effects: Reduced
```

---

## Critical Data Flows

### User Joining Flow
```
1. Visit /
2. Click "Enter Arena"
3. → Redirects to /login (if no character)
4. → Enter name → "Enter Arena"
5. Login request to GameContext
6. Character loaded from DB or created
7. Redirect to /arena
8. useIdleCombat starts idle loop
```

### Idle Combat Tick
```
Every 10s (or 4.5-10s with efficiency):
1. generateMonsterForPlayer()
2. setMonster()
3. Phase: monster_appears (1.5s)
4. Phase: combat (1.5s)
   - simulateCombat()
   - Calculate XP with bonuses
   - Update streak/kills
   - gainXp()
5. Phase: result (1.5s)
6. Phase: running (repeat)
```

### Offline Gains
```
On arena mount (if idle > 30s):
1. calculateOfflinePreview()
   - Calculate fights with efficiency
   - Show popup immediately
2. Async: /api/idle-processor
   - Server recalculates (authoritative)
   - Returns updated character
   - Popup updated with real data
```

### Combat Victory
```
1. simulateCombat() → winner determined
2. useFight() or usePveFight()
3. gainXp() → check for level up
4. If level up: award stat points
5. setLastXpGain() → show popup (3s)
6. setShowLevelUp() → show overlay
7. User allocates stat points
8. syncCharacterToBackend()
9. Overlay auto-closes
```

### Lootbox System
```
1. canRollLootbox() → check if eligible
2. rollLootbox() → random item
3. Add to inventory[]
4. Update equipment if empty slot
5. Show item popup
6. syncCharacterToBackend()
```

---

## Component Props & State Patterns

### Arena.tsx (Main Game Page)
**Key State**:
```typescript
showXpGain: boolean              // XP popup
showLevelUp: boolean             // Level up modal
pendingLevelUp: LevelUpData      // Level info
inventoryOpen: boolean           // Inventory panel
settingsOpen: boolean            // Settings panel
combatData: MatchmakingResult    // Current fight
pveMode: boolean                 // Idle vs PvP mode
```

**useIdleCombat Props**:
```typescript
character: Character              // Current character
isPaused: !pveMode               // Pause when in PvP
onCharacterUpdate: setCharacter   // Update local state
onSyncCharacter: backend sync     // Sync to DB
onLevelUp: (levels, newLevel)    // Handle level up
```

### IdleRunnerScene.tsx (Idle Display)
**Key Props**:
```typescript
character: Character              // Player data
currentMonster: MonsterId         // Current enemy
scenePhase: 'running'|'appears'|'combat'|'result'
lastCombatResult: 'win'|'lose'   // Last outcome
offlineGains: {fights, xp, levels} // Offline popup
```

### CombatView.tsx (PvP Combat)
**Key Props**:
```typescript
pendingOpponent: PendingFightOpponent
character: Character
isMatchmaking: boolean            // Loading state
onStartMatchmaking: () => void
onFight: (won) => void
```

---

## Testing Quick Start

### Run Tests
```bash
npm test                    # Run all Vitest
npm test -- useIdleCombat   # Specific file
npm test -- --coverage      # With coverage
```

### Run E2E Mobile Test
```bash
node mobile-test-final.mjs   # Requires: npm run dev + port 3456
```

### Mobile Device Testing
- **Target**: 412 × 915 (iPhone SE)
- **Scale**: 2.5x (high-DPI)
- **Key Elements**:
  - `.arena-header` - Page loaded
  - `.idle-runner-scene` - PvE display
  - Equipment panel responsive
  - Button tap targets (48px+ recommended)

---

## Performance Budget

### Particle Limits
```
HIGH_PERF:  60 particles max (desktop)
LOW_PERF:   20 particles max (mobile)
```

### Animation FPS
```
IDLE_SCENE:    12.5 FPS (80ms/frame)
COMBAT_SCENE:  60 FPS (full framerate)
```

### Lazy Loading
```
Initial: App.tsx + Route -> LoadingScreen
Then: Lazy load active page (~100-200ms)
Prefetch: Arena after /login or /create-character
```

---

## Common Tasks & File Locations

### To Add New Item
1. `src/data/itemAssets.ts` - Add to ITEM_ASSETS
2. `src/utils/lootboxUtils.ts` - Update LOOTBOX_RARITY_WEIGHTS (if changing rarity)

### To Adjust Balance
1. `src/config/gameRules.ts` - Combat/XP constants
2. `src/config/idleConfig.ts` - Idle timings
3. `src/config/combatBalance.ts` - Damage multipliers

### To Add Mobile Feature
1. `src/hooks/` - New hook if needed
2. `src/styles/_variables.scss` - New mixin
3. `src/components/IdleRunnerScene.tsx` - If affecting idle display

### To Fix Styling
1. `src/styles/components/` - Component styles
2. `src/styles/pages/` - Page-specific
3. `src/styles/base/` - Global overrides

### To Add Notification
1. `src/pages/Arena.tsx` - Add state (showXXX)
2. `src/components/` - Create modal/overlay component
3. `src/styles/components/` - Add styles

---

## Browser APIs Used

### Standard Web APIs
- `localStorage` - Character persistence
- `document.visibilityState` - Pause when hidden
- `navigator.onLine` - Offline detection
- `navigator.hardwareConcurrency` - CPU cores
- `navigator.deviceMemory` - RAM size
- `AudioContext` - Sound effects

### PWA Features
- `manifest.json` - PWA metadata
- Apple touch icons
- Status bar styling (mobile)
- viewport-fit: cover (notch support)

### Not Yet Used (Opportunities)
- Vibration API (haptics)
- Screen Wake Lock API
- Fullscreen API
- Orientation API
- Battery Status API
- WebWorker (for async combat)
- Service Worker (offline caching)

---

## Debugging Tips

### Check Idle Combat
```typescript
// In browser console
localStorage.getItem('character') // Local state
// Watch useIdleCombat in Arena.tsx for:
// - combatLog array
// - currentMonster value
// - idleXpGained accumulator
```

### Monitor Performance
```typescript
// PerformanceMonitor is available but not active
// Could enable in IdleRunnerScene:
import { PerformanceMonitor } from '../utils/PerformanceMonitor'
```

### Test Offline Mode
```typescript
// In browser DevTools:
// Network tab → Set throttling to "Offline"
// App should fallback to localStorage
```

### Check Mobile Layout
```bash
# In DevTools:
# Device toolbar → iPhone SE (412 × 915)
# Or: F12 → Ctrl+Shift+M
```

---

## Dependencies Summary

### Core
- React 18.2
- React Router 6.8
- TypeScript 5.2
- Supabase 2.106

### Build
- Vite 5.0
- SASS Embedded 1.97
- ESLint 9.39

### Testing
- Vitest 1.3
- Playwright 1.55
- React Testing Library 14.2
- JSDOM 24.0

### No External UI Libraries!
- No Material-UI, Ant Design, etc.
- Pure SCSS + React components
- Custom SVG pixel art system

---

## Git Workflow Notes

From AGENTS.md:
- Dev Agent: Issues with `/oc` → auto-implements
- Reviewer Agent: Auto-approves/merges PRs
- Tech Lead: Daily analysis at 21:00 (Paris time)
- QA Tester: E2E gameplay testing

---

End of Quick Reference.
