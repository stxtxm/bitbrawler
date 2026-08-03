import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CharacterRow } from '../../config/supabase';
import { Character } from '../../types/Character';
import { convertFromSupabase, convertToSupabase } from '../../utils/supabaseUtils';
import { SerializedPushSubscription } from '../../utils/pushNotifications';
import {
  LAST_PUSH_SENT_KEY,
  buildPushSubscriptionUpdate,
  getLastPushSentAt,
  setLastPushSentAt,
  shouldSendPushReminder,
  showPushReminder,
  trySendPushReminder,
} from '../../hooks/usePushReminders';

const NOW = Date.UTC(2025, 0, 2, 1, 0, 0);
const PREV_DAY = Date.UTC(2025, 0, 1, 1, 0, 0);

const baseRow = (overrides: Partial<CharacterRow> = {}): CharacterRow => ({
  id: 'c1',
  created_at: '2025-01-01T00:00:00Z',
  name: 'Hero',
  gender: 'male',
  seed: 'seed-1',
  level: 1,
  hp: 50,
  max_hp: 50,
  strength: 5,
  vitality: 5,
  dexterity: 5,
  luck: 5,
  intelligence: 5,
  focus: 5,
  experience: 0,
  wins: 0,
  losses: 0,
  fights_left: 5,
  pve_fights_left: 5,
  last_fight_reset: 0,
  fight_history: [],
  fought_today: [],
  stat_points: 0,
  pending_fight: null,
  inventory: [],
  last_loot_roll: 0,
  lootbox_streak: 0,
  incoming_fight_history: [],
  is_bot: false,
  auto_mode: false,
  equipped_items: null,
  last_idle_check: null,
  last_active: null,
  idle_streak: 0,
  idle_max_streak: 0,
  idle_total_kills: 0,
  idle_total_xp: 0,
  essence: 0,
  item_upgrades: null,
  ...overrides,
});

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

const setServiceWorker = (registration: ServiceWorkerRegistration | null) => {
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: registration ? { ready: Promise.resolve(registration) } : undefined,
  });
};

describe('push persistence — convertFromSupabase', () => {
  it('maps push fields from row to character', () => {
    const row = baseRow({
      push_endpoint: 'https://push.example.com/abc',
      push_keys: '{"p256dh":"AQID","auth":"BAUG"}',
      push_subscribed: true,
    });
    const char = convertFromSupabase(row);
    expect(char.pushEndpoint).toBe('https://push.example.com/abc');
    expect(char.pushKeys).toBe('{"p256dh":"AQID","auth":"BAUG"}');
    expect(char.pushSubscribed).toBe(true);
  });

  it('defaults push fields to null/false when columns are absent (migration pending)', () => {
    const char = convertFromSupabase(baseRow());
    expect(char.pushEndpoint).toBeNull();
    expect(char.pushKeys).toBeNull();
    expect(char.pushSubscribed).toBe(false);
  });
});

describe('push persistence — convertToSupabase', () => {
  it('omits push columns on the default path so routine syncs survive pre-migration', () => {
    const char = makeChar({ pushEndpoint: 'https://e', pushKeys: '{}', pushSubscribed: true });
    const payload = convertToSupabase(char);
    expect(payload).not.toHaveProperty('push_endpoint');
    expect(payload).not.toHaveProperty('push_keys');
    expect(payload).not.toHaveProperty('push_subscribed');
  });

  it('emits push columns only when explicitly requested via fields', () => {
    const char = makeChar({ pushEndpoint: 'https://e', pushKeys: '{}', pushSubscribed: true });
    const payload = convertToSupabase(char, ['push_endpoint', 'push_keys', 'push_subscribed']);
    expect(payload).toEqual({
      push_endpoint: 'https://e',
      push_keys: '{}',
      push_subscribed: true,
    });
  });

  it('round-trips push fields row -> character -> row', () => {
    const row = baseRow({
      push_endpoint: 'https://push.example.com/abc',
      push_keys: '{"p256dh":"AQID","auth":"BAUG"}',
      push_subscribed: true,
    });
    const char = convertFromSupabase(row);
    const payload = convertToSupabase(char, ['push_endpoint', 'push_keys', 'push_subscribed']);
    expect(payload.push_endpoint).toBe(row.push_endpoint);
    expect(payload.push_keys).toBe(row.push_keys);
    expect(payload.push_subscribed).toBe(row.push_subscribed);
  });
});

