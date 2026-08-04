import { useCallback, useEffect, useRef, useState } from 'react';
import { Character } from '../types/Character';
import { SoundType } from './useSound';
import { STAT_KEYS, StatKey, allocateStatsByArchetype } from '../utils/statUtils';

export interface RecentLevelUp {
  newLevel: number;
  isMilestone?: boolean;
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
  const levelUpQueueRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const queueLevelUp = useCallback((levelsGained: number, newLevel: number) => {
    if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    levelUpTimerRef.current = null;
    levelUpQueueRef.current.forEach(t => clearTimeout(t));
    levelUpQueueRef.current = [];

    const total = Math.max(1, levelsGained);
    const startLevel = newLevel - total + 1;

    // Multiple levels at once (offline catch-up) → show one FX per level
    // with a short stagger instead of jumping straight to the final level.
    if (total > 1) {
      for (let i = 0; i < total; i++) {
        const level = startLevel + i;
        const isLast = i === total - 1;
        levelUpQueueRef.current.push(setTimeout(() => {
          setRecentLevelUp({ newLevel: level, isMilestone: isMilestoneLevel(level) });
          if (isLast) {
            levelUpTimerRef.current = setTimeout(() => {
              setRecentLevelUp(null);
              levelUpTimerRef.current = null;
            }, 2000);
          }
        }, i * 1200));
      }
      return;
    }

    setRecentLevelUp({ newLevel, isMilestone: isMilestoneLevel(newLevel) });
    levelUpTimerRef.current = setTimeout(() => {
      setRecentLevelUp(null);
      levelUpTimerRef.current = null;
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
      levelUpQueueRef.current.forEach(t => clearTimeout(t));
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
