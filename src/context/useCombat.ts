import { useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { Character, IncomingFightHistory, PendingFight } from '../types/Character';
import { gainXp } from '../utils/xpUtils';
import { findOpponent, MatchmakingResult } from '../utils/matchmakingUtils';
import { simulateCombat } from '../utils/combatUtils';
import { GAME_RULES } from '../config/gameRules';
import {
  normalizeCharacter,
  buildPendingOpponent,
  hydratePendingOpponent,
  calculatePendingFightXp,
  clearLocalData,
  COMBAT_LOG_HISTORY_CAP,
} from '../utils/persistenceUtils';

interface UseCombatDeps {
  activeCharacter: Character | null;
  persistCharacter: (character: Character) => Character;
  handleDbError: (error: any, context: string) => void;
  setLastXpGain: (value: number | null) => void;
  setLastLevelUp: (value: { levelsGained: number; newLevel: number } | null) => void;
  setActiveCharacter: (char: Character | null) => void;
  dbAvailable: boolean;
}

export const useCombat = ({
  activeCharacter,
  persistCharacter,
  handleDbError,
  setLastXpGain,
  setLastLevelUp,
  setActiveCharacter,
  dbAvailable,
}: UseCombatDeps) => {
  const initiatedMatchmakingRef = useRef(false);
  const resolvingPendingRef = useRef(false);

  // Append incoming fight history to the opponent's record
  const appendIncomingFightHistory = useCallback(async (
    targetCharacterId: string,
    entry: IncomingFightHistory
  ) => {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('incoming_fight_history')
        .eq('id', targetCharacterId)
        .single();

      if (error || !data) return;

      const existing = Array.isArray(data.incoming_fight_history) ? data.incoming_fight_history : [];
      const nextHistory = [entry, ...existing].slice(0, COMBAT_LOG_HISTORY_CAP);

      await supabase
        .from('characters')
        .update({ incoming_fight_history: nextHistory })
        .eq('id', targetCharacterId);
    } catch (error) {
      console.warn('Failed to append incoming fight history:', error);
    }
  }, []);

  // Use fight: record the result of a completed fight
  const useFight = useCallback(async (
    won: boolean,
    xpGained: number,
    opponentName: string,
    opponentId: string,
    options?: { consumeEnergy?: boolean; characterOverride?: Character }
  ): Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null> => {
    const baseCharacter = options?.characterOverride ?? activeCharacter;
    if (!baseCharacter?.id) return null;

    const xpResult = gainXp(baseCharacter, xpGained);

    const historyEntry = {
      date: Date.now(),
      won,
      opponentName
    };

    const existingHistory = baseCharacter.fightHistory || [];
    const newHistory = [historyEntry, ...existingHistory].slice(0, 20);

    const existingFoughtToday = baseCharacter.foughtToday || [];
    const newFoughtToday = Array.from(new Set([...existingFoughtToday, opponentId])).filter(id => id);

    const pointsGained = xpResult.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL;
    const existingPoints = baseCharacter.statPoints || 0;
    const shouldConsumeEnergy = options?.consumeEnergy ?? !baseCharacter.pendingFight;

    const updatedChar: Character = normalizeCharacter({
      ...xpResult.updatedCharacter,
      fightsLeft: Math.max(0, (baseCharacter.fightsLeft || 0) - (shouldConsumeEnergy ? 1 : 0)),
      wins: won ? (baseCharacter.wins || 0) + 1 : (baseCharacter.wins || 0),
      losses: won ? (baseCharacter.losses || 0) : (baseCharacter.losses || 0) + 1,
      fightHistory: newHistory,
      foughtToday: newFoughtToday,
      statPoints: existingPoints + pointsGained,
      pendingFight: undefined
    });

    try {
      await supabase
        .from('characters')
        .update({
          fights_left: updatedChar.fightsLeft,
          level: updatedChar.level,
          experience: updatedChar.experience,
          wins: updatedChar.wins,
          losses: updatedChar.losses,
          fight_history: updatedChar.fightHistory,
          fought_today: updatedChar.foughtToday,
          stat_points: updatedChar.statPoints,
          focus: updatedChar.focus,
          pending_fight: null
        })
        .eq('id', baseCharacter.id!);

      persistCharacter(updatedChar);
      initiatedMatchmakingRef.current = false;

      if (opponentId && opponentId !== baseCharacter.id) {
        const incomingEntry: IncomingFightHistory = {
          date: Date.now(),
          attackerName: baseCharacter.name,
          attackerId: baseCharacter.id,
          attackerIsBot: !!baseCharacter.isBot,
          won: !won,
          source: 'player',
        };

        appendIncomingFightHistory(opponentId, incomingEntry).catch((error) => {
          console.warn('Incoming fight history sync skipped:', error);
        });
      }

      setLastXpGain(xpGained);
      if (xpResult.leveledUp) {
        setLastLevelUp({
          levelsGained: xpResult.levelsGained,
          newLevel: xpResult.newLevel,
        });
      }

      return {
        xpGained,
        leveledUp: xpResult.leveledUp,
        levelsGained: xpResult.levelsGained,
        newLevel: xpResult.newLevel,
      };
    } catch (error: any) {
      if (error && (error.code === 'not-found' || error.message?.includes('not found'))) {
        clearLocalData();
        setActiveCharacter(null);
        throw new Error('Your character has been deleted or is no longer available.');
      }

      handleDbError(error, 'use-fight');
      throw new Error('Connection error - fight not counted. Please check your internet connection.');
    }
  }, [activeCharacter, appendIncomingFightHistory, handleDbError, persistCharacter, setActiveCharacter, setLastLevelUp, setLastXpGain]);

  // Start matchmaking for the current player
  const startMatchmaking = useCallback(async (): Promise<MatchmakingResult | null> => {
    if (!activeCharacter?.id) return null;
    if ((activeCharacter.fightsLeft || 0) <= 0) return null;
    if (activeCharacter.pendingFight) {
      throw new Error('Match already in progress.');
    }
    initiatedMatchmakingRef.current = true;

    const pending: PendingFight = {
      status: 'searching',
      startedAt: Date.now(),
    };

    const reservedChar = normalizeCharacter({
      ...activeCharacter,
      fightsLeft: Math.max(0, (activeCharacter.fightsLeft || 0) - 1),
      pendingFight: pending,
    });

    try {
      await supabase
        .from('characters')
        .update({
          fights_left: reservedChar.fightsLeft,
          pending_fight: pending,
          focus: reservedChar.focus,
        })
        .eq('id', activeCharacter.id!);
      persistCharacter(reservedChar);
    } catch (error: any) {
      handleDbError(error, 'matchmaking-start');
      initiatedMatchmakingRef.current = false;
      throw new Error('Connection error - matchmaking not saved.');
    }

    const match = await findOpponent(reservedChar);
    if (!match) {
      const refundedChar = normalizeCharacter({
        ...reservedChar,
        fightsLeft: (reservedChar.fightsLeft || 0) + 1,
        pendingFight: undefined,
      });

      try {
        await supabase
          .from('characters')
          .update({
            fights_left: refundedChar.fightsLeft,
            pending_fight: null,
            focus: refundedChar.focus,
          })
          .eq('id', activeCharacter.id!);
      } catch (error: any) {
        handleDbError(error, 'matchmaking-refund');
      }

      persistCharacter(refundedChar);
      initiatedMatchmakingRef.current = false;
      return null;
    }

    const matchedPending: PendingFight = {
      status: 'matched',
      startedAt: pending.startedAt,
      opponent: buildPendingOpponent(match.opponent),
      matchType: match.matchType,
    };

    const matchedChar = normalizeCharacter({
      ...reservedChar,
      pendingFight: matchedPending,
    });

    try {
      await supabase
        .from('characters')
        .update({
          pending_fight: matchedPending,
          focus: matchedChar.focus,
        })
        .eq('id', activeCharacter.id!);
      persistCharacter(matchedChar);
    } catch (error: any) {
      handleDbError(error, 'matchmaking-lock');
      initiatedMatchmakingRef.current = false;
      throw new Error('Connection error - matchmaking not saved.');
    }

    return match;
  }, [activeCharacter, handleDbError, persistCharacter]);

  // Find opponent (read-only wrapper)
  const findOpponentForPlayer = useCallback(async (): Promise<MatchmakingResult | null> => {
    if (!activeCharacter) return null;
    return await findOpponent(activeCharacter);
  }, [activeCharacter]);

  // Resolve a pending fight (reconnect recovery)
  const resolvePendingFight = useCallback(async (character: Character) => {
    if (!character.id) return;
    if (!character.pendingFight) return;
    if (resolvingPendingRef.current) return;
    if (!dbAvailable) return;

    resolvingPendingRef.current = true;
    try {
      const pending = character.pendingFight;

      if (pending.status === 'searching') {
        const match = await findOpponent(character);
        if (!match) {
          const refundedChar = normalizeCharacter({
            ...character,
            fightsLeft: (character.fightsLeft || 0) + 1,
            pendingFight: undefined,
          });
          await supabase
            .from('characters')
            .update({
              fights_left: refundedChar.fightsLeft,
              pending_fight: null,
              focus: refundedChar.focus,
            })
            .eq('id', character.id);
          persistCharacter(refundedChar);
          return;
        }

        const matchedPending: PendingFight = {
          status: 'matched',
          startedAt: pending.startedAt,
          opponent: buildPendingOpponent(match.opponent),
          matchType: match.matchType,
        };

        const matchedChar = normalizeCharacter({
          ...character,
          pendingFight: matchedPending,
        });

        await supabase
          .from('characters')
          .update({
            pending_fight: matchedPending,
            focus: matchedChar.focus,
          })
          .eq('id', character.id);
        persistCharacter(matchedChar);

        const opponent = hydratePendingOpponent(matchedPending.opponent!);
        const combatResult = simulateCombat(matchedChar, opponent);
        const won = combatResult.winner === 'attacker';
        const xpGained = calculatePendingFightXp(matchedChar, opponent, won);
        await useFight(won, xpGained, opponent.name, opponent.id || '', {
          consumeEnergy: false,
          characterOverride: matchedChar,
        });
        return;
      }

      if (pending.status === 'matched' && pending.opponent) {
        const opponent = hydratePendingOpponent(pending.opponent);
        const combatResult = simulateCombat(character, opponent);
        const won = combatResult.winner === 'attacker';
        const xpGained = calculatePendingFightXp(character, opponent, won);
        await useFight(won, xpGained, opponent.name, opponent.id || '', {
          consumeEnergy: false,
          characterOverride: character,
        });
      }
    } catch (error: any) {
      handleDbError(error, 'pending-fight');
    } finally {
      resolvingPendingRef.current = false;
    }
  }, [dbAvailable, handleDbError, persistCharacter, useFight]);

  return {
    useFight,
    startMatchmaking,
    findOpponent: findOpponentForPlayer,
    resolvePendingFight,
    initiatedMatchmakingRef,
    resolvingPendingRef,
  };
};
