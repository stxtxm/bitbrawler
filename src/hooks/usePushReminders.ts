import { useEffect } from 'react';
import { Character } from '../types/Character';
import {
  getReminderType,
  shouldSendToday,
  ReminderMessage,
  ActiveEvent,
} from '../utils/reminderScheduler';
import { SerializedPushSubscription } from '../utils/pushNotifications';

export const LAST_PUSH_SENT_KEY = 'bitbrawler_last_push_sent';

export type PushSubscriptionUpdate = {
  push_endpoint?: string | null;
  push_keys?: string | null;
  push_subscribed: boolean;
};

export const getLastPushSentAt = (): number | undefined => {
  try {
    const raw = localStorage.getItem(LAST_PUSH_SENT_KEY);
    if (!raw) return undefined;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : undefined;
  } catch {
    return undefined;
  }
};

export const setLastPushSentAt = (ts: number): void => {
  try {
    localStorage.setItem(LAST_PUSH_SENT_KEY, String(ts));
  } catch {
    // localStorage unavailable (SSR / private mode) — noop
  }
};

export const buildPushSubscriptionUpdate = (
  serialized: SerializedPushSubscription | null
): PushSubscriptionUpdate => {
  if (!serialized) {
    return { push_subscribed: false };
  }
  return {
    push_endpoint: serialized.endpoint,
    push_keys: JSON.stringify({ p256dh: serialized.p256dh, auth: serialized.auth }),
    push_subscribed: true,
  };
};

export const shouldSendPushReminder = (
  char: Character,
  now: number,
  lastSentAt: number | undefined = getLastPushSentAt(),
  events: ActiveEvent[] = []
): ReminderMessage | null => {
  if (!char.pushSubscribed) return null;
  if (!shouldSendToday(lastSentAt, now)) return null;
  return getReminderType(char, now, events);
};

export const showPushReminder = async (message: ReminderMessage): Promise<boolean> => {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    if (!registration?.showNotification) return false;
    await registration.showNotification(message.title, {
      body: message.body,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: `bitbrawler-${message.type}`,
      data: { url: message.url },
    });
    return true;
  } catch {
    return false;
  }
};

export const trySendPushReminder = async (
  char: Character,
  now: number = Date.now(),
  events: ActiveEvent[] = []
): Promise<boolean> => {
  const message = shouldSendPushReminder(char, now, getLastPushSentAt(), events);
  if (!message) return false;
  const sent = await showPushReminder(message);
  if (sent) setLastPushSentAt(now);
  return sent;
};

export const usePushReminders = (character: Character | null): void => {
  useEffect(() => {
    if (!character) return;
    void trySendPushReminder(character);
  }, [character?.id, character?.pushSubscribed]);
};