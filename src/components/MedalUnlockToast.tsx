import { useEffect, useRef } from 'react';
import { PixelIcon } from './PixelIcon';
import type { MedalDef } from '../utils/medalUtils';
import '../styles/components/_medal-unlock-toast.scss';

const PIXEL_ICON_TYPES = [
  'fighters', 'arena', 'levels', 'updates', 'user', 'trophy', 'power',
  'sword', 'backpack', 'dice', 'history', 'skull', 'swords', 'strength',
  'vitality', 'dexterity', 'luck', 'intelligence', 'focus', 'chest', 'gear', 'close',
] as const;

type PixelIconType = (typeof PIXEL_ICON_TYPES)[number];

function isPixelIconType(value: string): value is PixelIconType {
  return PIXEL_ICON_TYPES.includes(value as PixelIconType);
}

function getIconType(medalDef: MedalDef): PixelIconType {
  if (isPixelIconType(medalDef.icon)) {
    return medalDef.icon;
  }
  return 'trophy';
}

interface MedalUnlockToastProps {
  medal: MedalDef;
  onDismiss: () => void;
  /** Duration in ms before auto-dismiss (default: 4000) */
  autoHideDuration?: number;
}

export function MedalUnlockToast({ medal, onDismiss, autoHideDuration = 4000 }: MedalUnlockToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, autoHideDuration);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [onDismiss, autoHideDuration]);

  return (
    <div className="medal-unlock-toast" role="alert" aria-live="polite">
      <div className="medal-unlock-toast__icon">
        <PixelIcon type={getIconType(medal)} size={28} />
      </div>
      <div className="medal-unlock-toast__content">
        <div className="medal-unlock-toast__title">Medal Unlocked!</div>
        <div className="medal-unlock-toast__name">{medal.name}</div>
        <div className="medal-unlock-toast__reward">{medal.reward.label}</div>
      </div>
      <button
        className="medal-unlock-toast__close"
        onClick={onDismiss}
        aria-label="Close medal notification"
      >
        ×
      </button>
    </div>
  );
}
