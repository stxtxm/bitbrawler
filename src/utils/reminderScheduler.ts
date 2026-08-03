import { Character } from '../types/Character';
import { getDailyResetKey } from './dailyReset';
import { canRollLootbox } from './lootboxUtils';

export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ReminderType = 'streak_danger' | 'lootbox' | 'event';

export interface ReminderMessage {
  type: ReminderType;
  title: string;
  body: string;
  url: string;
}

export interface ActiveEvent {
  id: string;
  title: string;
  startsAt: number;
  endsAt?: number;
  url?: string;
}

export const createReminderMessage = (type: ReminderType, streak: number): ReminderMessage => {
  switch (type) {
    case 'streak_danger':
      return {
        type,
        title: '🔥 Streak en danger !',
        body: `🔥 Ton streak de ${streak} jours expire dans 12h !`,
        url: '/',
      };
    case 'lootbox':
      return {
        type,
        title: '🎁 Lootbox quotidienne',
        body: "🎁 Ta lootbox quotidienne t'attend !",
        url: '/arena',
      };
    case 'event':
      return {
        type,
        title: '⚔️ Nouvel event',
        body: '⚔️ Un nouvel event a commencé !',
        url: '/arena',
      };
  }
};

export const isStreakInDanger = (char: Character, now: number): boolean => {
  if (!char.lastActive || char.lastActive <= 0) return false;
  return now - char.lastActive > REMINDER_WINDOW_MS;
};

export const isLootReminderAvailable = (char: Character, now: number): boolean =>
  canRollLootbox(char.lastLootRoll, now);

export const isEventActive = (event: ActiveEvent, now: number): boolean =>
  event.startsAt <= now && (event.endsAt === undefined || event.endsAt >= now);

export const getReminderType = (
  char: Character,
  now: number,
  events: ActiveEvent[] = []
): ReminderMessage | null => {
  if (isStreakInDanger(char, now)) {
    const streak = char.idleStreak ?? char.lootboxStreak ?? 0;
    return createReminderMessage('streak_danger', streak);
  }
  if (isLootReminderAvailable(char, now)) {
    return createReminderMessage('lootbox', 0);
  }
  if (events.some((event) => isEventActive(event, now))) {
    return createReminderMessage('event', 0);
  }
  return null;
};

export const shouldSendToday = (lastSentAt: number | undefined, now: number): boolean =>
  lastSentAt === undefined || getDailyResetKey(lastSentAt) !== getDailyResetKey(now);
