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

  const queueLevelUp = useCallback((_levelsGained: number, newLevel: number) => {
    setRecentLevelUp({ newLevel, isMilestone: isMilestoneLevel(newLevel) });
    play('levelup');

    if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    levelUpTimerRef.current = setTimeout(() => {
      setRecentLevelUp(null);
      levelUpTimerRef.current = null;
    }, 2000);
  }, [play]);

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
