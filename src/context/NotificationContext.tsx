/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useState, ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'xp' | 'level-up';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration: number;
  timestamp: number;
}

interface NotificationContextType {
  notifications: Notification[];
  notify: (message: string, type: NotificationType, duration?: number) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback(
    (message: string, type: NotificationType = 'info', duration: number = 3000) => {
      const id = `${Date.now()}-${Math.random()}`;
      const newNotification: Notification = {
        id,
        message,
        type,
        duration,
        timestamp: Date.now(),
      };

      setNotifications((prev) => {
        const updated = [...prev, newNotification];
        // Keep max 3 notifications visible
        return updated.slice(-3);
      });

      // Auto-dismiss after duration
      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      // Vibration feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (type === 'success' || type === 'level-up') {
          navigator.vibrate(100);
        } else if (type === 'error') {
          navigator.vibrate([200, 100, 200]);
        }
      }
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss, clear }}>
      {children}
    </NotificationContext.Provider>
  );
};
