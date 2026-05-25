# BITBRAWLER - Testing Guidelines

This document explains **testing strategy**, **test structure**, **how to write tests**, and **testing best practices**.

---

## Table of Contents

- [Testing Overview](#testing-overview)
- [Test Structure](#test-structure)
- [Unit Tests](#unit-tests)
- [Component Tests](#component-tests)
- [Running Tests](#running-tests)
- [Test Best Practices](#test-best-practices)
- [Test Coverage](#test-coverage)
- [Debugging Tests](#debugging-tests)

---

## Testing Overview

### Current Test Suite

- **Framework**: Vitest
- **Component Testing**: React Testing Library
- **Total Tests**: 256+
- **Test Files**: 41+
- **Coverage**: Comprehensive

### Test Pyramid

```
            ⚡ E2E Tests (Playwright)
        [bitbrawler.vercel.app]
               (Live site)
                    
            📦 Integration Tests
        [Components + Utilities]
                    
        🧪 Unit Tests (Vitest)
    [Pure functions, utilities]
```

---

## Test Structure

### Organization

Place tests **next to the code they test**:

```
src/
├── utils/
│   ├── combatUtils.ts
│   ├── combatUtils.test.ts              ← Test file
│   ├── xpUtils.ts
│   ├── xpUtils.test.ts                  ← Test file
│   └── ...
│
├── components/
│   ├── CombatView.tsx
│   ├── CombatView.test.tsx              ← Test file
│   ├── InventoryModal.tsx
│   ├── InventoryModal.test.tsx          ← Test file
│   └── ...
│
└── test/
    └── fixtures/                        ← Shared test data
        ├── character.fixture.ts
        ├── item.fixture.ts
        └── ...
```

### File Naming

```
combatUtils.ts      ← Implementation
combatUtils.test.ts ← Unit test
CombatView.tsx      ← Component
CombatView.test.tsx ← Component test
```

### Test File Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { functionToTest } from '@/utils/combatUtils';
import { createMockCharacter } from '@/test/fixtures';

describe('combatUtils', () => {
  let mockCharacter;

  beforeEach(() => {
    mockCharacter = createMockCharacter();
  });

  describe('functionToTest', () => {
    it('should do something', () => {
      // Arrange
      const input = mockCharacter;

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

---

## Unit Tests

### What to Test

- ✅ Pure utility functions
- ✅ Calculations and business logic
- ✅ Edge cases and error handling
- ✅ Complex algorithms

### Example: Testing Combat Damage

```typescript
import { describe, it, expect } from 'vitest';
import { calculateDamage } from '@/utils/combatUtils';
import { createMockCharacter } from '@/test/fixtures';

describe('calculateDamage', () => {
  it('should calculate damage based on attacker strength', () => {
    const attacker = createMockCharacter({ stats: { str: 15 } });
    const defender = createMockCharacter({ stats: { vit: 10 } });

    const damage = calculateDamage(attacker, defender);

    expect(damage).toBeGreaterThan(0);
    expect(damage).toBeLessThan(50); // Reasonable range
  });

  it('should apply weapon bonus', () => {
    const attacker = createMockCharacter({
      stats: { str: 15 },
      equipped: { weapon: { bonus: 5 } }
    });
    const defender = createMockCharacter({ stats: { vit: 10 } });

    const damage = calculateDamage(attacker, defender);

    expect(damage).toBeGreaterThan(15); // Base damage + bonus
  });

  it('should handle critical hits', () => {
    const attacker = createMockCharacter({ stats: { dex: 20 } }); // High DEX = high crit chance
    const defender = createMockCharacter({ stats: { vit: 10 } });

    let critCount = 0;
    for (let i = 0; i < 100; i++) {
      const damage1 = calculateDamage(attacker, defender);
      const damage2 = calculateDamage(attacker, defender);
      
      if (damage1 > damage2 * 1.4) {
        critCount++;
      }
    }

    expect(critCount).toBeGreaterThan(0); // Some crits expected
  });

  it('should not exceed maximum possible damage', () => {
    const maxAttacker = createMockCharacter({ stats: { str: 99 } });
    const weakDefender = createMockCharacter({ stats: { vit: 1 } });

    const damage = calculateDamage(maxAttacker, weakDefender);

    expect(damage).toBeLessThan(200); // Sanity check
  });
});
```

### Testing Patterns

#### Test Pure Functions

```typescript
// ✅ Good: Pure function, no side effects
function getCharacterLevel(totalXp: number): number {
  let level = 1;
  let requiredXp = 100;
  while (totalXp >= requiredXp) {
    totalXp -= requiredXp;
    level++;
    requiredXp = Math.floor(requiredXp * 1.1);
  }
  return level;
}

it('should calculate level correctly', () => {
  expect(getCharacterLevel(0)).toBe(1);
  expect(getCharacterLevel(100)).toBe(2);
  expect(getCharacterLevel(250)).toBe(3);
});
```

#### Test with Mocks/Fixtures

```typescript
// ✅ Good: Using test fixtures
import { createMockCharacter } from '@/test/fixtures';

it('should apply item bonus', () => {
  const character = createMockCharacter({
    stats: { str: 10 }
  });
  const item = { bonus: { str: 5 } };

  applyItemBonus(character, item);

  expect(character.stats.str).toBe(15);
});
```

#### Test Error Cases

```typescript
it('should throw error if invalid input', () => {
  expect(() => {
    calculateDamage(null, mockDefender);
  }).toThrow();
});

it('should handle edge case values', () => {
  const result = calculateDamage(
    createMockCharacter({ stats: { str: 0 } }),
    createMockCharacter({ stats: { vit: 0 } })
  );
  expect(result).toBeDefined();
  expect(result).toBeGreaterThanOrEqual(0);
});
```

---

## Component Tests

### What to Test

- ✅ Component renders correctly
- ✅ User interactions (clicks, input)
- ✅ Props handling
- ✅ State changes
- ❌ Implementation details

### Example: Testing Combat Component

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CombatView } from '@/components/CombatView';
import { createMockCharacter } from '@/test/fixtures';

describe('CombatView', () => {
  it('should render character and opponent', () => {
    const character = createMockCharacter({ name: 'Hero' });
    const opponent = createMockCharacter({ name: 'Enemy' });
    const mockOnFightEnd = vi.fn();

    render(
      <CombatView
        character={character}
        opponent={opponent}
        onFightEnd={mockOnFightEnd}
      />
    );

    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByText('Enemy')).toBeInTheDocument();
  });

  it('should call onFightEnd when fight completes', () => {
    const character = createMockCharacter({ max_hp: 50, current_hp: 50 });
    const opponent = createMockCharacter({ max_hp: 10, current_hp: 10 });
    const mockOnFightEnd = vi.fn();

    render(
      <CombatView
        character={character}
        opponent={opponent}
        onFightEnd={mockOnFightEnd}
      />
    );

    // Simulate defeating opponent
    const attackButton = screen.getByText('Attack');
    fireEvent.click(attackButton);
    fireEvent.click(attackButton);
    fireEvent.click(attackButton);

    expect(mockOnFightEnd).toHaveBeenCalled();
  });

  it('should display health bars', () => {
    const character = createMockCharacter({ max_hp: 100, current_hp: 75 });
    const opponent = createMockCharacter({ max_hp: 100, current_hp: 50 });

    render(
      <CombatView
        character={character}
        opponent={opponent}
        onFightEnd={vi.fn()}
      />
    );

    const healthBars = screen.getAllByTestId('health-bar');
    expect(healthBars).toHaveLength(2);
  });
});
```

### Testing User Interactions

```typescript
it('should update character HP when taking damage', async () => {
  const { getByTestId } = render(<CombatView {...props} />);
  const attackButton = screen.getByText('Attack');

  fireEvent.click(attackButton);

  // Wait for update
  const opponentHp = await getByTestId('opponent-hp');
  expect(opponentHp).toHaveTextContent(/\d+/); // Some HP remaining
});

it('should show victory message when opponent defeated', async () => {
  // Simulate fight until opponent dies
  const attackButton = screen.getByText('Attack');
  for (let i = 0; i < 10; i++) {
    fireEvent.click(attackButton);
  }

  const victoryMessage = await screen.findByText(/Victory/i);
  expect(victoryMessage).toBeInTheDocument();
});
```

---

## Running Tests

### Run All Tests

```bash
npm test
```

Output:
```
✓ src/utils/combatUtils.test.ts (12 tests)
✓ src/utils/xpUtils.test.ts (8 tests)
✓ src/components/CombatView.test.tsx (6 tests)
...

Test Files  41 passed (41)
Tests      256 passed (256)
```

### Run Specific Test File

```bash
npm test combatUtils
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

Changes to source or test files will re-run tests automatically.

### Run Tests with Coverage

```bash
npm test -- --coverage
```

Output shows:
- Lines covered
- Branches covered
- Functions covered
- Statements covered

### Run Single Test

```typescript
// Use .only to run only this test
it.only('should calculate damage correctly', () => {
  expect(calculateDamage(attacker, defender)).toBeGreaterThan(0);
});
```

### Skip Test

```typescript
// Use .skip to skip this test
it.skip('should be implemented later', () => {
  // Test code
});
```

---

## Test Best Practices

### ✅ Do's

**1. Use Descriptive Test Names**
```typescript
// ✅ Good
it('should calculate damage based on attacker strength stat', () => {});

// ❌ Bad
it('test combat', () => {});
```

**2. Follow AAA Pattern** (Arrange-Act-Assert)
```typescript
it('should calculate damage', () => {
  // Arrange
  const attacker = createMockCharacter({ stats: { str: 15 } });
  const defender = createMockCharacter({ stats: { vit: 10 } });

  // Act
  const damage = calculateDamage(attacker, defender);

  // Assert
  expect(damage).toBeGreaterThan(0);
});
```

**3. Test One Thing Per Test**
```typescript
// ✅ Good: One concept per test
it('should apply strength bonus to damage', () => {
  const damage = calculateDamage(attackerWithBonus, defender);
  expect(damage).toBeGreaterThan(baselineDamage);
});

// ❌ Bad: Multiple concepts
it('should calculate damage and apply bonuses and check crit', () => {
  // Too much in one test
});
```

**4. Use Fixtures for Common Setup**
```typescript
// ✅ Good: Reusable fixture
function createMockCharacter(overrides = {}) {
  return {
    id: 'char-1',
    name: 'Hero',
    level: 1,
    stats: { str: 10, vit: 10, ... },
    ...overrides
  };
}
```

**5. Test Edge Cases**
```typescript
it('should handle edge case: zero strength', () => {
  const attacker = createMockCharacter({ stats: { str: 0 } });
  expect(() => calculateDamage(attacker, defender)).not.toThrow();
});

it('should handle edge case: very high stat values', () => {
  const attacker = createMockCharacter({ stats: { str: 999 } });
  const damage = calculateDamage(attacker, defender);
  expect(damage).toBeLessThan(10000); // Sanity check
});
```

### ❌ Don'ts

**1. Don't Test Implementation Details**
```typescript
// ❌ Bad: Testing internal implementation
it('should set state to fighting', () => {
  const component = render(<CombatView {...props} />);
  expect(component.state.isFighting).toBe(true); // ❌ Don't do this
});

// ✅ Good: Test behavior/output
it('should display attack button during fight', () => {
  render(<CombatView {...props} />);
  expect(screen.getByText('Attack')).toBeInTheDocument();
});
```

**2. Don't Create Fragile Tests**
```typescript
// ❌ Bad: Too specific, breaks on small changes
it('should show exact damage value "42"', () => {
  expect(getDamageDisplay()).toBe('42');
});

// ✅ Good: Test the concept
it('should show damage dealt', () => {
  expect(getDamageDisplay()).toMatch(/^\d+$/);
});
```

**3. Don't Skip Error Cases**
```typescript
// ❌ Bad: Only testing happy path
it('should process lootbox', () => {
  const loot = rollLootbox();
  expect(loot).toBeDefined();
});

// ✅ Good: Test success and failure
it('should return valid loot', () => {
  const loot = rollLootbox();
  expect(loot).toBeDefined();
  expect(loot.rarity).toMatch(/^(common|rare|epic)$/);
});

it('should handle network errors gracefully', async () => {
  mockFetch.mockRejected(new Error('Network error'));
  expect(() => fetchCharacter()).toThrow();
});
```

**4. Don't Make Tests Dependent on Each Other**
```typescript
// ❌ Bad: Tests depend on order
let character;

it('should create character', () => {
  character = createCharacter('Hero');
});

it('should level up character', () => {
  // ❌ Depends on previous test
  character.level = 2;
});

// ✅ Good: Independent tests
it('should create character', () => {
  const character = createCharacter('Hero');
  expect(character.level).toBe(1);
});

it('should level up character', () => {
  const character = createCharacter('Hero');
  levelUp(character);
  expect(character.level).toBe(2);
});
```

---

## Test Coverage

### Coverage Goals

```
Lines:      > 80%
Branches:   > 75%
Functions:  > 80%
Statements: > 80%
```

### Check Coverage

```bash
npm test -- --coverage
```

### Areas That Need Coverage

- **utils/** → 100% (pure functions)
- **components/** → 80% (UI is harder to test)
- **config/** → 80% (constants + initialization)
- **types/** → N/A (no logic)

---

## Debugging Tests

### Test Fails - Common Solutions

**1. Async Issues**

```typescript
// ❌ Bad: Not waiting for async
it('should fetch data', () => {
  fetchData();
  expect(screen.getByText('Data')).toBeInTheDocument(); // Fails!
});

// ✅ Good: Wait for async
it('should fetch data', async () => {
  render(<Component />);
  const element = await screen.findByText('Data');
  expect(element).toBeInTheDocument();
});
```

**2. Mock Issues**

```typescript
// ✅ Good: Mock correctly
vi.mock('@/utils/supabaseUtils', () => ({
  fetchCharacter: vi.fn(() => Promise.resolve(mockCharacter))
}));
```

**3. Timing Issues**

```typescript
// ✅ Good: Wait for state updates
it('should update after state change', async () => {
  fireEvent.click(button);
  
  await waitFor(() => {
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
});
```

### Debug Test Execution

```typescript
import { screen, debug } from '@testing-library/react';

it('should render something', () => {
  render(<Component />);
  
  // Print DOM to console
  debug();
  
  // Print specific element
  debug(screen.getByTestId('my-element'));
});
```

### Run Tests in Debug Mode

```bash
node --inspect-brk ./node_modules/.bin/vitest
```

Then open `chrome://inspect` to debug.

---

## Pre-commit Checks

Before pushing, always run:

```bash
npm run lint
npm test
npm run build
```

All must pass! ✅

---

## References

- [Vitest Documentation](https://vitest.dev)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
