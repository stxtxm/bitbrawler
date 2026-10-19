import { describe, it, expect } from 'vitest';
import { getBestiaryProgress } from '../../utils/bestiaryUtils';
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
      });
    });

    it('does not mutate the character kill map', () => {
      const monsterKills = { goblin: 2 };
      const before = JSON.stringify(monsterKills);

      getBestiaryProgress({ monsterKills });

      expect(JSON.stringify(monsterKills)).toBe(before);
    });
  });
});
