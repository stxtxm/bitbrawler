import { describe, it, expect, vi } from 'vitest';
import type { Character } from '../../types/Character';
import {
  getArmoryProgress,
  getBestiaryProgress,
  getCompendiumProgress,
  recordMonsterEncounter,
} from '../../utils/compendiumUtils';
import {
  COMPENDIUM_UNLOCK_EVENT,
  type CompendiumUnlockDetail,
} from '../../utils/compendiumEvents';

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'hero-id',
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
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: 0,
  inventory: [],
  equippedItems: { weapon: null, armor: null, accessory: null },
  ...overrides,
});

describe('compendium utils', () => {
  describe('recordMonsterEncounter', () => {
    it('increments encounters on a loss without incrementing kills', () => {
      const updated = recordMonsterEncounter(makeCharacter(), 'goblin', false);
      expect(updated.monsterEncounters?.goblin).toBe(1);
      expect(updated.monsterKills?.goblin).toBeUndefined();
    });

    it('increments both counters on a win', () => {
      const updated = recordMonsterEncounter(makeCharacter(), 'goblin', true);
      expect(updated.monsterEncounters?.goblin).toBe(1);
      expect(updated.monsterKills?.goblin).toBe(1);
    });

    it('accumulates counters across fights', () => {
      const first = recordMonsterEncounter(makeCharacter(), 'ogre', true);
      const second = recordMonsterEncounter(first, 'ogre', true);
      expect(second.monsterKills?.ogre).toBe(2);
      expect(second.monsterEncounters?.ogre).toBe(2);
    });

    it('emits a bestiary unlock on the first encounter only', () => {
      const listener = vi.fn();
      window.addEventListener(COMPENDIUM_UNLOCK_EVENT, listener);

      const first = recordMonsterEncounter(makeCharacter(), 'chimera', false);
      recordMonsterEncounter(first, 'chimera', false);

      expect(listener).toHaveBeenCalledTimes(1);
      const detail = (listener.mock.calls[0][0] as CustomEvent<CompendiumUnlockDetail>).detail;
      expect(detail).toEqual({ kind: 'bestiary', id: 'chimera', name: 'Chimera' });

      window.removeEventListener(COMPENDIUM_UNLOCK_EVENT, listener);
    });
  });

  describe('getBestiaryProgress', () => {
    it('hides monsters that were never encountered', () => {
      const progress = getBestiaryProgress(makeCharacter({ monsterKills: { goblin: 3 } }));
      const goblin = progress.find((entry) => entry.entry.id === 'goblin');
      const ogre = progress.find((entry) => entry.entry.id === 'ogre');
      expect(goblin).toMatchObject({ encountered: true, kills: 3, encounters: 0 });
      expect(ogre?.encountered).toBe(false);
    });

    it('treats a sighting without a kill as discovered', () => {
      const progress = getBestiaryProgress(makeCharacter({ monsterEncounters: { ogre: 2 } }));
      expect(progress.find((entry) => entry.entry.id === 'ogre')?.encountered).toBe(true);
    });
  });

  describe('getArmoryProgress', () => {
    it('counts codex, inventory and equipped items as seen', () => {
      const progress = getArmoryProgress(makeCharacter({
        codex: ['rusty_sword'],
        inventory: ['lucky_charm'],
        equippedItems: { weapon: null, armor: null, accessory: 'lucky_charm' },
      }));
      const byId = new Map(progress.map((entry) => [entry.entry.id, entry]));
      expect(byId.get('rusty_sword')?.seen).toBe(true);
      expect(byId.get('lucky_charm')?.seen).toBe(true);
      expect(byId.get('worn_bracers')?.seen).toBe(false);
    });

    it('flags items currently owned', () => {
      const progress = getArmoryProgress(makeCharacter({ inventory: ['rusty_sword'] }));
      const entry = progress.find((item) => item.entry.id === 'rusty_sword');
      expect(entry?.owned).toBe(true);
      expect(progress.find((item) => item.entry.id === 'lucky_charm')?.owned).toBe(false);
    });
  });

  describe('getCompendiumProgress', () => {
    it('computes a global completion percentage across both tabs', () => {
      const progress = getCompendiumProgress(makeCharacter({
        monsterKills: { goblin: 1 },
        codex: ['rusty_sword'],
      }));
      expect(progress.bestiary.discovered).toBe(1);
      expect(progress.armory.discovered).toBe(1);
      expect(progress.discovered).toBe(2);
      expect(progress.completionPct).toBe(Math.round((2 / progress.total) * 100));
    });

    it('returns zero for an empty collection', () => {
      const progress = getCompendiumProgress(makeCharacter());
      expect(progress.discovered).toBe(0);
      expect(progress.completionPct).toBe(0);
    });
  });
});
