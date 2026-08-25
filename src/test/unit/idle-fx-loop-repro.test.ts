import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleCombat } from '../../hooks/useIdleCombat';
import { Character } from '../../types/Character';

/**
 * Reproduction du bug "LEVEL UP FX rejoué à chaque monstre vaincu" :
 * char lvl 2 (exp ~130), kills donnant ~30 XP chacun → un SEUL crossing
 * attendu sur la séquence, pas un onLevelUp par kill.
 */
const { generateMonsterForPlayerMock } = vi.hoisted(() => ({
  generateMonsterForPlayerMock: vi.fn(),
}));

vi.mock('../../utils/monsterUtils', () => ({
  generateMonsterForPlayer: (...args: unknown[]) => generateMonsterForPlayerMock(...args),
  getReferenceMonster: vi.fn(() => ({
    level: 2, seed: 'ref', name: 'Ref', gender: 'male', experience: 0,
    strength: 8, vitality: 8, dexterity: 8, luck: 8, intelligence: 8, focus: 8,
    hp: 60, maxHp: 60, wins: 0, losses: 0, fightsLeft: 0, lastFightReset: 0,
    equippedItems: { weapon: null, armor: null, accessory: null },
  })),
}));

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'hero-id', seed: 'hero-seed', name: 'Hero', gender: 'male',
  level: 2, experience: 130,
  strength: 12, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
  hp: 120, maxHp: 120, wins: 1, losses: 0, fightsLeft: 5, lastFightReset: Date.now(),
  fightHistory: [], foughtToday: [], statPoints: 0, pendingFight: undefined as any,
  inventory: [], lastLootRoll: 0, lootboxStreak: 0, incomingFightHistory: [],
  isBot: false, autoMode: false,
  equippedItems: { weapon: null, armor: null, accessory: null },
  essence: 5, lastActive: Date.now(), lastIdleCheck: Date.now(),
  idleStreak: 0, idleMaxStreak: 0, idleTotalKills: 0, idleTotalXp: 0,
  ...overrides,
} as Character);

describe('FX loop reproduction — onLevelUp must fire only on REAL crossings', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('10 kills à ~30 XP au lvl 2 : onLevelUp ≤ nombre de vrais crossings (1)', async () => {
    const weakMonster = { character: makeCharacter({ level: 2, hp: 30, maxHp: 30 }), def: { id: 'SLIME', name: 'Slime' } };
    generateMonsterForPlayerMock.mockReturnValue(weakMonster);

    const onLevelUp = vi.fn();
    const updates: Character[] = [];
    const setCharacter = vi.fn((c: Character) => { updates.push(JSON.parse(JSON.stringify(c))); });

    // Simuler Arena: charRef du hook se met à jour via le PROP character
    let current = makeCharacter({ level: 2, experience: 130 });
    const props = {
      character: current,
      isPaused: false,
      onCharacterUpdate: (c: Character) => { current = c; setCharacter(c); },
      onSyncCharacter: vi.fn(),
      onLevelUp,
    };
    const { rerender } = renderHook(() => useIdleCombat(props));
    // prop character initial
    rerender(() => useIdleCombat(props) as any);

    // Faire avancer 10 ticks de combat (t1..t3 + interval)
    for (let i = 0; i < 10; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1500); }); // tick start->t1 zone
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); }); // phases t2/t3
      await act(async () => { await vi.advanceTimersByTimeAsync(6000); }); // interval suivant
      // Simuler Arena qui re-render avec le nouveau personnage (prop -> charRef)
      props.character = current;
      rerender(() => useIdleCombat(props) as any);
    }

    const calls = onLevelUp.mock.calls;
    console.log('onLevelUp calls:', JSON.stringify(calls));
    console.log('final exp:', updates[updates.length-1]?.experience, 'final lvl:', updates[updates.length-1]?.level);

    // Contrat: une annonce par VRAI franchissement. Sur 10 kills ×~30xp depuis
    // 130xp, on traverse lvl3 (240) puis peut-être 4 (496+) → max 2 annonces.
    expect(calls.length).toBeLessThanOrEqual(2);
  });
});
