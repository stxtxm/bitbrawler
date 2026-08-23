import { describe, expect, it } from 'vitest';
import { coerceMonotonicProgress } from '../../utils/persistenceUtils';
import type { Character } from '../../types/Character';

const makeChar = (o: Partial<Character>): Character => ({
  id: 'c1', seed: 's', name: 'T', gender: 'male',
  level: 1, hp: 100, maxHp: 100,
  strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
  experience: 0, wins: 0, losses: 0, fightsLeft: 5, lastFightReset: Date.now(),
  fightHistory: [], foughtToday: [], statPoints: 0, inventory: [],
  lastLootRoll: 0, lootboxStreak: 0, incomingFightHistory: [],
  isBot: false, autoMode: false,
  equippedItems: { weapon: null, armor: null, accessory: null },
  ...o,
} as Character);

describe('coerceMonotonicProgress (level-up FX loop root fix)', () => {
  it('blocks a stale writer from regressing level/experience', () => {
    const current = makeChar({ level: 6, experience: 700, idleTotalXp: 700 });
    const stale = makeChar({ level: 2, experience: 300 });
    const out = coerceMonotonicProgress(stale, current);
    expect(out.experience).toBe(700);
    expect(out.level).toBe(6);
    expect(out.idleTotalXp).toBe(700);
  });

  it('keeps fight cosmetics from the incoming snapshot while adopting progression', () => {
    const current = makeChar({ level: 6, experience: 700 });
    const incoming = makeChar({ level: 2, experience: 300, wins: 9, fightHistory: [{ date: 1 } as any] });
    const out = coerceMonotonicProgress(incoming, current) as Character;
    expect(out.wins).toBe(9);
    expect(out.fightHistory.length).toBe(1);
    expect(out.level).toBe(6);
  });

  it('passes through when incoming XP is higher (no downgrade of fresh progress)', () => {
    const current = makeChar({ level: 2, experience: 300 });
    const fresh = makeChar({ level: 4, experience: 900 });
    const out = coerceMonotonicProgress(fresh, current);
    expect(out.experience).toBe(900);
    expect(out.level).toBe(4);
  });

  it('takes true max on independent counters (essence untouched by guard)', () => {
    const current = makeChar({ level: 6, experience: 700, essence: 50 }) as any;
    const incoming = makeChar({ level: 2, experience: 300, essence: 10 }) as any;
    // essence is NOT part of the guard — spenders must be able to decrease it
    const out = coerceMonotonicProgress(incoming, current);
    expect(out.essence).toBe(10);
  });

  it('is a no-op without a current character', () => {
    const inc = makeChar({ level: 3, experience: 100 });
    expect(coerceMonotonicProgress(inc, null)).toBe(inc);
  });
});
