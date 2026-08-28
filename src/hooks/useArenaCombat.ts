import { useCallback, useEffect, useMemo, useState } from 'react';
import { MonsterId } from '../data/monsterAssets';
import { BOSS_ID, BossId } from '../data/bossAssets';
import { Character } from '../types/Character';
import { MatchmakingResult } from '../utils/matchmakingUtils';
import { getTacticalHint } from '../utils/tacticalLens';
import {
  buildBossCharacter,
  createBossProgress,
  ensureBossDailyReset,
  getBossAttacksLeft,
  isBossUnlocked,
} from '../utils/bossUtils';

interface FightResult {
  xpGained: number;
  leveledUp: boolean;
  levelsGained: number;
  newLevel: number;
}

type UseFight = (
  won: boolean,
  xpGained: number,
  opponentName: string,
  opponentId: string,
) => Promise<FightResult | null>;

type UseBossFight = (
  won: boolean,
  xpGained: number,
  bossName: string,
  options?: { consumeEnergy?: boolean; characterOverride?: Character; bossHpLeft?: number },
) => Promise<FightResult | null>;

export type ArenaMode = 'pvp' | 'pve';

interface UseArenaCombatOptions {
  character: Character | null;
  isOfflineMode: boolean;
  connectionMessage: string;
  ensureConnection: (message: string) => Promise<boolean>;
  openModal: (message: string) => void;
  startMatchmaking: () => Promise<MatchmakingResult | null>;
  useFight: UseFight;
  useBossFight: UseBossFight;
  onLevelUp: (levelsGained: number, newLevel: number) => void;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error && error.message ? error.message : fallback;
};

