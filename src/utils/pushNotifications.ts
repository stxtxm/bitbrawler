export const DEFAULT_VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkQZokFHFVnJf52DSy0H2FrzpwK0X8F_8vM9jUoCgA';

export const isPushSupported = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

export const getVapidPublicKey = (): string =>
  import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;

export const requestPermission = async (): Promise<NotificationPermission> => {
  try {
    if (typeof Notification === 'undefined' || !Notification.requestPermission) {
      return 'default';
    }
    return await Notification.requestPermission();
  } catch {
    return 'default';
  }
};

export const subscribePush = async (
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> => {
  try {
    if (!registration?.pushManager) return null;
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: getVapidPublicKey(),
    });
  } catch {
    return null;
  }
};

export const unsubscribePush = async (
  subscription: PushSubscription | null
): Promise<boolean> => {
  try {
    if (!subscription?.unsubscribe) return false;
    return await subscription.unsubscribe();
  } catch {
    return false;
  }
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

export interface SerializedPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const serializeSubscription = (
  subscription: PushSubscription | null
): SerializedPushSubscription | null => {
  if (!subscription) return null;
  const p256dh = subscription.getKey?.('p256dh');
  const auth = subscription.getKey?.('auth');
  return {
    endpoint: subscription.endpoint ?? '',
    p256dh: p256dh ? arrayBufferToBase64(p256dh) : '',
    auth: auth ? arrayBufferToBase64(auth) : '',
  };
};

export const isSubscriptionExpired = (
  subscription: PushSubscription | null
): boolean => {
  if (!subscription) return true;
  if (!subscription.endpoint) return true;
  const expiration = subscription.expirationTime;
  if (typeof expiration === 'number' && expiration > 0) {
    return expiration <= Date.now();
  }
  return false;
};
