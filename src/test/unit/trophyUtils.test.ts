import { describe, it, expect } from 'vitest';
import {
  getTrophyDefs,
  checkTrophies,
  isTrophyUnlocked,
  getTrophyHint,
  getTrophyProgress,
  TROPHY_DEFS,
} from '../../utils/trophyUtils';
import { Character } from '../../types/Character';

const baseChar = (overrides: Partial<Character & { trophies?: string[] }> = {}): Character & { trophies?: string[] } => ({
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
  ...overrides,
});

describe('getTrophyDefs', () => {
  it('returns 20 definitions', () => {
    expect(getTrophyDefs().length).toBe(20);
    expect(TROPHY_DEFS.length).toBe(20);
  });
  it('ids are unique snake_case', () => {
    const ids = getTrophyDefs().map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
  });
  it('at least 5 hidden with hint', () => {
    const hidden = getTrophyDefs().filter(d => d.hidden);
    expect(hidden.length).toBeGreaterThanOrEqual(5);
    for (const h of hidden) expect(h.hint).toBeTruthy();
  });
});

describe('isTrophyUnlocked', () => {
  it('returns false when trophies undefined', () => {
    const c = baseChar();
    expect(isTrophyUnlocked(c, 'fire_dancer')).toBe(false);
  });
  it('returns true when id present', () => {
    const c = baseChar({ trophies: ['fire_dancer'] });
    expect(isTrophyUnlocked(c, 'fire_dancer')).toBe(true);
  });
  it('returns false when not present', () => {
    const c = baseChar({ trophies: ['perfect_5'] });
    expect(isTrophyUnlocked(c, 'fire_dancer')).toBe(false);
  });
});

describe('getTrophyProgress', () => {
  it('counts unlocked vs total', () => {
    const c = baseChar({ trophies: ['fire_dancer', 'perfect_5'] });
    const p = getTrophyProgress(c);
    expect(p.unlocked).toBe(2);
    expect(p.total).toBe(20);
  });
  it('tolerates undefined trophies', () => {
    const c = baseChar();
    const p = getTrophyProgress(c);
    expect(p.unlocked).toBe(0);
    expect(p.total).toBe(20);
  });
});

describe('getTrophyHint', () => {
  it('returns hint when not hidden', () => {
    const def = TROPHY_DEFS.find(d => !d.hidden)!;
    expect(getTrophyHint(def.id, new Set())).toBe(def.hint);
  });
  it('returns ??? when hidden and neighbor locked', () => {
    const hidden = TROPHY_DEFS.find(d => d.hidden)!;
    expect(getTrophyHint(hidden.id, new Set())).toBe('???');
  });
  it('returns hint when hidden but itself unlocked', () => {
    const hidden = TROPHY_DEFS.find(d => d.hidden)!;
    expect(getTrophyHint(hidden.id, new Set([hidden.id]))).toBe(hidden.hint);
  });
  it('returns hint when hidden but predecessor unlocked', () => {
    const idx = TROPHY_DEFS.findIndex(d => d.hidden && TROPHY_DEFS.findIndex(x => x.id === d.id) > 0);
    if (idx > 0) {
      const def = TROPHY_DEFS[idx];
      const prev = TROPHY_DEFS[idx - 1].id;
      expect(getTrophyHint(def.id, new Set([prev]))).toBe(def.hint);
    }
  });
  it('returns ??? for unknown id', () => {
    expect(getTrophyHint('unknown_id', new Set())).toBe('???');
  });
});

describe('checkTrophies', () => {
  it('tolerates trophies undefined', () => {
    const c = baseChar({ wins: 10 });
    expect(() => checkTrophies(c, {})).not.toThrow();
    const res = checkTrophies(c, {});
    expect(res).toContain('iron_will');
  });
  it('does not mutate character', () => {
    const c = baseChar({ wins: 10, trophies: [] });
    const before = JSON.stringify(c);
    checkTrophies(c, {});
    expect(JSON.stringify(c)).toBe(before);
  });
  it('does not return already unlocked', () => {
    const c = baseChar({ wins: 10, trophies: ['iron_will'] });
    const res = checkTrophies(c, {});
    expect(res).not.toContain('iron_will');
  });
  it('is deterministic', () => {
    const c = baseChar({ wins: 10 });
    const r1 = checkTrophies(c, {});
    const r2 = checkTrophies(c, {});
    expect(r1).toEqual(r2);
  });
});