export const useArenaCombat = ({
  character,
  isOfflineMode,
  connectionMessage,
  ensureConnection,
  openModal,
  startMatchmaking,
  useFight,
  useBossFight,
  onLevelUp,
}: UseArenaCombatOptions) => {
  const [mode, setMode] = useState<ArenaMode>('pve');
  const [matchmaking, setMatchmaking] = useState(false);
  const [combatData, setCombatData] = useState<MatchmakingResult | null>(null);
  const [pveMonster, setPveMonster] = useState<{ monsterId: MonsterId | BossId } | null>(null);
  const [previewOpponent, setPreviewOpponent] = useState<Character | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fightsLeft = character?.fightsLeft ?? 0;
  const bossProgress = character?.bossProgress
    ? ensureBossDailyReset(character.bossProgress)
    : null;
  const bossAttacksLeft = getBossAttacksLeft(character?.bossProgress);
  const bossUnlocked = !!character && isBossUnlocked(character.level);
  const hasPendingFight = !!character?.pendingFight;
  const autoMode = !!character?.autoMode;

  const pveMode = mode === 'pve';

  const canFight = !!character
    && !isOfflineMode
    && !hasPendingFight
    && !autoMode
    && (pveMode
      ? bossUnlocked && bossAttacksLeft > 0
      : fightsLeft > 0);

  const onTogglePve = useCallback(() => {
    setMode('pve');
    setPreviewOpponent(null);
    setPreviewLoading(false);
  }, []);
  const onTogglePvp = useCallback(() => {
    setMode('pvp');
    setPreviewOpponent(null);
    setPreviewLoading(false);
  }, []);

  const onFight = useCallback(async () => {
    if (!character || matchmaking || hasPendingFight || character.autoMode) return;
    const canProceed = await ensureConnection(connectionMessage);
    if (!canProceed) return;

    if (window.navigator.vibrate) window.navigator.vibrate(80);

    if (pveMode) {
      try {
        const progress = character.bossProgress
          ? ensureBossDailyReset(character.bossProgress)
          : createBossProgress(character);
        const boss = buildBossCharacter(character, progress.bossHp);
        setPveMonster({ monsterId: BOSS_ID });
        setCombatData({ opponent: boss, matchType: 'boss', candidates: [] });
      } catch (error: unknown) {
        console.error('Boss generation failed:', error);
        openModal(connectionMessage);
      }
      return;
    }

    setMatchmaking(true);
    setPreviewOpponent(null);
    try {
      const match = await startMatchmaking();
      if (!match) {
        openModal('No opponents found! Try again later.');
        return;
      }
      setCombatData(match);
    } catch (error: unknown) {
      console.error('Matchmaking failed:', error);
      openModal(connectionMessage);
    } finally {
      setMatchmaking(false);
    }
  }, [
    character,
    connectionMessage,
    ensureConnection,
    hasPendingFight,
    matchmaking,
    openModal,
    pveMode,
    startMatchmaking,
  ]);

  const onCombatComplete = useCallback(async (
    won: boolean,
    xpGained: number,
    bossHpLeft?: number,
  ) => {
    try {
      const opponentName = combatData?.opponent.name ?? 'UNKNOWN';
      /* eslint-disable react-hooks/rules-of-hooks -- callbacks, not hooks */
      const result = combatData?.matchType === 'boss'
        ? await useBossFight(won, xpGained, opponentName, {
            bossHpLeft: bossHpLeft ?? combatData.opponent.hp,
          })
        : await useFight(won, xpGained, opponentName, combatData?.opponent.id ?? '');
      /* eslint-enable react-hooks/rules-of-hooks */

      if (result?.leveledUp) {
        onLevelUp(result.levelsGained, result.newLevel);
      }
    } catch (error: unknown) {
      console.error('Fight result save failed:', error);
      openModal(getErrorMessage(error, connectionMessage));
    }
  }, [combatData, connectionMessage, onLevelUp, openModal, useBossFight, useFight]);

  const onCloseCombat = useCallback(() => {
    setCombatData(null);
    setPveMonster(null);
    setPreviewOpponent(null);
    setPreviewLoading(false);
  }, []);

  const tacticalHint = useMemo(() => {
    if (!character || !previewOpponent) return null;
    return getTacticalHint(character, previewOpponent);
  }, [character, previewOpponent]);

  useEffect(() => {
    if (pveMode || isOfflineMode || !character || hasPendingFight || autoMode || combatData || previewOpponent || previewLoading) return;
    if (fightsLeft <= 0) return;
    if (typeof startMatchmaking !== 'function') return;
    let cancelled = false;
    setPreviewLoading(true);
    try {
      const maybePromise = startMatchmaking();
      if (!maybePromise || typeof (maybePromise as Promise<unknown>).then !== 'function') {
        setPreviewLoading(false);
        return;
      }
      (maybePromise as Promise<MatchmakingResult | null>)
        .then((match) => {
          if (!cancelled && match?.opponent) setPreviewOpponent(match.opponent);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    } catch {
      setPreviewLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [pveMode, isOfflineMode, character, hasPendingFight, autoMode, combatData, previewOpponent, previewLoading, fightsLeft, startMatchmaking]);

  const actionPanelProps = useMemo(() => ({
    pveMode,
    canFight,
    matchmaking,
    hasPendingFight,
    autoMode,
    isOfflineMode,
    fightsLeft,
    bossAttacksLeft,
    bossUnlocked,
    bossHp: bossProgress?.bossHp ?? 0,
    bossMaxHp: bossProgress?.bossMaxHp ?? 0,
    bossLevel: bossProgress?.bossLevel ?? 0,
    onTogglePve,
    onTogglePvp,
    onFight,
    tacticalOpponent: previewOpponent,
    tacticalHint,
    previewLoading,
  }), [
    autoMode,
    bossAttacksLeft,
    bossProgress?.bossHp,
    bossProgress?.bossMaxHp,
    bossProgress?.bossLevel,
    bossUnlocked,
    canFight,
    fightsLeft,
    hasPendingFight,
    isOfflineMode,
    matchmaking,
    onFight,
    onTogglePve,
    onTogglePvp,
    previewOpponent,
    previewLoading,
    pveMode,
    tacticalHint,
  ]);

  return {
    mode,
    pveMode,
    matchmaking,
    combatData,
    pveMonster,
    fightsLeft,
    hasPendingFight,
    autoMode,
    canFight,
    bossUnlocked,
    bossAttacksLeft,
    previewOpponent,
    tacticalHint,
    previewLoading,
    onTogglePve,
    onTogglePvp,
    onFight,
    onCombatComplete,
    onCloseCombat,
    actionPanelProps,
  };
};
