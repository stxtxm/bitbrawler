import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPushSupported,
  getVapidPublicKey,
  requestPermission,
  subscribePush,
  unsubscribePush,
  serializeSubscription,
  isSubscriptionExpired,
  DEFAULT_VAPID_PUBLIC_KEY,
} from '../../utils/pushNotifications';
import type { SerializedPushSubscription } from '../../utils/pushNotifications';

const setNavigatorServiceWorker = (has: boolean) => {
  if (has) {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    });
  } else {
    delete (window.navigator as { serviceWorker?: unknown }).serviceWorker;
  }
};

const setPushManager = (has: boolean) => {
  if (has) {
    Object.defineProperty(window, 'PushManager', { configurable: true, value: {} });
  } else {
    delete (window as { PushManager?: unknown }).PushManager;
  }
};

const setNotification = (handler?: (() => Promise<NotificationPermission>) | null) => {
  const fake = handler ? { requestPermission: handler } : {};
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: handler !== undefined ? fake : undefined,
  });
};

const buildSubscription = (overrides: Partial<PushSubscription> = {}) => {
  const sub = {
    endpoint: 'https://push.example.com/abc',
    expirationTime: null,
    getKey: vi.fn(),
    unsubscribe: vi.fn(),
    ...overrides,
  } as unknown as PushSubscription;
  return sub;
};

describe('pushNotifications utils', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    setNavigatorServiceWorker(true);
    setPushManager(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    setNavigatorServiceWorker(false);
    setPushManager(false);
    setNotification(undefined);
  });

  describe('isPushSupported', () => {
    it('returns true when serviceWorker and PushManager exist', () => {
      setNavigatorServiceWorker(true);
      setPushManager(true);
      expect(isPushSupported()).toBe(true);
    });

    it('returns false when serviceWorker is missing', () => {
      setNavigatorServiceWorker(false);
      setPushManager(true);
      expect(isPushSupported()).toBe(false);
    });

    it('returns false when PushManager is missing', () => {
      setNavigatorServiceWorker(true);
      setPushManager(false);
      expect(isPushSupported()).toBe(false);
    });
  });

  describe('getVapidPublicKey', () => {
    it('returns env value when VITE_VAPID_PUBLIC_KEY is set', () => {
      vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-public-key-123');
      expect(getVapidPublicKey()).toBe('test-public-key-123');
    });

    it('returns dev fallback when env value is empty', () => {
      vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
      expect(getVapidPublicKey()).toBe(DEFAULT_VAPID_PUBLIC_KEY);
    });
  });

  describe('requestPermission', () => {
    it('returns granted when the browser grants permission', async () => {
      setNotification(async () => 'granted');
      await expect(requestPermission()).resolves.toBe('granted');
    });

    it('returns denied when the browser denies permission', async () => {
      setNotification(async () => 'denied');
      await expect(requestPermission()).resolves.toBe('denied');
    });

    it('returns default when permission is not decided', async () => {
      setNotification(async () => 'default');
      await expect(requestPermission()).resolves.toBe('default');
    });

    it('returns default when Notification is unavailable', async () => {
      setNotification(undefined);
      await expect(requestPermission()).resolves.toBe('default');
    });

    it('returns default when requestPermission throws', async () => {
      setNotification(() => Promise.reject(new Error('boom')));
      await expect(requestPermission()).resolves.toBe('default');
    });
  });

  describe('subscribePush', () => {
    it('returns null when registration has no pushManager', async () => {
      const registration = { pushManager: undefined } as unknown as ServiceWorkerRegistration;
      await expect(subscribePush(registration)).resolves.toBeNull();
    });

    it('subscribes with userVisibleOnly and applicationServerKey', async () => {
      const subscribe = vi.fn().mockResolvedValue({ endpoint: 'x' });
      const pushManager = { subscribe };
      const registration = { pushManager } as unknown as ServiceWorkerRegistration;
      const sub = await subscribePush(registration);
      expect(subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: getVapidPublicKey(),
      });
      expect(sub).toEqual({ endpoint: 'x' });
    });

    it('returns null when subscribe throws', async () => {
      const subscribe = vi.fn().mockRejectedValue(new Error('not allowed'));
      const pushManager = { subscribe };
      const registration = { pushManager } as unknown as ServiceWorkerRegistration;
      await expect(subscribePush(registration)).resolves.toBeNull();
    });
  });

  describe('unsubscribePush', () => {
    it('returns true when unsubscribe resolves true', async () => {
      const sub = buildSubscription({ unsubscribe: vi.fn().mockResolvedValue(true) });
      await expect(unsubscribePush(sub)).resolves.toBe(true);
    });

    it('returns false when unsubscribe resolves false', async () => {
      const sub = buildSubscription({ unsubscribe: vi.fn().mockResolvedValue(false) });
      await expect(unsubscribePush(sub)).resolves.toBe(false);
    });

    it('returns false when unsubscribe throws', async () => {
      const sub = buildSubscription({
        unsubscribe: vi.fn().mockRejectedValue(new Error('error')),
      });
      await expect(unsubscribePush(sub)).resolves.toBe(false);
    });

    it('returns false when subscription is null', async () => {
      await expect(unsubscribePush(null)).resolves.toBe(false);
    });
  });

  describe('serializeSubscription', () => {
    it('serializes endpoint, p256dh and auth keys to base64', () => {
      const p256dh = new Uint8Array([1, 2, 3]);
      const auth = new Uint8Array([4, 5, 6]);
      const sub = buildSubscription({
        getKey: vi.fn((name) =>
          name === 'p256dh' ? p256dh.buffer : name === 'auth' ? auth.buffer : null
        ),
      });
      const result = serializeSubscription(sub) as SerializedPushSubscription;
      expect(result.endpoint).toBe('https://push.example.com/abc');
      expect(result.p256dh).toBe('AQID');
      expect(result.auth).toBe('BAUG');
    });

    it('returns empty strings for missing keys', () => {
      const sub = buildSubscription({ getKey: vi.fn(() => null) });
      const result = serializeSubscription(sub) as SerializedPushSubscription;
      expect(result.p256dh).toBe('');
      expect(result.auth).toBe('');
    });

    it('returns null for null subscription', () => {
      expect(serializeSubscription(null)).toBeNull();
    });
  });

  describe('isSubscriptionExpired', () => {
    it('returns true for null subscription', () => {
      expect(isSubscriptionExpired(null)).toBe(true);
    });

    it('returns true when endpoint is empty', () => {
      const sub = buildSubscription({ endpoint: '' });
      expect(isSubscriptionExpired(sub)).toBe(true);
    });

    it('returns false when endpoint exists and no expiration', () => {
      const sub = buildSubscription({ endpoint: 'https://ok', expirationTime: null });
      expect(isSubscriptionExpired(sub)).toBe(false);
    });

    it('returns true when expirationTime is in the past', () => {
      const sub = buildSubscription({ endpoint: 'https://ok', expirationTime: 1000 });
      vi.spyOn(Date, 'now').mockReturnValue(5000);
      expect(isSubscriptionExpired(sub)).toBe(true);
    });

    it('returns false when expirationTime is in the future', () => {
      const sub = buildSubscription({ endpoint: 'https://ok', expirationTime: 9000 });
      vi.spyOn(Date, 'now').mockReturnValue(5000);
      expect(isSubscriptionExpired(sub)).toBe(false);
    });
  });
});