describe('predicates', () => {
  it('perfect_5 requires 5 consecutive wins', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({ date: Date.now() - i * 1000, opponentName: `B${i}`, won: true }));
    const c = baseChar({ fightHistory: history });
    expect(checkTrophies(c, {})).toContain('perfect_5');
    const c2 = baseChar({ fightHistory: [{ date: Date.now(), opponentName: 'B', won: false }, ...history.slice(1)] });
    expect(checkTrophies(c2, {})).not.toContain('perfect_5');
  });
  it('iron_will at 10 wins', () => {
    expect(checkTrophies(baseChar({ wins: 10 }), {})).toContain('iron_will');
    expect(checkTrophies(baseChar({ wins: 9 }), {})).not.toContain('iron_will');
  });
  it('fire_dancer via context', () => {
    expect(checkTrophies(baseChar(), { fireDancerWins: 3 })).toContain('fire_dancer');
    expect(checkTrophies(baseChar(), { fireDancerWins: 2 })).not.toContain('fire_dancer');
  });
  it('midnight_brawler window 22-02 Paris', () => {
    const midnight = new Date('2026-09-14T23:30:00+02:00');
    const noon = new Date('2026-09-14T12:00:00+02:00');
    expect(checkTrophies(baseChar({ wins: 1 }), { now: midnight })).toContain('midnight_brawler');
    expect(checkTrophies(baseChar({ wins: 1 }), { now: noon })).not.toContain('midnight_brawler');
    expect(checkTrophies(baseChar({ wins: 0 }), { now: midnight })).not.toContain('midnight_brawler');
  });
  it('salvage_sage 5 epics', () => {
    expect(checkTrophies(baseChar(), { salvageEpicCount: 5 })).toContain('salvage_sage');
    expect(checkTrophies(baseChar(), { salvageEpicCount: 4 })).not.toContain('salvage_sage');
  });
  it('volcanic_scout requires magma_golem and boss kill', () => {
    const c = baseChar({ monsterKills: { magma_golem: 1 }, bossProgresses: { void_titan: { bossId: 'void_titan', attacksLeft: 1, lastAttackReset: 1, bossHp: 10, bossMaxHp: 100, bossLevel: 5, totalKills: 1, firstEncounterAt: 1 } } as unknown as Character['bossProgresses'] });
    expect(checkTrophies(c, {})).toContain('volcanic_scout');
    const cNoBoss = baseChar({ monsterKills: { magma_golem: 1 } });
    expect(checkTrophies(cNoBoss, {})).not.toContain('volcanic_scout');
    const cNoKill = baseChar({ monsterKills: {}, bossProgresses: { void_titan: { bossId: 'void_titan', attacksLeft: 1, lastAttackReset: 1, bossHp: 10, bossMaxHp: 100, bossLevel: 5, totalKills: 1, firstEncounterAt: 1 } } as unknown as Character['bossProgresses'] });
    expect(checkTrophies(cNoKill, {})).not.toContain('volcanic_scout');
  });
  it('abyssal_slayer via abyssalBossProgress', () => {
    const c = baseChar({ abyssalBossProgress: { bossId: 'abyssal_monarch', attacksLeft: 1, lastAttackReset: 1, bossHp: 0, bossMaxHp: 100, bossLevel: 10, totalKills: 1, firstEncounterAt: 1 } } as unknown as Character);
    expect(checkTrophies(c, {})).toContain('abyssal_slayer');
    expect(checkTrophies(baseChar(), {})).not.toContain('abyssal_slayer');
  });
  it('fusion_alchemist 5 fusions', () => {
    expect(checkTrophies(baseChar(), { fusionCount: 5 })).toContain('fusion_alchemist');
    expect(checkTrophies(baseChar(), { fusionCount: 4 })).not.toContain('fusion_alchemist');
  });
  it('lucky_fusion 1', () => {
    expect(checkTrophies(baseChar(), { fusionLuckyCount: 1 })).toContain('lucky_fusion');
  });
  it('shop_initiate', () => {
    expect(checkTrophies(baseChar(), { shopPurchaseCount: 1 })).toContain('shop_initiate');
  });
  it('level_seeker 20', () => {
    expect(checkTrophies(baseChar({ level: 20 }), {})).toContain('level_seeker');
    expect(checkTrophies(baseChar({ level: 19 }), {})).not.toContain('level_seeker');
  });
  it('essence_hoarder 1000', () => {
    expect(checkTrophies(baseChar({ essence: 1000 }), {})).toContain('essence_hoarder');
    expect(checkTrophies(baseChar({ essence: 999 }), {})).not.toContain('essence_hoarder');
  });
  it('flawless_duelist', () => {
    expect(checkTrophies(baseChar(), { flawlessWin: true })).toContain('flawless_duelist');
    expect(checkTrophies(baseChar(), { flawlessWin: false })).not.toContain('flawless_duelist');
  });
  it('comeback_hero', () => {
    expect(checkTrophies(baseChar(), { comebackWin: true })).toContain('comeback_hero');
  });
  it('goblin_hunter 10', () => {
    expect(checkTrophies(baseChar({ monsterKills: { goblin: 10 } }), {})).toContain('goblin_hunter');
    expect(checkTrophies(baseChar({ monsterKills: { goblin: 9 } }), {})).not.toContain('goblin_hunter');
  });
  it('lava_hound_hunter 5', () => {
    expect(checkTrophies(baseChar({ monsterKills: { lava_hound: 5 } }), {})).toContain('lava_hound_hunter');
  });
  it('chimera_bane 5', () => {
    expect(checkTrophies(baseChar({ monsterKills: { chimera: 5 } }), {})).toContain('chimera_bane');
  });
  it('legendary_collector', () => {
    expect(checkTrophies(baseChar(), { legendaryCount: 1 })).toContain('legendary_collector');
  });
  it('upgrade_master +5', () => {
    expect(checkTrophies(baseChar(), { maxUpgradeLevel: 5 })).toContain('upgrade_master');
  });
  it('idle_streaker 3', () => {
    expect(checkTrophies(baseChar({ idleStreak: 3 }), {})).toContain('idle_streaker');
    expect(checkTrophies(baseChar(), { idleStreak: 3 })).toContain('idle_streaker');
    expect(checkTrophies(baseChar({ idleStreak: 2 }), {})).not.toContain('idle_streaker');
  });
});
