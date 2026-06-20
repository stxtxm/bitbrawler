import { useCallback, useEffect, useState } from 'react';
import { Character } from '../types/Character';
import { SoundType } from './useSound';
import { autoAllocateStatPoints, HP_PER_LEVEL, STAT_KEYS, StatKey } from '../utils/statUtils';

interface LevelUpData {
  levelsGained: number;
  newLevel: number;
  hpGained: number;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error && error.message ? error.message : fallback;
};

interface UseArenaLevelUpOptions {
  character: Character | null;
  lastXpGain: number | null;
  connectionMessage: string;
  clearXpNotifications: () => void;
  setCharacter: (character: Character) => void;
  allocateStatPoint: (stat: StatKey) => Promise<Character | null>;
  saveStatAllocations: (allocations: Partial<Record<StatKey, number>>) => Promise<Character | null>;
  openModal: (message: string) => void;
  play: (sound: SoundType) => void;
}

export const useArenaLevelUp = ({
  character,
  lastXpGain,
  connectionMessage,
  clearXpNotifications,
  setCharacter,
  allocateStatPoint,
  saveStatAllocations,
  openModal,
  play,
}: UseArenaLevelUpOptions) => {
  const [showXpGain, setShowXpGain] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpData | null>(null);
  const [xpBarAnimating, setXpBarAnimating] = useState(false);
  const [saving, setSaving] = useState(false);

  const pointsRemaining = character?.statPoints ?? 0;

  const queueLevelUp = useCallback((levelsGained: number, newLevel: number) => {
    if (character?.autoMode) return;
    setPendingLevelUp({
      levelsGained,
      newLevel,
      hpGained: levelsGained * HP_PER_LEVEL,
    });
    setShowLevelUp(true);
  }, [character?.autoMode]);

  const handleAllocateStat = useCallback(async (stat: StatKey) => {
    if (saving || pointsRemaining <= 0) return;
    setSaving(true);
    try {
      await allocateStatPoint(stat);
    } catch (error: unknown) {
      openModal(getErrorMessage(error, connectionMessage));
    } finally {
      setSaving(false);
    }
  }, [allocateStatPoint, connectionMessage, openModal, pointsRemaining, saving]);

  const handleDismissLevelUp = useCallback(() => {
    setShowLevelUp(false);
    setPendingLevelUp(null);
    clearXpNotifications();
  }, [clearXpNotifications]);

  const handleOpenLevelUp = useCallback(() => {
    setPendingLevelUp(null);
    setShowLevelUp(true);
  }, []);

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

  useEffect(() => {
    return () => {
      clearXpNotifications();
    };
  }, [clearXpNotifications]);

  useEffect(() => {
    if (!character?.autoMode) return;
    const points = character.statPoints ?? 0;
    if (points <= 0) return;

    const updated = autoAllocateStatPoints(character, points);
    setCharacter(updated);
    setShowLevelUp(false);
    setPendingLevelUp(null);
    clearXpNotifications();

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
  }, [character, clearXpNotifications, saveStatAllocations, setCharacter]);

  useEffect(() => {
    if (!character?.autoMode) return;
    if ((character.statPoints ?? 0) > 0) return;

    setShowLevelUp(false);
    setPendingLevelUp(null);
    clearXpNotifications();
  }, [character?.autoMode, character?.statPoints, clearXpNotifications]);

  useEffect(() => {
    if (showLevelUp) play('levelup');
  }, [play, showLevelUp]);

  return {
    showXpGain,
    showLevelUp,
    pendingLevelUp,
    xpBarAnimating,
    saving,
    pointsRemaining,
    queueLevelUp,
    handleAllocateStat,
    handleDismissLevelUp,
    handleOpenLevelUp,
  };
};
