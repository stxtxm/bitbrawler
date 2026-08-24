import { useCallback, useEffect, useRef, useState } from 'react';
import { Character } from '../types/Character';
import { SoundType } from './useSound';
import { STAT_KEYS, StatKey, allocateStatsByArchetype } from '../utils/statUtils';

export interface RecentLevelUp {
  newLevel: number;
  isMilestone?: boolean;
  /** Number of levels gained in one go (offline catch-up). When > 1 the FX is
   * aggregated into a single announcement instead of one flash per level. */
  count?: number;
}

export const isMilestoneLevel = (level: number): boolean => {
  return level > 0 && level % 5 === 0;
};

interface UseArenaLevelUpOptions {
  character: Character | null;
  lastXpGain: number | null;
  clearXpNotifications: () => void;
  setCharacter: (character: Character) => void;
  saveStatAllocations: (allocations: Partial<Record<StatKey, number>>) => Promise<Character | null>;
  play: (sound: SoundType) => void;
}

export const useArenaLevelUp = ({
  character,
  lastXpGain,
  clearXpNotifications,
  setCharacter,
  saveStatAllocations,
  play,
}: UseArenaLevelUpOptions) => {
  const [showXpGain, setShowXpGain] = useState(false);
  const [xpBarAnimating, setXpBarAnimating] = useState(false);
  const [recentLevelUp, setRecentLevelUp] = useState<RecentLevelUp | null>(null);
  const levelUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dedup guard: Android throttles timers while locked/screen-off — several
  // queued calls for the SAME level would replay the FX in a loop.
  const lastQueuedRef = useRef<{ level: number; at: number } | null>(null);
  // Imperative lock: set synchronously inside queueLevelUp so back-to-back
  // synchronous calls (before React re-renders) cannot double-fire the FX.
  const fxActiveRef = useRef(false);
  // 0 = no real visible-transition seen yet (tests / first mount)
  const lastVisibleAtRef = useRef(0);

  // ── Announcement throttle (5.5.1) ────────────────────────────────────────
  // At early levels one idle kill can cross a threshold every few fights:
  // legit crossings, but back-to-back flashes read as a looping FX and starve
  // the hide-timer (stuck text). Minimum 8s between announcements; levels
  // gained meanwhile are AGGREGATED into the next announcement (+N niveaux).
  const MIN_ANNOUNCE_INTERVAL = 8000;
  const lastShownAtRef = useRef(0);
  const pendingRef = useRef<{ levels: number; newLevel: number } | null>(null);

  // Visibility transitions OWN the FX lifecycle across locks: on hide, any
  // pending announcement is dropped (frozen timers otherwise leave the
  // floating text stuck forever); on visible, a 5s grace window keeps late
  // throttled ticks silent — the welcome-back popup aggregates those gains.
  useEffect(() => {
    const h = () => {
      if (levelUpTimerRef.current) {
        clearTimeout(levelUpTimerRef.current);
        levelUpTimerRef.current = null;
      }
      setRecentLevelUp(null);
      // Release the imperative FX lock AND drop aggregated pending levels:
      // the lock must never outlive the purge, otherwise every future
      // queueLevelUp is swallowed forever (reviewer-caught leak).
      fxActiveRef.current = false;
      pendingRef.current = null;
      if (document.visibilityState === 'visible') {
        lastVisibleAtRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  const queueLevelUp = useCallback((levelsGained: number, newLevel: number) => {
    // Swallow while an FX is already showing: aggregate into pending instead.
    if (fxActiveRef.current) {
      const p = pendingRef.current ?? { levels: 0, newLevel };
      pendingRef.current = { levels: p.levels + Math.max(1, levelsGained), newLevel };
      return;
    }

    // Never play FX while the page is hidden/backgrounded: the offline popup /
    // welcome-back flow announces those gains on return instead.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    // Post-unlock grace: late throttled ticks draining their backlog must not
    // replay announcements one by one (reported: FX relaunched every monster).
    if (lastVisibleAtRef.current && Date.now() - lastVisibleAtRef.current < 5000) return;

    const now = Date.now();
    // Global rate-limit: aggregate anything arriving inside the window.
    if (now - lastShownAtRef.current < MIN_ANNOUNCE_INTERVAL) {
      const p = pendingRef.current ?? { levels: 0, newLevel };
      pendingRef.current = {
        levels: p.levels + Math.max(1, levelsGained),
        newLevel: Math.max(p.newLevel, newLevel),
      };
      return;
    }
    lastShownAtRef.current = now;
    // Include any levels aggregated during previous suppressed windows
    const carried = pendingRef.current;
    const total = Math.max(1, levelsGained) + (carried?.levels ?? 0);
    pendingRef.current = null;
    fxActiveRef.current = true;

    if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    levelUpTimerRef.current = null;
    lastQueuedRef.current = { level: newLevel, at: now };

    // Multiple levels at once (offline catch-up) → show ONE aggregated FX
    // announcing the final level with the total gained. Staggering one flash
    // per level (1200ms apart) read as "a level-up for every monster killed"
    // during a big catch-up, and spammed the level-up sound N times.
    const isMilestone = isMilestoneLevel(newLevel);
    setRecentLevelUp(total > 1 ? { newLevel, isMilestone, count: total } : { newLevel, isMilestone });
    levelUpTimerRef.current = setTimeout(() => {
      setRecentLevelUp(null);
      levelUpTimerRef.current = null;
      lastQueuedRef.current = null;
      fxActiveRef.current = false;
    }, 2000);
  }, []);

  // XP flash timing
  useEffect(() => {
    if (lastXpGain !== null) {
      setShowXpGain(true);
      setXpBarAnimating(true);

      const timer = setTimeout(() => {
        setShowXpGain(false);
        setXpBarAnimating(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [lastXpGain]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearXpNotifications();
      if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    };
  }, [clearXpNotifications]);

  // Auto-allocate stat points by archetype whenever statPoints > 0.
  // This fires after any level-up (idle or PvP) and after offline catch-up.
  // queueLevelUp only sets the visual signal — this effect handles allocation.
  useEffect(() => {
    if (!character) return;
    const points = character.statPoints ?? 0;
    if (points <= 0) return;

    const updated = allocateStatsByArchetype(character, points);
    setCharacter(updated);

    const allocations: Partial<Record<StatKey, number>> = {};
    for (const key of STAT_KEYS) {
      const delta = updated[key] - character[key];
      if (delta > 0) allocations[key] = delta;
    }

    if (Object.keys(allocations).length > 0) {
      saveStatAllocations(allocations).catch((error: unknown) => {
        console.error('Auto-allocate DB save failed:', error);
      });
    }
  }, [character, saveStatAllocations, setCharacter]);

  // Sound effect for level-up signal
  useEffect(() => {
    if (recentLevelUp) play('levelup');
  }, [play, recentLevelUp]);

  return {
    showXpGain,
    xpBarAnimating,
    recentLevelUp,
    queueLevelUp,
  };
};
