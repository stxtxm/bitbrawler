import { useNotification } from '../hooks/useNotification';
import '../styles/components/_notifications.scss';

export function NotificationDisplay() {
  const { notifications, dismiss } = useNotification();

  return (
    <div className="notifications-container">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`notification notification--${notif.type}`}
          role="alert"
          aria-live="polite"
        >
          <div className="notification__content">
            <div className="notification__icon">
              {notif.type === 'success' && '✓'}
              {notif.type === 'error' && '✕'}
              {notif.type === 'warning' && '⚠'}
              {notif.type === 'info' && 'ℹ'}
              {notif.type === 'xp' && '✨'}
              {notif.type === 'level-up' && '⬆'}
              {notif.type === 'salvage' && '⚒'}
              {notif.type === 'fusion-success' && '🔗'}
              {notif.type === 'fusion-lucky' && '⭐'}
              {notif.type === 'upgrade-success' && '⬆'}
              {notif.type === 'upgrade-maxed' && '⚠'}
              {notif.type === 'essence-insufficient' && '⛔'}
              {notif.type === 'forge-welcome' && '⚒'}
            </div>
            <div className="notification__message">{notif.message}</div>
          </div>
          <button
            className="notification__close"
            onClick={() => dismiss(notif.id)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
