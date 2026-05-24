import { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Character } from '../types/Character';
import { StatKey } from '../utils/statUtils';
import { MatchmakingResult } from '../utils/matchmakingUtils';
import { PixelItemAsset } from '../types/Item';
import {
  normalizeCharacter,
  saveLocalData,
  clearLocalData,
  loadLocalData,
} from '../utils/persistenceUtils';
import { useAuth } from './useAuth';
import { useCombat } from './useCombat';
import { useCharacterActions } from './useCharacterActions';

export interface GameContextType {
  activeCharacter: Character | null;
  loading: boolean;
  dbAvailable: boolean;
  lastXpGain: number | null;
  lastLevelUp: { levelsGained: number; newLevel: number } | null;
  login: (name: string) => Promise<string | null>;
  logout: () => void;
  setCharacter: (char: Character) => void;
  retryConnection: () => Promise<boolean>;
  useFight: (
    won: boolean,
    xpGained: number,
    opponentName: string,
    opponentId: string,
    options?: { consumeEnergy?: boolean; characterOverride?: Character }
  ) => Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null>;
  findOpponent: () => Promise<MatchmakingResult | null>;
  clearXpNotifications: () => void;
  allocateStatPoint: (stat: StatKey) => Promise<Character | null>;
  rollLootbox: () => Promise<PixelItemAsset | null>;
  startMatchmaking: () => Promise<MatchmakingResult | null>;
  setAutoMode: (enabled: boolean) => Promise<Character | null>;
  deleteCharacter: () => Promise<boolean>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [lastXpGain, setLastXpGain] = useState<number | null>(null);
  const [lastLevelUp, setLastLevelUp] = useState<{ levelsGained: number; newLevel: number } | null>(null);
  const isOnline = useOnlineStatus();

  // ── Core shared callbacks ──────────────────────────────────────────────────
  const persistCharacter = useCallback((character: Character) => {
    const normalized = normalizeCharacter(character);
    setActiveCharacter(normalized);
    saveLocalData(normalized);
    return normalized;
  }, []);

  const handleDbError = useCallback((_error: any, _context: string) => {
    setDbAvailable(false);
  }, []);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const { login, logout, retryConnection, syncCharacterWithSupabase } = useAuth({
    persistCharacter,
    handleDbError,
    setActiveCharacter,
    setDbAvailable,
  });

  // ── Combat ─────────────────────────────────────────────────────────────────
  const {
    useFight,
    startMatchmaking,
    findOpponent,
    resolvePendingFight,
    initiatedMatchmakingRef,
  } = useCombat({
    activeCharacter,
    persistCharacter,
    handleDbError,
    setLastXpGain,
    setLastLevelUp,
    setActiveCharacter,
    dbAvailable,
  });

  // ── Character Actions ──────────────────────────────────────────────────────
  const { allocateStatPoint, rollLootbox, setAutoMode, deleteCharacter } = useCharacterActions({
    activeCharacter,
    persistCharacter,
    handleDbError,
    logout,
  });

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadCharacter = async () => {
      const localChar = loadLocalData();
      if (!localChar) {
        setLoading(false);
        return;
      }

      if (!localChar.firestoreId) {
        clearLocalData();
        setLoading(false);
        return;
      }

      if (!isOnline) {
        setActiveCharacter(normalizeCharacter(localChar));
        setDbAvailable(false);
        setLoading(false);
        return;
      }

      const syncResult = await syncCharacterWithSupabase(localChar);
      if (syncResult.status === 'ok') {
        const normalized = normalizeCharacter(syncResult.character);
        persistCharacter(normalized);
        setDbAvailable(true);
      } else if (syncResult.status === 'error') {
        setActiveCharacter(normalizeCharacter(localChar));
        setDbAvailable(false);
      } else {
        clearLocalData();
        setActiveCharacter(null);
        setDbAvailable(true);
      }

      setLoading(false);
    };

    loadCharacter();
  }, [isOnline, persistCharacter, syncCharacterWithSupabase]);

  useEffect(() => {
    if (!activeCharacter?.pendingFight) return;
    if (initiatedMatchmakingRef.current) return;
    resolvePendingFight(activeCharacter);
  }, [activeCharacter, resolvePendingFight, initiatedMatchmakingRef]);

  // ── Convenience wrappers ───────────────────────────────────────────────────
  const setCharacter = useCallback((char: Character) => {
    persistCharacter(char);
  }, [persistCharacter]);

  const clearXpNotifications = useCallback(() => {
    setLastXpGain(null);
    setLastLevelUp(null);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────
  const value: GameContextType = {
    activeCharacter,
    loading,
    dbAvailable,
    lastXpGain,
    lastLevelUp,
    login,
    logout,
    setCharacter,
    retryConnection,
    useFight,
    findOpponent,
    startMatchmaking,
    clearXpNotifications,
    allocateStatPoint,
    rollLootbox,
    setAutoMode,
    deleteCharacter,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
