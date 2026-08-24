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
    expect(out.fightHistory?.length).toBe(1);
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

  it('never coerces a DIFFERENT character id (new char after logout)', () => {
    const previous = makeChar({ id: 'old-char', level: 14, experience: 5000 });
    const fresh = makeChar({ id: 'new-char', level: 1, experience: 0 });
    const out = coerceMonotonicProgress(fresh, previous);
    expect(out.level).toBe(1);
    expect(out.experience).toBe(0);
  });

  it('is a no-op without a current character', () => {
    const inc = makeChar({ level: 3, experience: 100 });
    expect(coerceMonotonicProgress(inc, null)).toBe(inc);
  });
});

import { normalizeCharacter } from '../../utils/persistenceUtils';
import { getTotalXpForLevel } from '../../utils/xpUtils';
import { getHpForVitality } from '../../utils/statUtils';

describe('normalizeCharacter — upward level healing (5.5.2)', () => {
  it('snaps level UP to the curve when experience justifies more', () => {
    const exp = getTotalXpForLevel(9) + 10; // justifie lvl 9
    const out = normalizeCharacter(makeChar({ id: 'heal', level: 5, experience: exp }));
    expect(out.level).toBe(9);
  });

  it('never nerfs a level earned under an older/generous curve', () => {
    // lvl 25 avec XP de courbe lvl 22 : legacy légitime, on ne touche pas
    const exp = getTotalXpForLevel(22);
    const out = normalizeCharacter(makeChar({ id: 'legacy', level: 25, experience: exp }));
    expect(out.level).toBe(25);
  });
});

describe('normalizeCharacter — heal maxHp sync (#798)', () => {
  it('recalculates maxHp from vitality/curve and grants the hp delta when a heal occurs', () => {
    const exp = getTotalXpForLevel(9) + 10;
    const out = normalizeCharacter(
      makeChar({ id: 'heal-hp', level: 5, experience: exp, vitality: 10, hp: 120, maxHp: 150 })
    );
    expect(out.level).toBe(9);
    expect(out.maxHp).toBe(getHpForVitality(10, 9));
    expect(out.hp).toBe(Math.min(120 + (getHpForVitality(10, 9) - 150), getHpForVitality(10, 9)));
  });

  it('never nerfs a legacy maxHp above the canonical value', () => {
    const exp = getTotalXpForLevel(9) + 10;
    const out = normalizeCharacter(
      makeChar({ id: 'legacy-hp', level: 5, experience: exp, vitality: 10, hp: 280, maxHp: 300 })
    );
    expect(out.level).toBe(9);
    expect(out.maxHp).toBe(300);
    expect(out.hp).toBe(280);
  });

  it('clamps hp to maxHp when a stale snapshot has hp above the healed cap', () => {
    const exp = getTotalXpForLevel(9) + 10;
    const out = normalizeCharacter(
      makeChar({ id: 'clamp-hp', level: 5, experience: exp, vitality: 10, hp: 400, maxHp: 150 })
    );
    expect(out.maxHp).toBe(getHpForVitality(10, 9));
    expect(out.hp).toBeLessThanOrEqual(out.maxHp!);
  });

  it('leaves hp/maxHp untouched without a level heal', () => {
    const out = normalizeCharacter(makeChar({ id: 'no-heal', level: 5, hp: 42, maxHp: 99 }));
    expect(out.level).toBe(5);
    expect(out.maxHp).toBe(99);
    expect(out.hp).toBe(42);
  });
});
