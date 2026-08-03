import { useState } from 'react';
import { useNotification } from '../hooks/useNotification';
import {
  isPushSupported,
  requestPermission,
  subscribePush,
  serializeSubscription,
} from '../utils/pushNotifications';
import type { SerializedPushSubscription } from '../utils/pushNotifications';
import '../styles/components/_push-optin.scss';

const DISMISS_KEY = 'pushOptInDismissed';

interface PushOptInBannerProps {
  onSubscribe?: (subscription: SerializedPushSubscription) => void;
}

function isDismissed(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    return;
  }
}

export function PushOptInBanner({ onSubscribe }: PushOptInBannerProps) {
  const { notify } = useNotification();
  const [hidden, setHidden] = useState<boolean>(() => isDismissed());
  const [busy, setBusy] = useState<boolean>(false);

  const shouldShow =
    !hidden &&
    isPushSupported() &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default';

  const dismiss = () => {
    persistDismissed();
    setHidden(true);
  };

  const handleSubscribe = async () => {
    setBusy(true);
    try {
      const permission = await requestPermission();
      if (permission !== 'granted') {
        notify('Notifications désactivées — vous pourrez réessayer plus tard.', 'info', 3000);
        dismiss();
        return;
      }
      const registration = await navigator.serviceWorker?.ready;
      const subscription = await subscribePush(registration);
      const serialized = serializeSubscription(subscription);
      if (serialized) {
        onSubscribe?.(serialized);
        notify('Prévenu à chaque combat ! 🔔', 'success', 3000);
      }
      dismiss();
    } catch {
      notify('Impossible d’activer les notifications pour le moment.', 'error', 3000);
    } finally {
      setBusy(false);
    }
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="push-opt-in" role="region" aria-label="Notifications reminder">
      <div className="push-opt-in__icon" aria-hidden="true">
        🔔
      </div>
      <div className="push-opt-in__content">
        <div className="push-opt-in__title">Se rappeler de moi</div>
        <div className="push-opt-in__text">
          Recevez une notification quand un combat est prêt.
        </div>
      </div>
      <div className="push-opt-in__actions">
        <button
          type="button"
          className="push-opt-in__button push-opt-in__button--primary"
          onClick={handleSubscribe}
          disabled={busy}
        >
          🔔 Se rappeler de moi
        </button>
        <button
          type="button"
          className="push-opt-in__button push-opt-in__button--secondary"
          onClick={dismiss}
          disabled={busy}
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
