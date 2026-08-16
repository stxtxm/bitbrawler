import { getDailyResetKey, DAILY_RESET_TIMEZONE } from './dailyReset';

export interface PushKeys {
  p256dh: string;
  auth: string;
  lastPushDay?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon: string;
  badge?: string;
  tag: string;
  url: string;
}

/**
 * Parse the raw `push_keys` column (JSON string, possibly extended with
 * `lastPushDay`). Returns null when invalid so callers can skip safely.
 */
export const parsePushKeysJson = (raw: string | null | undefined): PushKeys | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PushKeys>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.p256dh !== 'string' || typeof parsed.auth !== 'string') return null;
    return {
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      lastPushDay: typeof parsed.lastPushDay === 'string' ? parsed.lastPushDay : undefined,
    };
  } catch {
    return null;
  }
};

/**
 * Daily anti-spam guard: only one lootbox notification per player per reset day.
 * The same `tag` (journalier) already dedupes silently at the browser level.
 */
export const shouldSendToday = (lastPushDay: string | undefined, todayKey: string): boolean =>
  !lastPushDay || lastPushDay !== todayKey;

export const getTodayKey = (timestamp: number, timeZone = DAILY_RESET_TIMEZONE): string =>
  getDailyResetKey(timestamp, timeZone);

/**
 * A lootbox is available once the player has not rolled on the current reset day.
 */
export const isEligibleForLootbox = (
  lastLootRoll: number | null,
  now: number,
  timeZone = DAILY_RESET_TIMEZONE
): boolean => {
  if (lastLootRoll == null) return true;
  return getDailyResetKey(lastLootRoll, timeZone) !== getDailyResetKey(now, timeZone);
};

/**
 * Returns the updated `push_keys` JSON string to persist after a successful send.
 */
export const mergeLastPushDay = (pushKeys: PushKeys, todayKey: string): string =>
  JSON.stringify({ ...pushKeys, lastPushDay: todayKey });

/**
 * Payload sent in the Web Push message — the service worker (`public/sw.js`)
 * reads `title`, `body`, `icon`, `tag` and `data.url`.
 */
export const buildPushPayload = (todayKey: string): PushNotificationPayload => ({
  title: '🎁 Lootbox quotidienne',
  body: "Ta lootbox quotidienne t'attend !",
  icon: '/icon-192.png',
  badge: '/badge-96.png',
  tag: `lootbox-${todayKey}`,
  url: '/arena',
});