describe('buildPushSubscriptionUpdate', () => {
  it('builds subscribe payload from a serialized subscription', () => {
    const serialized: SerializedPushSubscription = {
      endpoint: 'https://push.example.com/abc',
      p256dh: 'AQID',
      auth: 'BAUG',
    };
    const payload = buildPushSubscriptionUpdate(serialized);
    expect(payload.push_endpoint).toBe('https://push.example.com/abc');
    expect(payload.push_subscribed).toBe(true);
    expect(typeof payload.push_keys).toBe('string');
    expect(payload.push_keys).toContain('AQID');
    expect(payload.push_keys).toContain('BAUG');
  });

  it('builds an unsubscribe payload when no subscription is present', () => {
    expect(buildPushSubscriptionUpdate(null)).toEqual({ push_subscribed: false });
  });
});

describe('shouldSendPushReminder', () => {
  it('returns null when the character is not subscribed', () => {
    const char = makeChar({ lastLootRoll: PREV_DAY, pushSubscribed: false });
    expect(shouldSendPushReminder(char, NOW, undefined)).toBeNull();
  });

  it('returns null when already sent today', () => {
    const char = makeChar({ lastLootRoll: PREV_DAY, pushSubscribed: true });
    expect(shouldSendPushReminder(char, NOW, NOW)).toBeNull();
  });

  it('returns a reminder when subscribed and never sent', () => {
    const char = makeChar({ lastLootRoll: PREV_DAY, pushSubscribed: true });
    const message = shouldSendPushReminder(char, NOW, undefined);
    expect(message?.type).toBe('lootbox');
  });

  it('respects the one-per-day limit across days', () => {
    const char = makeChar({ lastLootRoll: PREV_DAY, pushSubscribed: true });
    expect(shouldSendPushReminder(char, NOW, PREV_DAY)).not.toBeNull();
  });
});

describe('showPushReminder', () => {
  afterEach(() => {
    setServiceWorker(null);
  });

  it('shows a notification through the service worker', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    setServiceWorker({ showNotification } as unknown as ServiceWorkerRegistration);
    const ok = await showPushReminder({ type: 'lootbox', title: '🎁 Lootbox', body: 'Go!', url: '/arena' });
    expect(ok).toBe(true);
    expect(showNotification).toHaveBeenCalledWith(
      '🎁 Lootbox',
      expect.objectContaining({ body: 'Go!', data: { url: '/arena' } })
    );
  });

  it('returns false when no service worker is available', async () => {
    setServiceWorker(null);
    const ok = await showPushReminder({ type: 'lootbox', title: 't', body: 'b', url: '/' });
    expect(ok).toBe(false);
  });
});

describe('trySendPushReminder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    setServiceWorker(null);
  });

  it('sends and records lastPushSentAt in localStorage', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    setServiceWorker({ showNotification } as unknown as ServiceWorkerRegistration);
    const char = makeChar({ lastLootRoll: PREV_DAY, pushSubscribed: true });
    await trySendPushReminder(char, NOW);
    expect(showNotification).toHaveBeenCalled();
    expect(getLastPushSentAt()).toBeDefined();
  });

  it('does not send when a reminder was already sent today', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    setServiceWorker({ showNotification } as unknown as ServiceWorkerRegistration);
    setLastPushSentAt(NOW);
    const char = makeChar({ lastLootRoll: PREV_DAY, pushSubscribed: true });
    await trySendPushReminder(char, NOW);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('does nothing for unsubscribed characters', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    setServiceWorker({ showNotification } as unknown as ServiceWorkerRegistration);
    const char = makeChar({ lastLootRoll: PREV_DAY, pushSubscribed: false });
    await trySendPushReminder(char, NOW);
    expect(showNotification).not.toHaveBeenCalled();
    expect(localStorage.getItem(LAST_PUSH_SENT_KEY)).toBeNull();
  });
});
