# BITBRAWLER - Contributing Guide

Thank you for your interest in contributing to Bitbrawler! This guide will help you get started.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Pull Request Process](#pull-request-process)
- [Common Issues & Solutions](#common-issues--solutions)

---

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something cool together.

---

## Getting Started

### 1. Fork & Clone

```bash
# Fork on GitHub (click "Fork" button)

# Clone your fork
git clone https://github.com/YOUR_USERNAME/bitbrawler.git
cd bitbrawler

# Add upstream remote for syncing
git remote add upstream https://github.com/stxtxm/bitbrawler.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment

```bash
cp .env.example .env

# Fill in .env with:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_anon_key
```

Get Supabase credentials from [supabase.com](https://supabase.com) (free tier available).

### 4. Verify Setup

```bash
# Run tests
npm test

# Start dev server
npm run dev

# Open http://localhost:5173
```

---

## Development Workflow

### 1. Create a Feature Branch

```bash
# Update main branch first
git fetch upstream
git checkout master
git merge upstream/master

# Create feature branch
git checkout -b feature/my-feature

# Example names:
# feature/new-item-system
# fix/combat-bug
# docs/update-readme
```

### 2. Make Changes

```bash
# Edit files in src/

# Keep commits clean and focused
git add .
git commit -m "feat: add new item type"

# Write clear commit messages (see below)
```

### 3. Run Tests Locally

```bash
# Run all tests
npm test

# Run specific test file
npm test combatUtils

# Run in watch mode
npm test -- --watch
```

### 4. Check Your Code

```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit

# Build
npm run build
```

**All must pass before pushing!**

### 5. Push & Create PR

```bash
git push origin feature/my-feature
```

Then create a PR on GitHub.

---

## Coding Standards

### Commit Messages

Use **conventional commits** format:

```
<type>: <subject>

<body>
<footer>
```

**Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting (no logic changes)
- `refactor:` - Code restructuring (no behavior changes)
- `perf:` - Performance improvement
- `test:` - Adding/updating tests
- `chore:` - Maintenance (deps, build tools, etc.)

**Examples**:
```
feat: add epic lootbox rarity tier

fix: prevent double-click damage multiplier in combat

docs: update README with setup instructions

test: add combatUtils damage calculation tests
```

### Code Style

#### TypeScript

```typescript
// ✅ Good: Clear, typed, simple
function calculateDamage(attacker: Character, defender: Character): number {
  const baseDamage = attacker.stats.str + getWeaponBonus(attacker);
  return Math.round(baseDamage * (0.9 + Math.random() * 0.3));
}

// ❌ Bad: No types, unclear
function getDmg(a, d) {
  return Math.round((a.s + (a.w ? a.w.b : 0)) * (0.9 + Math.random() * 0.3));
}
```

#### React Components

```typescript
// ✅ Good: Clear props, proper typing, clean JSX
interface CombatViewProps {
  character: Character;
  opponent: Character;
  onFightEnd: (winner: Character) => void;
}

export function CombatView({ character, opponent, onFightEnd }: CombatViewProps) {
  const [round, setRound] = useState(0);

  const handleAttack = () => {
    // Combat logic
    onFightEnd(winner);
  };

  return (
    <div className="combat-view">
      <Character data={character} />
      <Character data={opponent} />
      <button onClick={handleAttack}>Attack</button>
    </div>
  );
}

// ❌ Bad: Any types, inline logic, unclear
export function CombatView({ c, o, onEnd }: any) {
  const [r, setR] = useState(0);
  return (
    <div>
      {/* Combat logic mixed in JSX */}
      <button onClick={() => {
        const dmg = c.s * (1 + Math.random());
        o.hp -= dmg;
        if (o.hp <= 0) onEnd(c);
      }}>
        Attack
      </button>
    </div>
  );
}
```

#### Naming Conventions

```typescript
// ✅ Good: Clear, descriptive names
const maxHitPoints = 100;
const calculateCriticalChance = (dexterity: number) => dexterity * 0.5;
const selectOpponentForFight = (character: Character) => {};

// ❌ Bad: Single letters, unclear abbreviations
const mhp = 100;
const calcCC = (dex) => dex * 0.5;
const getOpp = (c) => {};
```

#### Files & Imports

```typescript
// ✅ Clean imports, no unused
import { Character, Item } from '@/types';
import { calculateDamage, selectOpponent } from '@/utils';
import { GameContext } from '@/context';

// ❌ Unused imports, unorganized
import { Character, Item, Game, Config, Stats, Utils } from '@/types';
import * as utils from '@/utils';
import { GameContext, OtherContext, ThirdContext } from '@/context';
```

### No Comments (mostly)

```typescript
// ✅ Good: Code is self-explanatory
function calculateCriticalDamage(baseDamage: number, critChance: number): number {
  if (Math.random() < critChance) {
    return baseDamage * 1.5;
  }
  return baseDamage;
}

// ❌ Bad: Needs comments to understand
function calcCD(bd, cc) {
  // Check if random is less than critical chance
  if (Math.random() < cc) {
    // Multiply by 1.5 for critical
    return bd * 1.5;
  }
  return bd; // Return base damage if not critical
}
```

### Sass/CSS

```scss
// ✅ Good: Scoped, nested properly
.combat-view {
  display: flex;
  gap: 1rem;

  &__character {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  &__stats {
    font-size: 0.875rem;
    color: #666;
  }
}

// ❌ Bad: Global, unnecessary nesting
.combatView {
  display: flex;
}

.combatView .character {
  flex: 1;
}

.combatView .character .stats {
  font-size: 0.875rem;
}
```

---

## Testing Guidelines

### Test Structure

Place tests next to the code they test:

```
src/
├── utils/
│   ├── combatUtils.ts
│   └── combatUtils.test.ts      ← Test here
├── components/
│   ├── CombatView.tsx
│   └── CombatView.test.tsx      ← Test here
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { calculateDamage } from '@/utils/combatUtils';

describe('combatUtils', () => {
  describe('calculateDamage', () => {
    it('should calculate damage based on strength stat', () => {
      const attacker = { stats: { str: 10 } };
      const defender = { stats: { vit: 8 } };
      
      const damage = calculateDamage(attacker, defender);
      
      expect(damage).toBeGreaterThan(0);
      expect(damage).toBeLessThan(20); // Rough range
    });

    it('should apply weapon bonus if equipped', () => {
      const attacker = { 
        stats: { str: 10 },
        equipped: { weapon: { bonus: 5 } }
      };
      const defender = { stats: { vit: 8 } };
      
      const damage = calculateDamage(attacker, defender);
      
      expect(damage).toBeGreaterThanOrEqual(10); // str + weapon bonus
    });
  });
});
```

### Test Checklist

- [ ] Test covers happy path
- [ ] Test covers edge cases
- [ ] Test covers error cases
- [ ] Test is isolated (no dependencies on other tests)
- [ ] Test has clear description
- [ ] Test runs successfully locally

### Run Tests

```bash
# All tests
npm test

# Specific file
npm test combatUtils

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

**All tests must pass before submitting PR.**

---

## Submitting Changes

### Before You Submit

```bash
# 1. Update your branch with latest upstream
git fetch upstream
git rebase upstream/master

# 2. Run all checks
npm run lint
npm test
npm run build

# 3. Fix any issues
# ... make changes ...

# 4. Commit your fixes
git add .
git commit -m "fix: address review feedback"

# 5. Push
git push origin feature/my-feature
```

### Create Pull Request

1. **Go to GitHub** → Compare & pull request
2. **Title**: Short, clear description
   ```
   feat: add epic lootbox rarity
   fix: prevent combat double damage
   ```
3. **Description**: Explain what & why
   ```markdown
   ## Description
   Adds epic rarity tier to lootbox system.
   
   ## Motivation
   Players need better progression at high levels.
   
   ## Changes
   - Added EPIC rarity to constants
   - Updated lootbox distribution logic
   - Added tests for epic drops
   
   ## Related Issue
   Closes #42
   ```

---

## Pull Request Process

### 1. CI Checks

Your PR automatically runs:
- ✅ Lint check
- ✅ Type checking
- ✅ Unit tests (266+)
- ✅ Production build

**All must pass.** If not, fix locally and push again.

### 2. Code Review

**Reviewer agent** reviews your code:
- Code quality & conventions
- Test coverage
- Performance
- Security

**Human reviewers** may also comment.

### 3. Approval & Merge

If approved:
- ✅ PR is **automatically merged** (squash merge)
- ✅ Feature branch is deleted
- ✅ Code deployed to production

If issues:
- ❌ Feedback provided
- ❌ Fix the issues locally
- ❌ Push again

---

## Common Issues & Solutions

### Issue: Tests Fail Locally

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Run tests again
npm test
```

### Issue: Lint Errors

**Solution**:
```bash
# See linting issues
npm run lint

# Auto-fix many issues
npm run lint -- --fix

# Fix remaining issues manually
```

### Issue: Build Fails

**Solution**:
```bash
# Check TypeScript errors
npx tsc --noEmit

# Fix type errors, then build again
npm run build
```

### Issue: Merge Conflicts

**Solution**:
```bash
# Update your branch
git fetch upstream
git rebase upstream/master

# Resolve conflicts in editor
# Then continue rebase
git rebase --continue

# Push (force if needed)
git push origin feature/my-feature --force
```

### Issue: Can't Push (Permission Denied)

**Solution**:
```bash
# Check your remote
git remote -v

# If pushing to upstream instead of your fork:
git remote set-url origin https://github.com/YOUR_USERNAME/bitbrawler.git

# Try again
git push origin feature/my-feature
```

---

## Questions?

- **Setup issues?** → Check [README.md](README.md)
- **Architecture questions?** → See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Testing help?** → Check [TESTING.md](TESTING.md)
- **Workflow explanation?** → See [WORKFLOWS.md](WORKFLOWS.md)

Thank you for contributing! 🎮
