import { describe, it, expect } from 'vitest';
import {
  registerLoot,
  getCodexProgress,
  getShinyEligible,
  rollShinyWithPity,
  isCodexDiscovered,
  getCodexHint,
  SHINY_PITY_THRESHOLD,
} from '../../utils/codexUtils';
import { CODEX_ENTRIES } from '../../data/codex';
import { Character } from '../../types/Character';

const baseChar = (overrides: Partial<Character> = {}): Character => ({
  name: 'Hero',
  gender: 'male',
  seed: 'abc',
  level: 1,
  experience: 0,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 100,
  maxHp: 100,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  fightHistory: [],
  monsterKills: {},
  essence: 0,
  inventory: [],
  ...overrides,
});

describe('codexUtils', () => {
  describe('registerLoot', () => {
    it('adds id to codex when absent', () => {
      const c = baseChar({ codex: [] });
      const { character, newlyDiscovered } = registerLoot('rusty_sword', c as any);
      expect(newlyDiscovered).toEqual(['rusty_sword']);
      expect(character.codex).toContain('rusty_sword');
    });

    it('idempotent — second call does not duplicate', () => {
      const c = baseChar({ codex: ['rusty_sword'] });
      const { character, newlyDiscovered } = registerLoot('rusty_sword', c as any);
      expect(newlyDiscovered).toEqual([]);
      expect(character.codex?.filter((id) => id === 'rusty_sword').length).toBe(1);
    });

    it('does not mutate original character', () => {
      const c = baseChar({ codex: [] });
      const before = JSON.stringify(c);
      registerLoot('rusty_sword', c as any);
      expect(JSON.stringify(c)).toBe(before);
    });

    it('handles undefined codex (creates array)', () => {
      const c = baseChar();
      const { character, newlyDiscovered } = registerLoot('flame_dagger', c as any);
      expect(newlyDiscovered).toEqual(['flame_dagger']);
      expect(character.codex).toEqual(['flame_dagger']);
    });
  });

  describe('getCodexProgress', () => {
    it('0% when empty', () => {
      const c = baseChar({ codex: [], inventory: [] });
      const p = getCodexProgress(c as any);
      expect(p.seen).toBe(0);
      expect(p.owned).toBe(0);
      expect(p.total).toBe(CODEX_ENTRIES.length);
      expect(p.completionPct).toBe(0);
    });

    it('50% progress', () => {
      const half = CODEX_ENTRIES.slice(0, Math.floor(CODEX_ENTRIES.length / 2)).map((e) => e.id);
      const c = baseChar({ codex: half, inventory: [] });
      const p = getCodexProgress(c as any);
      expect(p.seen).toBe(half.length);
      expect(p.total).toBe(CODEX_ENTRIES.length);
      expect(p.completionPct).toBe(Math.round((half.length / CODEX_ENTRIES.length) * 100));
    });

    it('100% when all discovered', () => {
      const all = CODEX_ENTRIES.map((e) => e.id);
      const c = baseChar({ codex: all, inventory: all });
      const p = getCodexProgress(c as any);
      expect(p.seen).toBe(CODEX_ENTRIES.length);
      expect(p.owned).toBe(CODEX_ENTRIES.length);
      expect(p.completionPct).toBe(100);
    });

    it('owned counts intersection inventory+codex', () => {
      const ids = CODEX_ENTRIES.slice(0, 5).map((e) => e.id);
      const c = baseChar({ codex: ids, inventory: [ids[0], ids[1], 'unknown_item'] });
      const p = getCodexProgress(c as any);
      expect(p.owned).toBe(2);
    });

    it('tolerates undefined codex', () => {
      const c = baseChar();
      const p = getCodexProgress(c as any);
      expect(p.seen).toBe(0);
      expect(p.total).toBe(CODEX_ENTRIES.length);
    });
  });

  describe('getShinyEligible', () => {
    it('returns empty when nothing seen', () => {
      const c = baseChar({ codex: [] });
      expect(getShinyEligible(c as any)).toEqual([]);
    });

    it('returns shinyEligible seen items only', () => {
      const shinyEntry = CODEX_ENTRIES.find((e) => e.shinyEligible)!;
      const nonShiny = CODEX_ENTRIES.find((e) => !e.shinyEligible);
      const c = baseChar({ codex: [shinyEntry.id, ...(nonShiny ? [nonShiny.id] : [])] });
      const eligible = getShinyEligible(c as any);
      expect(eligible).toContain(shinyEntry.id);
      if (nonShiny) expect(eligible).not.toContain(nonShiny.id);
    });

    it('hint ✦ semantics — unseen non-shiny not eligible', () => {
      const allShiny = CODEX_ENTRIES.filter((e) => e.shinyEligible).map((e) => e.id);
      const c = baseChar({ codex: allShiny });
      const eligible = getShinyEligible(c as any);
      expect(eligible.length).toBe(allShiny.length);
    });
  });

  describe('rollShinyWithPity', () => {
    it('pity 0-19 not shiny and increments', () => {
      for (let pity = 0; pity < 20; pity++) {
        const res = rollShinyWithPity(pity, 'common');
        expect(res.isShiny).toBe(false);
        expect(res.nextPity).toBe(pity + 1);
      }
    });

    it('pity 20 forces shiny and resets', () => {
      const res = rollShinyWithPity(20, 'common');
      expect(res.isShiny).toBe(true);
      expect(res.nextPity).toBe(0);
    });

    it('pity >20 also forces shiny', () => {
      const res = rollShinyWithPity(25, 'common');
      expect(res.isShiny).toBe(true);
      expect(res.nextPity).toBe(0);
    });

    it('reset after rare+ (rare/epic/legendary)', () => {
      expect(rollShinyWithPity(5, 'rare').nextPity).toBe(0);
      expect(rollShinyWithPity(5, 'epic').nextPity).toBe(0);
      expect(rollShinyWithPity(5, 'legendary').nextPity).toBe(0);
      expect(rollShinyWithPity(5, 'common').nextPity).toBe(6);
      expect(rollShinyWithPity(5, 'uncommon').nextPity).toBe(6);
    });

    it('rare+ not shiny when pity <20', () => {
      expect(rollShinyWithPity(10, 'rare').isShiny).toBe(false);
      expect(rollShinyWithPity(19, 'epic').isShiny).toBe(false);
    });

    it('rare+ with pity 20 still shiny but resets', () => {
      const res = rollShinyWithPity(20, 'rare');
      expect(res.isShiny).toBe(true);
      expect(res.nextPity).toBe(0);
    });

    it('tolerates invalid pity values', () => {
      expect(rollShinyWithPity(NaN as any, 'common').nextPity).toBe(1);
      expect(rollShinyWithPity(-5 as any, 'common').nextPity).toBe(1);
    });
  });

  describe('isCodexDiscovered', () => {
    it('false when codex undefined', () => {
      const c = baseChar();
      expect(isCodexDiscovered(c as any, 'rusty_sword')).toBe(false);
    });

    it('true when id present', () => {
      const c = baseChar({ codex: ['rusty_sword'] });
      expect(isCodexDiscovered(c as any, 'rusty_sword')).toBe(true);
    });

    it('false when not present', () => {
      const c = baseChar({ codex: ['rusty_sword'] });
      expect(isCodexDiscovered(c as any, 'flame_dagger')).toBe(false);
    });

    it('fallback localStorage when codex undefined', () => {
      const c = baseChar();
      delete (c as any).codex;
      try {
        localStorage.setItem('codex', JSON.stringify(['lucky_charm']));
        expect(isCodexDiscovered(c as any, 'lucky_charm')).toBe(true);
        expect(isCodexDiscovered(c as any, 'rusty_sword')).toBe(false);
      } finally {
        localStorage.removeItem('codex');
      }
    });
  });

  describe('getCodexHint', () => {
    it('returns ??? for unknown id', () => {
      expect(getCodexHint('unknown_id', new Set())).toBe('???');
    });

    it('returns ??? when not seen and no neighbor seen', () => {
      const target = CODEX_ENTRIES[10].id;
      expect(getCodexHint(target, new Set())).toBe('???');
    });

    it('returns ✦ when neighbor seen', () => {
      const idx = 10;
      const target = CODEX_ENTRIES[idx].id;
      const neighbor = CODEX_ENTRIES[idx - 1].id;
      expect(getCodexHint(target, new Set([neighbor]))).toBe('✦');
      const nextNeighbor = CODEX_ENTRIES[idx + 1].id;
      expect(getCodexHint(target, new Set([nextNeighbor]))).toBe('✦');
    });

    it('returns name when itself seen', () => {
      const entry = CODEX_ENTRIES[5];
      expect(getCodexHint(entry.id, new Set([entry.id]))).toBe(entry.name);
    });
  });

  describe('DB tolerance', () => {
    it('getCodexProgress reads localStorage fallback when codex undefined', () => {
      const c = baseChar();
      delete (c as any).codex;
      const sample = CODEX_ENTRIES.slice(0, 3).map((e) => e.id);
      try {
        localStorage.setItem('codex', JSON.stringify(sample));
        const p = getCodexProgress(c as any);
        expect(p.seen).toBe(3);
      } finally {
        localStorage.removeItem('codex');
      }
    });

    it('SHINY_PITY_THRESHOLD is 20', () => {
      expect(SHINY_PITY_THRESHOLD).toBe(20);
    });
  });
});
