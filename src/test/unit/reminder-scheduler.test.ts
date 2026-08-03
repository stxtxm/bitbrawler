import { describe, it, expect } from 'vitest';
import { Character } from '../../types/Character';
import {
  getReminderType,
  shouldSendToday,
  createReminderMessage,
  isStreakInDanger,
  isLootReminderAvailable,
  isEventActive,
  ActiveEvent,
} from '../../utils/reminderScheduler';

const NOW = Date.UTC(2025, 0, 2, 1, 0, 0); // 02:00 Paris (CET), Jan 2 2025

const makeChar = (overrides: Partial<Character> = {}): Character => ({
  seed: 'seed-1',
  name: 'Hero',
  gender: 'male',
  level: 1,
  experience: 0,
  strength: 5,
  vitality: 5,
  dexterity: 5,
  luck: 5,
  intelligence: 5,
  focus: 5,
  hp: 50,
  maxHp: 50,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: 0,
  ...overrides,
});

const activeEvent: ActiveEvent = { id: 'winter', title: 'Winter Hunt', startsAt: NOW - 3 * 60 * 60 * 1000 };

describe('shouldSendToday', () => {
  it('returns true when never sent before', () => {
    expect(shouldSendToday(undefined, NOW)).toBe(true);
  });

  it('returns true when last sent on a previous day', () => {
    const prevDay = Date.UTC(2025, 0, 1, 1, 0, 0); // previous Paris day
    expect(shouldSendToday(prevDay, NOW)).toBe(true);
  });

  it('returns false when already sent today', () => {
    const today = Date.UTC(2025, 0, 2, 0, 5, 0); // 01:05 Paris, same day
    expect(shouldSendToday(today, NOW)).toBe(false);
  });
});

describe('createReminderMessage', () => {
  it('builds streak_danger message with the streak count', () => {
    const msg = createReminderMessage('streak_danger', 7);
    expect(msg.type).toBe('streak_danger');
    expect(msg.title).toContain('Streak');
    expect(msg.body).toContain('7');
    expect(typeof msg.url).toBe('string');
  });

  it('builds lootbox message', () => {
    const msg = createReminderMessage('lootbox', 0);
    expect(msg.type).toBe('lootbox');
    expect(msg.body).toContain('lootbox');
  });

  it('builds event message', () => {
    const msg = createReminderMessage('event', 0);
    expect(msg.type).toBe('event');
    expect(msg.body).toContain('event');
  });
});

describe('isStreakInDanger', () => {
  it('is false when char has never been active', () => {
    expect(isStreakInDanger(makeChar({ lastActive: undefined }), NOW)).toBe(false);
    expect(isStreakInDanger(makeChar({ lastActive: 0 }), NOW)).toBe(false);
  });

  it('is false when active within the last 24h', () => {
    expect(isStreakInDanger(makeChar({ lastActive: NOW - 60 * 60 * 1000 }), NOW)).toBe(false);
  });

  it('is true when inactive for more than 24h', () => {
    expect(isStreakInDanger(makeChar({ lastActive: NOW - 25 * 60 * 60 * 1000 }), NOW)).toBe(true);
  });
});

describe('isLootReminderAvailable', () => {
  it('is true when never rolled', () => {
    expect(isLootReminderAvailable(makeChar({ lastLootRoll: undefined }), NOW)).toBe(true);
  });

  it('is true when last roll was a previous day', () => {
    const previousDay = Date.UTC(2025, 0, 1, 1, 0, 0);
    expect(isLootReminderAvailable(makeChar({ lastLootRoll: previousDay }), NOW)).toBe(true);
  });

  it('is false when already rolled today', () => {
    const today = Date.UTC(2025, 0, 2, 0, 5, 0);
    expect(isLootReminderAvailable(makeChar({ lastLootRoll: today }), NOW)).toBe(false);
  });
});

describe('isEventActive', () => {
  it('is true for a started, not ended event', () => {
    expect(isEventActive(activeEvent, NOW)).toBe(true);
  });

  it('is false for a future event', () => {
    expect(isEventActive({ ...activeEvent, startsAt: NOW + 60 * 60 * 1000 }, NOW)).toBe(false);
  });

  it('is false for an ended event', () => {
    expect(isEventActive({ ...activeEvent, endsAt: NOW - 60 * 60 * 1000 }, NOW)).toBe(false);
  });
});

describe('getReminderType', () => {
  it('returns streak_danger with idle streak count', () => {
    const res = getReminderType(
      makeChar({ lastActive: NOW - 30 * 60 * 60 * 1000, idleStreak: 5 }),
      NOW
    );
    expect(res?.type).toBe('streak_danger');
    expect(res?.body).toContain('5');
  });

  it('falls back to lootboxStreak when idleStreak is missing', () => {
    const res = getReminderType(
      makeChar({ lastActive: NOW - 30 * 60 * 60 * 1000, lootboxStreak: 3 }),
      NOW
    );
    expect(res?.type).toBe('streak_danger');
    expect(res?.body).toContain('3');
  });

  it('returns lootbox when streak is safe and a roll is available', () => {
    const res = getReminderType(
      makeChar({ lastActive: NOW - 60 * 60 * 1000, lastLootRoll: Date.UTC(2025, 0, 1, 1, 0, 0) }),
      NOW
    );
    expect(res?.type).toBe('lootbox');
  });

  it('respects priority: streak_danger beats lootbox', () => {
    const res = getReminderType(
      makeChar({
        lastActive: NOW - 30 * 60 * 60 * 1000,
        lastLootRoll: Date.UTC(2025, 0, 1, 1, 0, 0),
      }),
      NOW
    );
    expect(res?.type).toBe('streak_danger');
  });

  it('returns event when loot rolled today and an active event exists', () => {
    const res = getReminderType(
      makeChar({ lastActive: NOW - 60 * 60 * 1000, lastLootRoll: Date.UTC(2025, 0, 2, 0, 5, 0) }),
      NOW,
      [activeEvent]
    );
    expect(res?.type).toBe('event');
  });

  it('returns lootbox before event (priority order)', () => {
    const res = getReminderType(
      makeChar({ lastActive: NOW - 60 * 60 * 1000, lastLootRoll: Date.UTC(2025, 0, 1, 1, 0, 0) }),
      NOW,
      [activeEvent]
    );
    expect(res?.type).toBe('lootbox');
  });

  it('returns null when no condition triggers', () => {
    const res = getReminderType(
      makeChar({ lastActive: NOW - 60 * 60 * 1000, lastLootRoll: Date.UTC(2025, 0, 2, 0, 5, 0) }),
      NOW
    );
    expect(res).toBeNull();
  });
});