import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import LevelUpOverlay from '../../components/LevelUpOverlay';
import { Character } from '../../types/Character';
import { applyStatPoint, StatKey } from '../../utils/statUtils';

const makeChar = (overrides: Partial<Character> = {}): Character => ({
  id: 'test-id',
  seed: 'seed',
  name: 'Hero',
  gender: 'male',
  level: 5,
  experience: 200,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 100,
  maxHp: 100,
  wins: 3,
  losses: 1,
  fightsLeft: 4,
  pveFightsLeft: 5,
  lastFightReset: Date.now(),
  statPoints: 0,
  inventory: [],
  lastLootRoll: 0,
  lootboxStreak: 0,
  equippedItems: { weapon: null, armor: null, accessory: null },
  ...overrides,
});

describe('Level-up → allocation integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('simulates clicking + three times on different stats (partial allocate, then close)', () => {
    const char = makeChar({ statPoints: 3 });
    let currentChar = char;
    const handleAllocate = vi.fn((stat: 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus') => {
      currentChar = applyStatPoint(currentChar, stat);
    });

    const { rerender } = render(
      <LevelUpOverlay
        shouldShowLevelUp={true}
        activeCharacter={currentChar}
        levelUpData={{ levelsGained: 1, newLevel: 5, hpGained: 10 }}
        isOfflineMode={false}
        statOptions={[
          { key: 'strength', label: 'STR', value: currentChar.strength, hint: 'Damage', icon: 'strength' },
          { key: 'vitality', label: 'VIT', value: currentChar.vitality, hint: 'HP / Defense', icon: 'vitality' },
          { key: 'dexterity', label: 'DEX', value: currentChar.dexterity, hint: 'Speed', icon: 'dexterity' },
          { key: 'luck', label: 'LUK', value: currentChar.luck, hint: 'Crit', icon: 'luck' },
          { key: 'intelligence', label: 'INT', value: currentChar.intelligence, hint: 'Magic', icon: 'intelligence' },
          { key: 'focus', label: 'FOC', value: currentChar.focus, hint: 'Accuracy', icon: 'focus' },
        ]}
        saving={false}
        onAllocateStat={handleAllocate}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('POINTS TO SPEND')).toBeInTheDocument();

    // Click + on strength (10 → 11, points 3→2)
    act(() => { screen.getAllByText('+')[0].click(); });
    expect(handleAllocate).toHaveBeenCalledWith('strength');
    expect(currentChar.statPoints).toBe(2);
    expect(currentChar.strength).toBe(11);

    // Re-render with updated character
    rerender(
      <LevelUpOverlay
        shouldShowLevelUp={true}
        activeCharacter={currentChar}
        levelUpData={{ levelsGained: 1, newLevel: 5, hpGained: 10 }}
        isOfflineMode={false}
        statOptions={[
          { key: 'strength', label: 'STR', value: currentChar.strength, hint: 'Damage', icon: 'strength' },
          { key: 'vitality', label: 'VIT', value: currentChar.vitality, hint: 'HP / Defense', icon: 'vitality' },
        ]}
        saving={false}
        onAllocateStat={handleAllocate}
        onClose={vi.fn()}
      />,
    );

    // Click + on vitality (10 → 11, points 2→1)
    act(() => { screen.getByRole('button', { name: /increase vit/i }).click(); });
    expect(currentChar.statPoints).toBe(1);
    expect(currentChar.vitality).toBe(11);

    // Re-render, click + on strength again (11→12, points 1→0)
    rerender(
      <LevelUpOverlay
        shouldShowLevelUp={true}
        activeCharacter={currentChar}
        levelUpData={{ levelsGained: 1, newLevel: 5, hpGained: 10 }}
        isOfflineMode={false}
        statOptions={[
          { key: 'strength', label: 'STR', value: currentChar.strength, hint: 'Damage', icon: 'strength' },
        ]}
        saving={false}
        onAllocateStat={handleAllocate}
        onClose={vi.fn()}
      />,
    );

    act(() => { screen.getAllByText('+')[0].click(); });
    expect(currentChar.statPoints).toBe(0);
    expect(currentChar.strength).toBe(12);

    // After all points spent
    rerender(
      <LevelUpOverlay
        shouldShowLevelUp={true}
        activeCharacter={currentChar}
        levelUpData={{ levelsGained: 1, newLevel: 5, hpGained: 10 }}
        isOfflineMode={false}
        statOptions={[]}
        saving={false}
        onAllocateStat={handleAllocate}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('ALL POINTS ALLOCATED')).toBeInTheDocument();
    expect(screen.queryAllByText('+')).toHaveLength(0);
  });

  it('allocating stat beyond 15 updates the overlay value', () => {
    let char = makeChar({ statPoints: 2, strength: 15 });
    const handleAllocate = vi.fn((stat: StatKey) => {
      char = applyStatPoint(char, stat);
    });

    const { rerender } = render(
      <LevelUpOverlay
        shouldShowLevelUp={true}
        activeCharacter={char}
        levelUpData={{ levelsGained: 1, newLevel: 5, hpGained: 10 }}
        isOfflineMode={false}
        statOptions={[
          { key: 'strength', label: 'STR', value: char.strength, hint: 'Damage', icon: 'strength' },
        ]}
        saving={false}
        onAllocateStat={handleAllocate}
        onClose={vi.fn()}
      />,
    );

    // strength=15, click → 16
    act(() => { screen.getByText('+').click(); });
    expect(char.strength).toBe(16);
    expect(char.statPoints).toBe(1);

    rerender(
      <LevelUpOverlay
        shouldShowLevelUp={true}
        activeCharacter={char}
        levelUpData={{ levelsGained: 1, newLevel: 5, hpGained: 10 }}
        isOfflineMode={false}
        statOptions={[
          { key: 'strength', label: 'STR', value: char.strength, hint: 'Damage', icon: 'strength' },
        ]}
        saving={false}
        onAllocateStat={handleAllocate}
        onClose={vi.fn()}
      />,
    );

    // strength=16, click → 17
    act(() => { screen.getByText('+').click(); });
    expect(char.strength).toBe(17);
    expect(char.statPoints).toBe(0);
  });

  it('does not allocate when handleAllocateStat returns early (saving guard simulation)', () => {
    // If saving is true, onAllocateStat should not fire
    const handleAlloc = vi.fn();
    const char = makeChar({ statPoints: 2 });

    render(
      <LevelUpOverlay
        shouldShowLevelUp={true}
        activeCharacter={char}
        levelUpData={{ levelsGained: 1, newLevel: 5, hpGained: 10 }}
        isOfflineMode={false}
        statOptions={[
          { key: 'strength', label: 'STR', value: char.strength, hint: 'Damage', icon: 'strength' },
        ]}
        saving={true}
        onAllocateStat={handleAlloc}
        onClose={vi.fn()}
      />,
    );

    // All buttons disabled, click does nothing
    const buttons = screen.getAllByRole('button', { name: /increase/i });
    buttons.forEach(btn => expect(btn).toBeDisabled());
    act(() => { screen.getByText('+')?.click(); });
    expect(handleAlloc).not.toHaveBeenCalled();
  });
});
