import { GAME_RULES } from '../config/gameRules';
import { getDailyResetKey } from './dailyReset';

const STORAGE_PREFIX = 'bitbrawler_daily_essence_';

interface DailyEssenceClaim {
  characterId: string;
  dayKey: string;
}

export const getDailyLoginEssenceKey = (characterId: string): string =>
  `${STORAGE_PREFIX}${characterId}`;

const readClaim = (characterId: string): DailyEssenceClaim | null => {
  try {
    const raw = localStorage.getItem(getDailyLoginEssenceKey(characterId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyEssenceClaim> | null;
    if (!parsed || parsed.characterId !== characterId || typeof parsed.dayKey !== 'string') {
      return null;
    }
    return { characterId: parsed.characterId, dayKey: parsed.dayKey };
  } catch {
    return null;
  }
};

export const hasClaimedDailyLoginEssence = (
  characterId: string,
  now: number = Date.now(),
): boolean => {
  if (!characterId) return false;
  const claim = readClaim(characterId);
  return claim?.dayKey === getDailyResetKey(now);
};

export const claimDailyLoginEssence = (
  characterId: string,
  now: number = Date.now(),
  amount: number = GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE,
): number => {
  if (!characterId || amount <= 0) return 0;
  if (hasClaimedDailyLoginEssence(characterId, now)) return 0;
  try {
    localStorage.setItem(
      getDailyLoginEssenceKey(characterId),
      JSON.stringify({ characterId, dayKey: getDailyResetKey(now) }),
    );
  } catch {
    return 0;
  }
  return amount;
};
