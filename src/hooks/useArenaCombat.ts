import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MonsterId } from '../data/monsterAssets';
import { ABYSSAL_BOSS_ID, BOSS_ID, STONE_BOSS_ID, BossId } from '../data/bossAssets';
import { Character } from '../types/Character';
import { MatchmakingResult } from '../utils/matchmakingUtils';
import { getTacticalHint } from '../utils/tacticalLens';
import { getEquippedItems, getInventoryItems } from '../utils/equipmentUtils';
import { isBurstActive, getMaxDailyFights, isBurstBonusUsed, markBurstBonusUsed, getEffectiveFightsLeft } from '../data/liveOps';
import { BURST_MUTATORS, getStoredBurstMutator, setStoredBurstMutator } from '../utils/burstMutator';
import type { BurstMutatorId } from '../utils/burstMutator';
import type { ArenaMode } from '../components/arena/arenaTypes';
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
  options?: { opponentLevel?: number },
) => Promise<FightResult | null>;

type UseBossFight = (
  won: boolean,
  xpGained: number,
  bossName: string,
  options?: { consumeEnergy?: boolean; characterOverride?: Character; bossHpLeft?: number; bossId?: BossId },
) => Promise<FightResult | null>;

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
  /** Salvage d'un id d'objet — utilisé par le salvage auto des équipements
   *  inutilisés en mode auto ([1387]). */
  salvageItems?: (itemId: string) => Promise<Character | null>;
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
  salvageItems,
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

  const previewOpponent = previewMatch?.opponent ?? null;

  const burstActive = isBurstActive();
  const maxDailyFights = getMaxDailyFights();
  const baseFightsLeft = character?.fightsLeft ?? 0;
  const effectiveFightsLeft = getEffectiveFightsLeft(baseFightsLeft);
  const fightsLeft = effectiveFightsLeft;
  const [burstMutator, setBurstMutator] = useState<BurstMutatorId | null>(() => getStoredBurstMutator());
  const [draftChoices, setDraftChoices] = useState<BurstMutatorId[] | null>(null);
  const canPickMutator = burstActive && !!character && draftChoices !== null;
  const bossProgress = character?.bossProgress
    ? ensureBossDailyReset(character.bossProgress)
    : null;
  const bossAttacksLeft = getBossAttacksLeft(character?.bossProgress);
  const bossUnlocked = !!character && isBossUnlocked(character.level);

  const stoneRaw = character ? getBossProgressForId(character, STONE_BOSS_ID) : undefined;
  const stoneProgress = stoneRaw ? ensureBossDailyReset(stoneRaw) : null;
  const stoneAttacksLeft = getBossAttacksLeft(stoneRaw as any);
  const stoneUnlocked = !!character && isBossUnlockedForCharacter(character, STONE_BOSS_ID);
  const stoneKills = stoneProgress?.totalKills ?? 0;

  const abyssalRaw = character ? (getBossProgressForId(character, ABYSSAL_BOSS_ID) ?? (character as any).abyssalBossProgress) : undefined;
  const abyssalProgress = abyssalRaw ? ensureBossDailyReset(abyssalRaw) : null;
  const abyssalAttacksLeft = getBossAttacksLeft(abyssalRaw as any);
  const abyssalUnlocked = !!character && isBossUnlockedForCharacter(character, ABYSSAL_BOSS_ID);
  const voidTitanKills = bossProgress?.totalKills ?? character?.bossProgress?.totalKills ?? 0;

  const stoneBossVisible = voidTitanKills > 0;
  const abyssalBossVisible = stoneKills > 0;
  const nextBossVisible = stoneBossVisible; // compat prop: au moins un boss suivant visible

  const [selectedBossId, setSelectedBossId] = useState<BossId>(BOSS_ID);
  const bossSelectInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!character) return;
    const key = `${character.id ?? character.seed}:${stoneBossVisible}:${abyssalBossVisible}:${stoneUnlocked}:${abyssalUnlocked}`;
    if (bossSelectInitRef.current === key) return;
    bossSelectInitRef.current = key;
    if (abyssalUnlocked || abyssalBossVisible) setSelectedBossId(ABYSSAL_BOSS_ID);
    else if (stoneUnlocked || stoneBossVisible) setSelectedBossId(STONE_BOSS_ID);
    else setSelectedBossId(BOSS_ID);
  }, [character?.id, character?.seed, stoneBossVisible, abyssalBossVisible, stoneUnlocked, abyssalUnlocked]);

  const effectiveBossId: BossId =
    selectedBossId === ABYSSAL_BOSS_ID && abyssalBossVisible ? ABYSSAL_BOSS_ID
    : selectedBossId === STONE_BOSS_ID && stoneBossVisible ? STONE_BOSS_ID
    : BOSS_ID;
  const effectiveBossProgress = effectiveBossId === ABYSSAL_BOSS_ID ? abyssalProgress
    : effectiveBossId === STONE_BOSS_ID ? stoneProgress
    : bossProgress;
  const effectiveAttacksLeft = effectiveBossId === ABYSSAL_BOSS_ID ? abyssalAttacksLeft
    : effectiveBossId === STONE_BOSS_ID ? stoneAttacksLeft
    : bossAttacksLeft;
  const effectiveUnlocked = effectiveBossId === ABYSSAL_BOSS_ID ? abyssalUnlocked
    : effectiveBossId === STONE_BOSS_ID ? stoneUnlocked
    : bossUnlocked;
  const effectivePityReduction = getBossPityReductionPct(effectiveBossProgress ?? undefined, effectiveBossId);
  const effectivePityStacks = effectiveBossProgress?.pityStacks ?? 0;

  const hasPendingFight = !!character?.pendingFight;
  const autoMode = !!character?.autoMode;

  const pveMode = mode === 'pve' || mode === 'boss';
  const bossMode = mode === 'boss';

  const canFight = !!character
    && !isOfflineMode
    && !hasPendingFight
    && !autoMode
    && (bossMode
      ? effectiveUnlocked && effectiveAttacksLeft > 0
      : mode === 'pvp' && fightsLeft > 0);

  const onModeChange = useCallback((next: ArenaMode) => {
    setMode(next);
    setPreviewMatch(null);
    setPreviewLoading(false);
  }, []);

  const onSelectBoss = useCallback((bossId: BossId) => {
    if (bossId === STONE_BOSS_ID && !stoneBossVisible) return;
    if (bossId === ABYSSAL_BOSS_ID && !abyssalBossVisible) return;
    setSelectedBossId(bossId);
  }, [stoneBossVisible, abyssalBossVisible]);

  const onFight = useCallback(async () => {
    if (!character || matchmaking || hasPendingFight || character.autoMode) return;
    const canProceed = await ensureConnection(connectionMessage);
    if (!canProceed) return;

    if (window.navigator.vibrate) window.navigator.vibrate(80);

    if (bossMode) {
      try {
        const bossId = effectiveBossId;
        const existing = bossId === ABYSSAL_BOSS_ID
          ? (getBossProgressForId(character, ABYSSAL_BOSS_ID) ?? (character as any).abyssalBossProgress)
          : bossId === STONE_BOSS_ID
            ? getBossProgressForId(character, STONE_BOSS_ID)
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
    bossMode,
    effectiveBossId,
    startMatchmaking,
  ]);

  const pickBurstMutator = useCallback((id: BurstMutatorId) => {
    setStoredBurstMutator(id);
    setBurstMutator(id);
    setDraftChoices(null);
  }, []);

  const openBurstDraft = useCallback(() => {
    if (!burstActive) return;
    const ids = BURST_MUTATORS.map(m => m.id);
    const shuffled = [...ids].sort(() => Math.random() - 0.5).slice(0, 3);
    setDraftChoices(shuffled.length === 3 ? shuffled : ids);
  }, [burstActive]);

  const onCombatComplete = useCallback(async (
    won: boolean,
    xpGained: number,
    bossHpLeft?: number,
  ) => {
    try {
      const wasBonusFight = burstActive && baseFightsLeft === 0 && !isBurstBonusUsed();
      const opponentName = combatData?.opponent.name ?? 'UNKNOWN';
      const bossIdForFight = (pveMonster?.monsterId as BossId) ?? effectiveBossId;
      /* eslint-disable react-hooks/rules-of-hooks -- callbacks, not hooks */
      const result = combatData?.matchType === 'boss'
        ? await useBossFight(won, xpGained, opponentName, {
            bossHpLeft: bossHpLeft ?? combatData.opponent.hp,
            bossId: bossIdForFight,
          })
        : await useFight(won, xpGained, opponentName, combatData?.opponent.id ?? '', {
            opponentLevel: combatData?.opponent.level,
          });
      /* eslint-enable react-hooks/rules-of-hooks */
      if (wasBonusFight) markBurstBonusUsed();
      if (burstActive && combatData?.matchType !== 'boss') {
        const ids = BURST_MUTATORS.map(m => m.id);
        const shuffled = [...ids].sort(() => Math.random() - 0.5).slice(0, 3);
        setDraftChoices(shuffled.length === 3 ? shuffled : ids);
      }
      if (result?.leveledUp) {
        onLevelUp(result.levelsGained, result.newLevel);
      }
    } catch (error: unknown) {
      console.error('Fight result save failed:', error);
      openModal(getErrorMessage(error, connectionMessage));
    }
  }, [burstActive, baseFightsLeft, combatData, connectionMessage, onLevelUp, openModal, useBossFight, useFight, pveMonster, effectiveBossId, mode, bossMode, onModeChange]);

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
    if (mode !== 'pvp' || isOfflineMode || !character || hasPendingFight || autoMode || combatData || previewMatch || previewLoading) return;
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
  }, [mode, isOfflineMode, character, hasPendingFight, autoMode, combatData, previewMatch, previewLoading, fightsLeft, findPreviewOpponent]);

  // Auto mode — salvage l'équipement que le personnage n'utilise plus (#1387).
  // GARDE-FOU ANTI-FREEZE : le timer ne redémarre PAS à chaque changement du
  // personnage (un salvage le modifie → effet rejoué → salvage infini). Le
  // personnage est lu via une ref, l'effet ne dépend que de l'auto-mode.
  const salvageCharRef = useRef(character);
  useEffect(() => { salvageCharRef.current = character; }, [character]);
  useEffect(() => {
    if (!autoMode || isOfflineMode || !salvageItems) return;
    const tick = async () => {
      const char = salvageCharRef.current;
      if (!char || char.autoMode !== true) return;
      try {
        const equippedIds = new Set(getEquippedItems(char).map((item) => item.id));
        const bag = getInventoryItems(char)
          .filter((item) => !equippedIds.has(item.id))
          .slice(0, 2);
        for (const item of bag) await salvageItems(item.id);
      } catch { /* best-effort — l'auto-salvage ne doit jamais bloquer */ }
    };
    const timer = setInterval(tick, 20000);
    return () => clearInterval(timer);
  }, [autoMode, isOfflineMode, salvageItems]);

  const actionPanelProps = useMemo(() => ({
    mode,
    pveMode: mode === 'pve',
    canFight,
    matchmaking,
    hasPendingFight,
    autoMode,
    isOfflineMode,
    fightsLeft,
    onFight,
    onModeChange,
    tacticalOpponent: previewOpponent,
    tacticalHint,
  }), [
    autoMode,
    canFight,
    fightsLeft,
    hasPendingFight,
    isOfflineMode,
    matchmaking,
    mode,
    onFight,
    onModeChange,
    previewOpponent,
    tacticalHint,
  ]);

  const bossScreenProps = useMemo(() => ({
    mode,
    onModeChange,
    bossId: effectiveBossId,
    bossProgress: effectiveBossProgress,
    bossUnlocked: effectiveUnlocked,
    attacksLeft: effectiveAttacksLeft,
    canFight,
    onFight,
    matchmaking,
    hasPendingFight,
    autoMode,
    isOfflineMode,
    nextBossVisible,
    stoneBossVisible,
    abyssalBossVisible,
    stoneUnlocked,
    abyssalUnlocked,
    voidTitanKills,
    stoneKills,
    selectedBossId: effectiveBossId,
    onSelectBoss,
  }), [
    abyssalBossVisible,
    abyssalUnlocked,
    autoMode,
    canFight,
    effectiveAttacksLeft,
    effectiveBossId,
    effectiveBossProgress,
    effectiveUnlocked,
    hasPendingFight,
    isOfflineMode,
    matchmaking,
    mode,
    nextBossVisible,
    onFight,
    onModeChange,
    onSelectBoss,
    stoneBossVisible,
    stoneKills,
    stoneUnlocked,
    voidTitanKills,
  ]);

  return {
    mode,
    pveMode,
    matchmaking,
    combatData,
    pveMonster,
    fightsLeft,
    maxDailyFights,
    burstActive,
    burstMutator,
    draftChoices,
    canPickMutator,
    pickBurstMutator,
    openBurstDraft,
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
    onFight,
    onCombatComplete,
    onCloseCombat,
    actionPanelProps,
    bossScreenProps,
  };
};
