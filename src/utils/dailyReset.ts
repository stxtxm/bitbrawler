import { getZonedParts } from './timezoneUtils';

export const DAILY_RESET_TIMEZONE = 'Europe/Paris';

export const getDailyResetKey = (timestamp: number, timeZone = DAILY_RESET_TIMEZONE) => {
  const parts = getZonedParts(new Date(timestamp), timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

export const isSameResetDay = (
  left: number,
  right: number,
  timeZone = DAILY_RESET_TIMEZONE
) => getDailyResetKey(left, timeZone) === getDailyResetKey(right, timeZone);

export const shouldResetDaily = (
  lastReset: number,
  now: number = Date.now(),
  timeZone = DAILY_RESET_TIMEZONE
): boolean => !isSameResetDay(lastReset, now, timeZone);
