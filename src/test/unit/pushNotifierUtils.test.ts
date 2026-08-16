import { describe, it, expect } from 'vitest';
import {
  parsePushKeysJson,
  shouldSendToday,
  getTodayKey,
  isEligibleForLootbox,
  mergeLastPushDay,
  buildPushPayload,
} from '../../utils/pushNotifierUtils';

describe('getTodayKey', () => {
  it('returns the Paris civil day for a timestamp', () => {
    // 2025-01-01T22:30:00Z = 23:30 Paris (CET) → same day Jan 1
    const ts = Date.UTC(2025, 0, 1, 22, 30, 0);
    expect(getTodayKey(ts)).toBe('2025-01-01');
  });

  it('handles the Paris midnight boundary (CET)', () => {
    // 2025-01-01T23:10:00Z = 00:10 Paris Jan 2 → new day
    const ts = Date.UTC(2025, 0, 1, 23, 10, 0);
    expect(getTodayKey(ts)).toBe('2025-01-02');
  });

  it('handles the Paris midnight boundary (CEST summer)', () => {
    // 2025-06-01T21:10:00Z = 23:10 Paris (CEST) → Jan day Jun 1
    const ts = Date.UTC(2025, 5, 1, 21, 10, 0);
    expect(getTodayKey(ts)).toBe('2025-06-01');
    // 2025-06-01T22:10:00Z = 00:10 Paris Jun 2 → new day
    expect(getTodayKey(Date.UTC(2025, 5, 1, 22, 10, 0))).toBe('2025-06-02');
  });
});

describe('isEligibleForLootbox', () => {
  it('is eligible when never rolled', () => {
    expect(isEligibleForLootbox(null, Date.UTC(2025, 0, 2, 10, 0, 0))).toBe(true);
  });

  it('is eligible when last roll was on a previous day', () => {
    const now = Date.UTC(2025, 0, 2, 10, 0, 0); // Paris Jan 2
    const lastRoll = Date.UTC(2025, 0, 1, 8, 0, 0); // Paris Jan 1
    expect(isEligibleForLootbox(lastRoll, now)).toBe(true);
  });

  it('is NOT eligible when last roll was today', () => {
    const now = Date.UTC(2025, 0, 2, 10, 0, 0); // Paris Jan 2
    const lastRoll = Date.UTC(2025, 0, 2, 8, 0, 0); // Paris Jan 2
    expect(isEligibleForLootbox(lastRoll, now)).toBe(false);
  });
});

describe('shouldSendToday (anti-spam)', () => {
  it('sends when lastPushDay is undefined', () => {
    expect(shouldSendToday(undefined, '2025-01-02')).toBe(true);
  });

  it('skips when lastPushDay is today', () => {
    expect(shouldSendToday('2025-01-02', '2025-01-02')).toBe(false);
  });

  it('sends when lastPushDay is a previous day', () => {
    expect(shouldSendToday('2025-01-01', '2025-01-02')).toBe(true);
  });
});

describe('parsePushKeysJson', () => {
  it('parses a basic subscription', () => {
    const parsed = parsePushKeysJson('{"p256dh":"abc","auth":"def"}');
    expect(parsed).toEqual({ p256dh: 'abc', auth: 'def', lastPushDay: undefined });
  });

  it('parses an extended subscription with lastPushDay', () => {
    const parsed = parsePushKeysJson('{"p256dh":"abc","auth":"def","lastPushDay":"2025-01-01"}');
    expect(parsed?.lastPushDay).toBe('2025-01-01');
  });

  it('returns null for invalid JSON', () => {
    expect(parsePushKeysJson('not-json')).toBeNull();
    expect(parsePushKeysJson('{"p256dh":123}')).toBeNull();
    expect(parsePushKeysJson(null)).toBeNull();
    expect(parsePushKeysJson(undefined)).toBeNull();
  });
});

describe('mergeLastPushDay', () => {
  it('preserves p256dh/auth and adds lastPushDay', () => {
    const merged = mergeLastPushDay({ p256dh: 'abc', auth: 'def' }, '2025-01-02');
    expect(JSON.parse(merged)).toEqual({
      p256dh: 'abc',
      auth: 'def',
      lastPushDay: '2025-01-02',
    });
  });
});

describe('buildPushPayload', () => {
  it('builds the lootbox payload with a daily tag, app icon and badge', () => {
    const payload = buildPushPayload('2025-01-02');
    expect(payload.title).toContain('Lootbox');
    expect(payload.tag).toBe('lootbox-2025-01-02');
    expect(payload.url).toBe('/arena');
    expect(payload.icon).toBe('/icon-192.png');
    expect(payload.badge).toBe('/badge-96.png');
    expect(payload.body.length).toBeGreaterThan(0);
  });

  it('builds distinct tags across days (browser dedupes same-tag pushes)', () => {
    const day1 = buildPushPayload('2025-01-01').tag;
    const day2 = buildPushPayload('2025-01-02').tag;
    expect(day1).not.toBe(day2);
  });
});
