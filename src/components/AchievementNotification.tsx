import { useEffect, useRef, useCallback } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { AchievementDef } from '../utils/achievementUtils';

interface AchievementNotificationProps {
  achievement: AchievementDef | null;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  combat: '⚔️',
  pve: '👾',
  collection: '💎',
  leveling: '⬆️',
  equipment: '🛡️',
  forge: '🔨',
  secret: '❓',
};

/**
 * Toast‑like notification that slides in from the top‑right when a new
 * achievement is unlocked.  Auto‑dismisses after 5 seconds.
 */
const AchievementNotification = ({ achievement, onClose }: AchievementNotificationProps) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationRef = useFocusTrap<HTMLDivElement>(!!achievement, onClose);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!achievement) {
      clearTimer();
      return;
    }

    // Start auto‑dismiss timer
    timerRef.current = setTimeout(() => {
      onClose();
      timerRef.current = null;
    }, 5000);

    return clearTimer;
  }, [achievement, onClose, clearTimer]);

  if (!achievement) return null;

  return (
    <div
      className="achievement-notification"
      role="alert"
      aria-live="polite"
      ref={notificationRef}
      onClick={() => {
        clearTimer();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clearTimer();
          onClose();
        }
      }}
      tabIndex={0}
    >
      <span className="achievement-notification-icon">
        {CATEGORY_ICONS[achievement.category] ?? '🏆'}
      </span>
      <div className="achievement-notification-content">
        <span className="achievement-notification-label">ACHIEVEMENT UNLOCKED!</span>
        <span className="achievement-notification-name">{achievement.name}</span>
      </div>
    </div>
  );
};

export default AchievementNotification;
