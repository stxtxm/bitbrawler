# 🕹️ BITBRAWLER - 8-Bit Arena

An authentic 8-bit retro fighting game experience where you create your custom pixel warrior and dominate the arena.

## 🎮 Features

### Core Gameplay
- **8-Bit Aesthetic**: Authentic SVG-based pixel grid rendering and retro terminal UI
- **Pixel Warrior Creation**: Generate unique fighters with randomized pixel grids and color palettes based on seeded randomness
- **Deep RPG System**: Balanced 5-stat system (STR, VIT, DEX, LUK, INT) using a 40-point initial pool
- **Authentic Combat**: Turn-based battle simulation with accuracy, critical hits, and power scaling

### Persistence & Multiplayer
- **Cloud Persistence**: Real-time Firebase Firestore for global character persistence
- **Daily Reset System**: Automatic fight counter reset every 24 hours with server-side timestamp validation
- **Connection Safety**: Complete offline protection - prevents playing with stale data when Firebase is unavailable
- **Data Integrity**: Prioritizes Firestore data over localStorage to ensure consistency across devices

### User Experience
- **PWA Ready**: Installable on mobile and desktop for an arcade experience
- **Error Handling**: Clear user feedback for connection issues with retry functionality
- **Responsive Design**: Optimized for all screen sizes with touch support

### Developer Tools
- **Comprehensive Testing**: Full test suite covering game logic, Firebase integration, and error scenarios
- **Type Safety**: Complete TypeScript coverage for type safety and better DX
- **Performance Optimized**: Minimal bundle size with efficient rendering

## 🛠️ Technologies

- **Frontend**: React 18 + TypeScript + Vite
- **Pixel Engine**: Custom SVG-based pixel grid renderer (No heavy assets)
- **Backend**: Serverless architecture via Firebase Firestore
- **State Management**: React Context with optimized re-renders
- **Testing**: Vitest + React Testing Library with Firebase mocking
- **Deployment**: Optimized for Vercel

## 📦 Installation

1. Clone the project
2. Install dependencies:
   ```bash
   npm install
   ```

## 🚀 Launch

### Start the game locally:
```bash
npm run dev
```

### Run automated tests:
```bash
# All tests
npm run test

# Specific test suites
npm run test -- --run daily-reset
npm run test -- --run firebase-unavailability
npm run test -- --run game-context-integration
```

The application will be available on: http://localhost:5173

## 📁 Project Structure

```
├── src/
│   ├── components/          # React Components (FirebaseError, PixelCharacter, etc.)
│   ├── config/              # Firebase & App Configuration
│   ├── context/             # React Context for Game State (optimized)
│   ├── pages/               # Game Pages (Arena, Creation, Rankings, Login)
│   ├── test/               # Automated Tests (Vitest)
│   ├── types/               # TypeScript definitions
│   ├── utils/               # Combat & Core Game Logic
│   └── styles/              # Global CRT & Scanline styles
├── public/
│   ├── favicon.svg          # 8-bit Icon
│   └── manifest.json        # PWA Config
```

## 🎯 Current State (v0.3)

### ✅ Completed Features
- **Full Firebase Integration**: Complete cloud persistence with real-time sync
- **Daily Reset System**: Server-side validated fight counter with automatic reset
- **Connection Safety**: Comprehensive offline protection and error handling
- **Data Integrity**: Firestore-first approach prevents data inconsistencies
- **Test Coverage**: 100% coverage of critical game logic and error scenarios
- **Performance**: Optimized rendering and state management
- **PWA Support**: Full offline capabilities and installable experience

### 🔧 Technical Improvements
- **Refactored GameContext**: Clean, maintainable state management with proper error boundaries
- **Optimized Firebase Calls**: Reduced redundant queries and improved caching
- **Enhanced Error Handling**: User-friendly error messages with automatic recovery
- **Code Quality**: Removed legacy code, improved TypeScript coverage, and better documentation

### 🚧 In Development
- Real-time multiplayer battles
- Guild system and team battles
- Equipment and item system
- Tournament modes

## 🎮 Game Mechanics

### Character System
- **Stats**: Strength, Vitality, Dexterity, Luck, Intelligence
- **Progression**: Experience points, levels, and win/loss tracking
- **Daily Fights**: 5 fights per day with automatic reset at midnight UTC

### Combat System
- **Turn-based**: Strategic combat with accuracy calculations
- **Critical Hits**: Luck-based critical strike system
- **Power Scaling**: Damage calculation based on character stats and level

### Persistence
- **Real-time Sync**: All character data synced across devices
- **Offline Protection**: Prevents playing when connection is lost
- **Data Recovery**: Automatic recovery when connection is restored

## 🔮 Future Features

- Real-time multiplayer battles
- Guild system and team battles
- Equipment and item system
- Tournament modes
- Spectator mode for live battles

## 📝 Developer Notes

### Architecture Principles
- **Firebase-First**: All critical data operations go through Firestore
- **Error Boundaries**: Comprehensive error handling prevents crashes
- **Performance**: Optimized re-renders and efficient data fetching
- **Testing**: Full test coverage with realistic Firebase mocking

### Key Files
- `src/context/GameContext.tsx`: Main game state management
- `src/components/FirebaseError.tsx`: Connection error handling UI
- `src/test/`: Comprehensive test suite
- `src/utils/`: Core game logic and combat calculations

### Data Flow
1. User action → GameContext → Firebase validation → Local state update
2. Firebase unavailable → Clear local data → Show error UI
3. Connection restored → Automatic re-sync with latest data
