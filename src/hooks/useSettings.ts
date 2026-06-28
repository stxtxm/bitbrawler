import { useCallback, useEffect, useMemo, useState } from 'react';
import { Character } from '../types/Character';
import { SettingsLogEntry } from '../utils/arenaUtils';

type SettingsView = 'main' | 'logs' | 'medals';
type DeleteStep = 'idle' | 'confirm';

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
  };
};
