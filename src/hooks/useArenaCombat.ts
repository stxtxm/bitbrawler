import { useCallback, useEffect, useMemo, useState } from 'react';
import { MonsterId } from '../data/monsterAssets';
import { ABYSSAL_BOSS_ID, BOSS_ID, BossId } from '../data/bossAssets';
import { Character } from '../types/Character';
import { MatchmakingResult } from '../utils/matchmakingUtils';
import { getTacticalHint } from '../utils/tacticalLens';
import { isBurstActive, getEffectiveMaxFights, BURST_MUTATORS, applyBurstMutator, logDepthToIdleRatio, type BurstMutatorId } from '../data/liveOps';
import {
  buildBossCharacter,
  createBossProgress,
  ensureBossDailyReset,
  getBossAttacksLeft,
  getBossPityReductionPct,
  getBossProgressForId,
  isBossUnlocked,
  isBossUnlockedForCharacter,
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
  options?: { consumeEnergy?: boolean; characterOverride?: Character; bossHpLeft?: number; bossId?: BossId },
) => Promise<FightResult | null>;

export type ArenaMode = 'pvp' | 'pve';

interface UseArenaCombatOptions {
  character: Character | null;
  isOfflineMode: boolean;
  connectionMessage: string;
  ensureConnection: (message: string) => Promise<boolean>;
  openModal: (message: string) => void;
  startMatchmaking: () => Promise<MatchmakingResult | null>;
  findPreviewOpponent?: () => Promise<MatchmakingResult | null>;
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
  findPreviewOpponent,
  useFight,
  useBossFight,
  onLevelUp,
}: UseArenaCombatOptions) => {
  const [mode, setMode] = useState<ArenaMode>('pve');
  const [matchmaking, setMatchmaking] = useState(false);
  const [combatData, setCombatData] = useState<MatchmakingResult | null>(null);
  const [pveMonster, setPveMonster] = useState<{ monsterId: MonsterId | BossId } | null>(null);
  const [previewMatch, setPreviewMatch] = useState<MatchmakingResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [burstMutator, setBurstMutator] = useState<BurstMutatorId | null>(null);

  const previewOpponent = previewMatch?.opponent ?? null;

  const burstActive = useMemo(() => isBurstActive(new Date()), []);
  const idlePaused = burstActive
  const effectiveMaxFights = getEffectiveMaxFights(burstActive)
  const rawFightsLeft = character?.fightsLeft ?? 0
  const fightsLeft = burstActive ? Math.min(rawFightsLeft + 1, effectiveMaxFights) : rawFightsLeft
  const draftOptions = burstActive ? BURST_MUTATORS : []
  const bossProgress = character?.bossProgress
    ? ensureBossDailyReset(character.bossProgress)
    : null;
  const bossAttacksLeft = getBossAttacksLeft(character?.bossProgress);
  const bossUnlocked = !!character && isBossUnlocked(character.level);
  const abyssalRaw = character ? (getBossProgressForId(character, ABYSSAL_BOSS_ID) ?? (character as any).abyssalBossProgress) : undefined;
  const abyssalProgress = abyssalRaw ? ensureBossDailyReset(abyssalRaw) : null;
  const abyssalAttacksLeft = getBossAttacksLeft(abyssalRaw as any);
  const abyssalUnlocked = !!character && isBossUnlockedForCharacter(character, ABYSSAL_BOSS_ID);
  const hasPendingFight = !!character?.pendingFight;
  const autoMode = !!character?.autoMode;

  const pveMode = mode === 'pve';
  const effectiveBossId: BossId = abyssalUnlocked ? ABYSSAL_BOSS_ID : BOSS_ID;
  const effectiveBossProgress = effectiveBossId === ABYSSAL_BOSS_ID ? abyssalProgress : bossProgress;
  const effectiveAttacksLeft = effectiveBossId === ABYSSAL_BOSS_ID ? abyssalAttacksLeft : bossAttacksLeft;
  const effectiveUnlocked = effectiveBossId === ABYSSAL_BOSS_ID ? abyssalUnlocked : bossUnlocked;
  const effectivePityReduction = getBossPityReductionPct(effectiveBossProgress ?? undefined, effectiveBossId);
  const effectivePityStacks = effectiveBossProgress?.pityStacks ?? 0;

  const canFight = !!character
    && !isOfflineMode
    && !hasPendingFight
    && !autoMode
    && (pveMode
      ? effectiveUnlocked && effectiveAttacksLeft > 0
      : fightsLeft > 0)

  const selectMutator = useCallback((id: BurstMutatorId) => {
    if (!burstActive) return
    setBurstMutator(id)
  }, [burstActive])

  useEffect(() => {
    if (!burstActive) return
    logDepthToIdleRatio(pveMode ? 0 : 1, 0, new Date())
  }, [burstActive, pveMode])

  const onTogglePve = useCallback(() => {
    setMode('pve');
    setPreviewMatch(null);
    setPreviewLoading(false);
  }, []);
  const onTogglePvp = useCallback(() => {
    setMode('pvp');
    setPreviewMatch(null);
    setPreviewLoading(false);
  }, []);

  const onFight = useCallback(async () => {
    if (!character || matchmaking || hasPendingFight || character.autoMode) return;
    const canProceed = await ensureConnection(connectionMessage);
    if (!canProceed) return;

    if (window.navigator.vibrate) window.navigator.vibrate(80);

    if (pveMode) {
      try {
        const bossId = effectiveBossId;
        const existing = bossId === ABYSSAL_BOSS_ID
          ? (getBossProgressForId(character, ABYSSAL_BOSS_ID) ?? (character as any).abyssalBossProgress)
          : character.bossProgress;
        const progress = existing
          ? ensureBossDailyReset(existing)
          : createBossProgress(character, Date.now(), bossId);
        const boss = buildBossCharacter(character, progress.bossHp, bossId, progress.pityStacks ?? 0);
        setPveMonster({ monsterId: bossId as any });
        setCombatData({ opponent: boss, matchType: 'boss', candidates: [] });
      } catch (error: unknown) {
        console.error('Boss generation failed:', error);
        openModal(connectionMessage);
      }
      return;
    }

    if (previewMatch) {
      setCombatData(previewMatch);
      setPreviewMatch(null);
      setPreviewLoading(false);
      return;
    }

    setMatchmaking(true);
    setPreviewMatch(null);
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
    previewMatch,
    pveMode,
    effectiveBossId,
    startMatchmaking,
  ]);

  const onCombatComplete = useCallback(async (
    won: boolean,
    xpGained: number,
    bossHpLeft?: number,
  ) => {
    try {
      const opponentName = combatData?.opponent.name ?? 'UNKNOWN';
      const bossIdForFight = (pveMonster?.monsterId as BossId) ?? effectiveBossId;
      let effectiveXp = xpGained
      const currentMutator = burstMutator
      if (burstActive && currentMutator) {
        const mutated = applyBurstMutator({ offense: 100, defense: 100, xp: xpGained }, currentMutator)
        effectiveXp = mutated.xp
        setBurstMutator(null)
      }
      /* eslint-disable react-hooks/rules-of-hooks -- callbacks, not hooks */
      const result = combatData?.matchType === 'boss'
        ? await useBossFight(won, effectiveXp, opponentName, {
            bossHpLeft: bossHpLeft ?? combatData.opponent.hp,
            bossId: bossIdForFight,
          })
        : await useFight(won, effectiveXp, opponentName, combatData?.opponent.id ?? '');
      /* eslint-enable react-hooks/rules-of-hooks */

      if (result?.leveledUp) {
        onLevelUp(result.levelsGained, result.newLevel);
      }
    } catch (error: unknown) {
      console.error('Fight result save failed:', error);
      openModal(getErrorMessage(error, connectionMessage));
    }
  }, [burstActive, burstMutator, combatData, connectionMessage, onLevelUp, openModal, useBossFight, useFight, pveMonster, effectiveBossId]);

  const onCloseCombat = useCallback(() => {
    setCombatData(null);
    setPveMonster(null);
    setPreviewMatch(null);
    setPreviewLoading(false);
  }, []);

  const tacticalHint = useMemo(() => {
    if (!character || !previewOpponent) return null;
    return getTacticalHint(character, previewOpponent);
  }, [character, previewOpponent]);

  useEffect(() => {
    if (pveMode || isOfflineMode || !character || hasPendingFight || autoMode || combatData || previewMatch || previewLoading) return;
    if (fightsLeft <= 0) return;
    if (typeof findPreviewOpponent !== 'function') return;
    let cancelled = false;
    setPreviewLoading(true);
    try {
      const maybePromise = findPreviewOpponent();
      if (!maybePromise || typeof (maybePromise as Promise<unknown>).then !== 'function') {
        setPreviewLoading(false);
        return;
      }
      (maybePromise as Promise<MatchmakingResult | null>)
        .then((match) => {
          if (!cancelled && match?.opponent) setPreviewMatch(match);
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
  }, [pveMode, isOfflineMode, character, hasPendingFight, autoMode, combatData, previewMatch, previewLoading, fightsLeft, findPreviewOpponent]);

  const actionPanelProps = useMemo(() => ({
    pveMode,
    canFight,
    matchmaking,
    hasPendingFight,
    autoMode,
    isOfflineMode,
    fightsLeft,
    effectiveMaxFights,
    burstActive,
    draftOptions,
    selectedMutator: burstMutator,
    onSelectMutator: selectMutator,
    bossAttacksLeft: effectiveAttacksLeft,
    bossUnlocked: effectiveUnlocked,
    bossHp: effectiveBossProgress?.bossHp ?? 0,
    bossMaxHp: effectiveBossProgress?.bossMaxHp ?? 0,
    bossLevel: effectiveBossProgress?.bossLevel ?? 0,
    bossPityStacks: effectivePityStacks,
    bossPityReduction: effectivePityReduction,
    bossId: effectiveBossId,
    abyssalUnlocked,
    onTogglePve,
    onTogglePvp,
    onFight,
    tacticalOpponent: previewOpponent,
    tacticalHint,
    previewLoading,
  }), [
    autoMode,
    burstActive,
    burstMutator,
    draftOptions,
    effectiveAttacksLeft,
    effectiveBossProgress?.bossHp,
    effectiveBossProgress?.bossMaxHp,
    effectiveBossProgress?.bossLevel,
    effectiveMaxFights,
    effectivePityStacks,
    effectivePityReduction,
    effectiveUnlocked,
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
    selectMutator,
    tacticalHint,
    effectiveBossId,
    abyssalUnlocked,
  ] as any);

  return {
    mode,
    pveMode,
    matchmaking,
    combatData,
    pveMonster,
    fightsLeft,
    effectiveMaxFights,
    burstActive,
    idlePaused,
    draftOptions,
    selectedMutator: burstMutator,
    selectMutator,
    hasPendingFight,
    autoMode,
    canFight,
    bossUnlocked,
    bossAttacksLeft: effectiveAttacksLeft,
    bossProgress: effectiveBossProgress,
    bossPityStacks: effectivePityStacks,
    bossPityReduction: effectivePityReduction,
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
