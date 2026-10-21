import { describe, it, expect } from 'vitest';
import {
  getBestiaryProgress,
  incrementMonsterCounter,
  mergeMonsterCounters,
} from '../../utils/bestiaryUtils';
import { MONSTER_ASSETS } from '../../data/monsterAssets';

describe('bestiaryUtils', () => {
  describe('getBestiaryProgress', () => {
    it('returns 0% completion when no monster has been killed', () => {
      const progress = getBestiaryProgress({ monsterKills: {} });

      expect(progress.total).toBe(MONSTER_ASSETS.length);
      expect(progress.seen).toBe(0);
      expect(progress.completionPct).toBe(0);
      expect(progress.entries).toHaveLength(MONSTER_ASSETS.length);
      expect(progress.entries.every((entry) => entry.seen === false)).toBe(true);
      expect(progress.entries.every((entry) => entry.kills === 0)).toBe(true);
      expect(progress.entries.every((entry) => entry.encounters === 0)).toBe(true);
    });

    it('computes a rounded completion percentage from partial kills', () => {
      const progress = getBestiaryProgress({ monsterKills: { goblin: 3, ogre: 1 } });

      expect(progress.seen).toBe(2);
      expect(progress.completionPct).toBe(Math.round((2 / MONSTER_ASSETS.length) * 100));
    });

    it('reaches 100% when every monster has been killed at least once', () => {
      const monsterKills = Object.fromEntries(MONSTER_ASSETS.map((monster) => [monster.id, 1]));
      const progress = getBestiaryProgress({ monsterKills });

      expect(progress.seen).toBe(MONSTER_ASSETS.length);
      expect(progress.completionPct).toBe(100);
      expect(progress.entries.every((entry) => entry.seen === true)).toBe(true);
    });

    it('tolerates undefined monsterKills without crashing', () => {
      const progress = getBestiaryProgress({});

      expect(progress.seen).toBe(0);
      expect(progress.completionPct).toBe(0);
      expect(progress.total).toBe(MONSTER_ASSETS.length);
    });

    it('exposes monster identity and kill count for each entry', () => {
      const progress = getBestiaryProgress({ monsterKills: { goblin: 7 } });
      const goblin = progress.entries.find((entry) => entry.id === 'goblin');

      expect(goblin).toEqual({
        id: 'goblin',
        name: 'Goblin',
        element: 'wind',
        seen: true,
        kills: 7,
        encounters: 7,
      });
    });

    it('does not mutate the character kill map', () => {
      const monsterKills = { goblin: 2 };
      const before = JSON.stringify(monsterKills);

      getBestiaryProgress({ monsterKills });

      expect(JSON.stringify(monsterKills)).toBe(before);
    });

    it('reveals monsters that were only encountered in defeat', () => {
      const progress = getBestiaryProgress({ monsterEncounters: { goblin: 3 } });
      const goblin = progress.entries.find((entry) => entry.id === 'goblin');

      expect(goblin).toMatchObject({ seen: true, kills: 0, encounters: 3 });
      expect(progress.seen).toBe(1);
    });

    it('counts legacy kills as encounters when the encounter map is missing', () => {
      const progress = getBestiaryProgress({ monsterKills: { ogre: 2 } });
      const ogre = progress.entries.find((entry) => entry.id === 'ogre');

      expect(ogre).toMatchObject({ seen: true, kills: 2, encounters: 2 });
    });

    it('keeps counters monotonic when kills exceed encounters', () => {
      const progress = getBestiaryProgress({
        monsterKills: { wraith: 4 },
        monsterEncounters: { wraith: 2 },
      });
      const wraith = progress.entries.find((entry) => entry.id === 'wraith');

      expect(wraith).toMatchObject({ kills: 4, encounters: 4 });
    });

    it('does not mutate encounter counters', () => {
      const monsterEncounters = { goblin: 5 };
      const before = JSON.stringify(monsterEncounters);

      getBestiaryProgress({ monsterEncounters });

      expect(JSON.stringify(monsterEncounters)).toBe(before);
    });
  });

  describe('mergeMonsterCounters', () => {
    it('keeps the highest count per monster from both sources', () => {
      const merged = mergeMonsterCounters(
        { goblin: 2, ogre: 5 },
        { goblin: 4, wraith: 1 },
      );

      expect(merged).toEqual({ goblin: 4, ogre: 5, wraith: 1 });
    });

    it('never lowers an existing counter and tolerates missing maps', () => {
      expect(mergeMonsterCounters(undefined, { goblin: 2 })).toEqual({ goblin: 2 });
      expect(mergeMonsterCounters({ goblin: 2 }, undefined)).toEqual({ goblin: 2 });
      expect(mergeMonsterCounters({ goblin: 2 }, { goblin: 1 })).toEqual({ goblin: 2 });
      expect(mergeMonsterCounters()).toEqual({});
    });

    it('does not mutate its inputs', () => {
      const current = { goblin: 1 };
      const incoming = { goblin: 3 };
      const before = JSON.stringify({ current, incoming });

      mergeMonsterCounters(current, incoming);

      expect(JSON.stringify({ current, incoming })).toBe(before);
    });
  });

  describe('incrementMonsterCounter', () => {
    it('increments a single monster without mutating the source map', () => {
      const counters = { goblin: 1 };
      const next = incrementMonsterCounter(counters, 'goblin');

      expect(next).toEqual({ goblin: 2 });
      expect(counters).toEqual({ goblin: 1 });
    });

    it('creates the counter map when missing and ignores empty ids', () => {
      expect(incrementMonsterCounter(undefined, 'ogre')).toEqual({ ogre: 1 });
      expect(incrementMonsterCounter(undefined, '')).toEqual({});
    });
  });
});
