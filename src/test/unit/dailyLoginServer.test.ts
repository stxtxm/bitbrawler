import { describe, it, expect } from 'vitest';
import {
  DAILY_LOGIN_ESSENCE,
  applyDailyLoginClaim,
  calculateDailyLoginEssence,
  getServerDailyResetKey,
  isMissingDailyEssenceColumn,
} from '../../../api/idle-processor';
import { GAME_RULES } from '../../config/gameRules';
import { getDailyResetKey } from '../../utils/dailyReset';

const NOW = new Date('2026-11-20T12:00:00Z').getTime();
const YESTERDAY = NOW - 24 * 60 * 60 * 1000;

const baseCharacter = {
  id: 'hero',
  name: 'Hero',
  level: 10,
  hp: 200,
  maxHp: 200,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  experience: 0,
  statPoints: 0,
  essence: 100,
};

describe('server daily login essence', () => {
  it('mirrors the client economy amount', () => {
    expect(DAILY_LOGIN_ESSENCE).toBe(GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE);
  });

  it('uses the same Paris reset day as the client', () => {
    const timestamps = [
      NOW,
      new Date('2026-03-29T00:30:00Z').getTime(),
      new Date('2026-03-29T23:30:00Z').getTime(),
      new Date('2026-10-25T00:30:00Z').getTime(),
      new Date('2026-10-25T23:30:00Z').getTime(),
    ];
    for (const timestamp of timestamps) {
      expect(getServerDailyResetKey(timestamp)).toBe(getDailyResetKey(timestamp));
    }
  });

  it('grants once per reset day from the persisted server claim', () => {
    expect(calculateDailyLoginEssence(getServerDailyResetKey(NOW), NOW, 5)).toBe(0);
    expect(calculateDailyLoginEssence(getServerDailyResetKey(YESTERDAY), NOW, 5)).toBe(5);
    expect(calculateDailyLoginEssence(null, NOW, 5)).toBe(5);
    expect(calculateDailyLoginEssence(undefined, NOW, 5)).toBe(5);
  });

  it('pays nothing for a non-positive amount', () => {
    expect(calculateDailyLoginEssence(getServerDailyResetKey(YESTERDAY), NOW, 0)).toBe(0);
    expect(calculateDailyLoginEssence(getServerDailyResetKey(YESTERDAY), NOW, -5)).toBe(0);
  });

  it('credits the character and stamps the claim day in one pure step', () => {
    const { character, claimed } = applyDailyLoginClaim(baseCharacter, true, NOW, 5);

    expect(claimed).toBe(5);
    expect(character.essence).toBe(105);
    expect(character.lastDailyEssenceClaim).toBe(getServerDailyResetKey(NOW));
  });

  it('never claims twice on the same day', () => {
    const first = applyDailyLoginClaim(baseCharacter, true, NOW, 5);
    const second = applyDailyLoginClaim(first.character, true, NOW, 5);

    expect(second.claimed).toBe(0);
    expect(second.character.essence).toBe(105);
  });

  it('leaves the character untouched when server tracking is unavailable', () => {
    const { character, claimed } = applyDailyLoginClaim(baseCharacter, false, NOW, 5);

    expect(claimed).toBe(0);
    expect(character).toBe(baseCharacter);
  });

  it('detects a missing daily claim column from PostgREST errors', () => {
    expect(
      isMissingDailyEssenceColumn({
        code: '42703',
        message: 'column characters.last_daily_essence_claim does not exist',
      }),
    ).toBe(true);
    expect(
      isMissingDailyEssenceColumn({
        code: 'PGRST204',
        message: "Could not find the 'last_daily_essence_claim' column of 'characters'",
      }),
    ).toBe(true);
    expect(
      isMissingDailyEssenceColumn({
        code: '42703',
        message: 'column characters.monster_kills does not exist',
      }),
    ).toBe(false);
    expect(isMissingDailyEssenceColumn(null)).toBe(false);
  });
});
