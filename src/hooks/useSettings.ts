import { useCallback, useEffect, useMemo, useState } from 'react';
import { Character } from '../types/Character';
import { SettingsLogEntry } from '../utils/arenaUtils';
import { GAME_RULES, type CombatSpeed } from '../config/gameRules';

type SettingsView = 'main' | 'logs' | 'medals';
type DeleteStep = 'idle' | 'confirm';

const COMBAT_SPEED_STORAGE_KEY = 'bitbrawler_combat_speed';

const isCombatSpeed = (value: unknown): value is CombatSpeed =>
  typeof value === 'number' &&
  (GAME_RULES.COMBAT.SPEED_OPTIONS as readonly number[]).includes(value);

const readStoredCombatSpeed = (): CombatSpeed => {
  try {
    const raw = localStorage.getItem(COMBAT_SPEED_STORAGE_KEY);
    if (!raw) return GAME_RULES.COMBAT.SPEED_OPTIONS[0];
    const parsed: unknown = JSON.parse(raw);
    if (isCombatSpeed(parsed)) return parsed;
  } catch {
    return GAME_RULES.COMBAT.SPEED_OPTIONS[0];
  }
  return GAME_RULES.COMBAT.SPEED_OPTIONS[0];
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error && error.message ? error.message : fallback;
};

interface UseSettingsOptions {
  character: Character | null;
  isOfflineMode: boolean;
  connectionMessage: string;
  ensureConnection: (message: string) => Promise<boolean>;
  openModal: (message: string) => void;
  setAutoMode: (enabled: boolean) => Promise<Character | null>;
  deleteCharacter: () => Promise<boolean>;
  onDeleted: () => void;
}

export const useSettings = ({
  character,
  isOfflineMode,
  connectionMessage,
  ensureConnection,
  openModal,
  setAutoMode,
  deleteCharacter,
  onDeleted,
}: UseSettingsOptions) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [autoModeUpdating, setAutoModeUpdating] = useState(false);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('idle');
  const [deletePending, setDeletePending] = useState(false);
  const [combatSpeed, setCombatSpeed] = useState<CombatSpeed>(readStoredCombatSpeed);

  const autoModeEnabled = !!character?.autoMode;

  const combinedHistory: SettingsLogEntry[] = useMemo(
    () => [
      ...(character?.fightHistory ?? []).map((fight) => ({
        date: fight.date,
        won: fight.won,
        direction: 'outgoing' as const,
        displayName: fight.opponentName,
      })),
      ...(character?.incomingFightHistory ?? []).map((fight) => ({
        date: fight.date,
        won: fight.won,
        direction: 'incoming' as const,
        displayName: fight.attackerName,
      })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 20),
    [character?.fightHistory, character?.incomingFightHistory],
  );

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const handleOpenHistoryFromSettings = useCallback(() => setSettingsView('logs'), []);
  const handleOpenMedals = useCallback(() => setSettingsView('medals'), []);
  const handleReturnToSettings = useCallback(() => setSettingsView('main'), []);

  const handleToggleAutoMode = useCallback(async () => {
    if (autoModeUpdating) return;
    if (isOfflineMode) {
      openModal(connectionMessage);
      return;
    }

    const canProceed = await ensureConnection(connectionMessage);
    if (!canProceed) return;

    setAutoModeUpdating(true);
    try {
      await setAutoMode(!autoModeEnabled);
    } catch (error: unknown) {
      openModal(getErrorMessage(error, connectionMessage));
    } finally {
      setAutoModeUpdating(false);
    }
  }, [
    autoModeEnabled,
    autoModeUpdating,
    connectionMessage,
    ensureConnection,
    isOfflineMode,
    openModal,
    setAutoMode,
  ]);

  const handleToggleCombatSpeed = useCallback(() => {
    setCombatSpeed((prev) => {
      const options = GAME_RULES.COMBAT.SPEED_OPTIONS;
      const next = options[(options.indexOf(prev) + 1) % options.length];
      try {
        localStorage.setItem(COMBAT_SPEED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        return prev;
      }
      return next;
    });
  }, []);

  const handleDeleteCharacter = useCallback(async () => {
    if (deletePending) return;
    if (deleteStep === 'idle') {
      setDeleteStep('confirm');
      return;
    }
    if (isOfflineMode) {
      openModal(connectionMessage);
      return;
    }

    const canProceed = await ensureConnection(connectionMessage);
    if (!canProceed) return;

    setDeletePending(true);
    try {
      await deleteCharacter();
      closeSettings();
      onDeleted();
    } catch (error: unknown) {
      openModal(getErrorMessage(error, connectionMessage));
    } finally {
      setDeletePending(false);
    }
  }, [
    closeSettings,
    connectionMessage,
    deleteCharacter,
    deletePending,
    deleteStep,
    ensureConnection,
    isOfflineMode,
    onDeleted,
    openModal,
  ]);

  useEffect(() => {
    if (!settingsOpen) {
      setSettingsView('main');
      setDeleteStep('idle');
      setDeletePending(false);
    }
  }, [settingsOpen]);

  return {
    settingsOpen,
    openSettings,
    closeSettings,
    settingsView,
    autoModeEnabled,
    autoModeUpdating,
    deleteStep,
    deletePending,
    combinedHistory,
    isOfflineMode,
    setDeleteStep,
    handleToggleAutoMode,
    handleDeleteCharacter,
    handleOpenHistoryFromSettings,
    handleOpenMedals,
    handleReturnToSettings,
    onClose: closeSettings,
    onToggleAutoMode: handleToggleAutoMode,
    onDeleteCharacter: handleDeleteCharacter,
    onOpenLogs: handleOpenHistoryFromSettings,
    onOpenMedals: handleOpenMedals,
    onReturnToMain: handleReturnToSettings,
    onSetDeleteStep: setDeleteStep,
    combatSpeed,
    handleToggleCombatSpeed,
    onToggleCombatSpeed: handleToggleCombatSpeed,
  };
};
