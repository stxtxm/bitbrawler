import { useCallback, useMemo, useState } from 'react';
import { GAME_RULES } from '../config/gameRules';
import { MonsterId } from '../data/monsterAssets';
import { Character } from '../types/Character';
import { MatchmakingResult } from '../utils/matchmakingUtils';
import { generateMonsterForPlayer, getMonsterDef } from '../utils/monsterUtils';

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

type UsePveFight = (
  won: boolean,
  xpGained: number,
  monsterName: string,
  options?: { consumeEnergy?: boolean; characterOverride?: Character; monsterId?: string },
) => Promise<FightResult | null>;

interface UseArenaCombatOptions {
  character: Character | null;
  isOfflineMode: boolean;
  connectionMessage: string;
  ensureConnection: (message: string) => Promise<boolean>;
  openModal: (message: string) => void;
  startMatchmaking: () => Promise<MatchmakingResult | null>;
  useFight: UseFight;
  usePveFight: UsePveFight;
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
  usePveFight,
  onLevelUp,
}: UseArenaCombatOptions) => {
  const [pveMode, setPveMode] = useState(true);
  const [matchmaking, setMatchmaking] = useState(false);
  const [combatData, setCombatData] = useState<MatchmakingResult | null>(null);
  const [pveMonster, setPveMonster] = useState<{ monsterId: MonsterId; monsterDef: ReturnType<typeof getMonsterDef> } | null>(null);

  const fightsLeft = character?.fightsLeft ?? 0;
  const pveFightsLeft = character?.pveFightsLeft ?? 5;
  const hasPendingFight = !!character?.pendingFight;
  const autoMode = !!character?.autoMode;
  const canFight = !!character
    && !isOfflineMode
    && !hasPendingFight
    && !autoMode
    && (pveMode ? pveFightsLeft > 0 : fightsLeft > 0);

  const onTogglePve = useCallback(() => setPveMode(true), []);
  const onTogglePvp = useCallback(() => setPveMode(false), []);

  const onFight = useCallback(async () => {
    if (!character || matchmaking || hasPendingFight || character.autoMode) return;
    const canProceed = await ensureConnection(connectionMessage);
    if (!canProceed) return;

    if (window.navigator.vibrate) window.navigator.vibrate(80);

    if (pveMode) {
      setMatchmaking(true);
      try {
        const { character: monsterCharacter, def } = generateMonsterForPlayer(character.level);
        setPveMonster({ monsterId: def.id, monsterDef: def });
        setCombatData({ opponent: monsterCharacter, matchType: 'pve', candidates: [] });
      } catch (error: unknown) {
        console.error('Monster generation failed:', error);
        openModal(connectionMessage);
      } finally {
        setMatchmaking(false);
      }
      return;
    }

    setMatchmaking(true);
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

  const onCombatComplete = useCallback(async (won: boolean, xpGained: number) => {
    try {
      const opponentName = combatData?.opponent.name ?? 'UNKNOWN';
      /* eslint-disable react-hooks/rules-of-hooks -- usePveFight/useFight are plain callbacks, not hooks */
      const result = combatData?.matchType === 'pve'
        ? await usePveFight(won, Math.round(xpGained * GAME_RULES.PVE.XP_MODIFIER), opponentName, { monsterId: pveMonster?.monsterId })
        : await useFight(won, xpGained, opponentName, combatData?.opponent.id ?? '');

      // Log PvE XP metrics for QA analysis — trace pre-modifier vs post-modifier values
      if (combatData?.matchType === 'pve') {
        const modifiedXp = Math.round(xpGained * GAME_RULES.PVE.XP_MODIFIER);
        console.warn(
          `[PvE XP] won=${won} beforeModifier=${xpGained} afterModifier=${modifiedXp} ` +
          `modifier=${GAME_RULES.PVE.XP_MODIFIER}`
        );
      }
      /* eslint-enable react-hooks/rules-of-hooks */

      if (result?.leveledUp) {
        onLevelUp(result.levelsGained, result.newLevel);
      }
    } catch (error: unknown) {
      console.error('Fight result save failed:', error);
      openModal(getErrorMessage(error, connectionMessage));
    }
  }, [combatData, connectionMessage, onLevelUp, openModal, useFight, usePveFight]);

  const onCloseCombat = useCallback(() => {
    setCombatData(null);
    setPveMonster(null);
  }, []);

  const actionPanelProps = useMemo(() => ({
    pveMode,
    canFight,
    matchmaking,
    hasPendingFight,
    autoMode,
    isOfflineMode,
    fightsLeft,
    pveFightsLeft,
    onTogglePve,
    onTogglePvp,
    onFight,
  }), [
    autoMode,
    canFight,
    fightsLeft,
    pveFightsLeft,
    hasPendingFight,
    isOfflineMode,
    matchmaking,
    onFight,
    onTogglePve,
    onTogglePvp,
    pveMode,
  ]);

  return {
    pveMode,
    matchmaking,
    combatData,
    pveMonster,
    fightsLeft,
    hasPendingFight,
    autoMode,
    canFight,
    onTogglePve,
    onTogglePvp,
    onFight,
    onCombatComplete,
    onCloseCombat,
    actionPanelProps,
  };
};
