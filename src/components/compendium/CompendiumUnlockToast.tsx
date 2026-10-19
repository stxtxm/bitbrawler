import { useEffect, useRef, useState } from 'react';
import {
  COMPENDIUM_UNLOCK_EVENT,
  type CompendiumUnlockDetail,
} from '../../utils/compendiumEvents';

const AUTO_HIDE_MS = 4000;

export function CompendiumUnlockToast() {
  const [detail, setDetail] = useState<CompendiumUnlockDetail | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleUnlock = (event: Event) => {
      const customEvent = event as CustomEvent<CompendiumUnlockDetail>;
      if (!customEvent.detail) return;
      setDetail(customEvent.detail);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setDetail(null), AUTO_HIDE_MS);
    };

    window.addEventListener(COMPENDIUM_UNLOCK_EVENT, handleUnlock);
    return () => {
      window.removeEventListener(COMPENDIUM_UNLOCK_EVENT, handleUnlock);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  if (!detail) return null;

  const isBestiary = detail.kind === 'bestiary';

  return (
    <div className="compendium-unlock-toast" role="status" aria-live="polite">
      <div className="compendium-unlock-toast__badge">
        {isBestiary ? 'BESTIARY' : 'ARMORY'}
      </div>
      <div className="compendium-unlock-toast__content">
        <div className="compendium-unlock-toast__title">
          {isBestiary ? 'New bestiary entry!' : 'New armory entry!'}
        </div>
        <div className="compendium-unlock-toast__name">{detail.name}</div>
      </div>
      <button
        className="compendium-unlock-toast__close"
        onClick={() => setDetail(null)}
        aria-label="Dismiss compendium notification"
      >
        ×
      </button>
    </div>
  );
}
