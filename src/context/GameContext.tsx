import { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { Character } from '../types/Character';
import { StatKey } from '../utils/statUtils';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { MatchmakingResult } from '../utils/matchmakingUtils';
import { PixelItemAsset } from '../types/Item';
import { convertFromSupabase } from '../utils/supabaseUtils';
import {
  normalizeCharacter,
  clearLocalData,
  saveLocalData,
  loadLocalData,
  SyncResult,
} from '../utils/persistenceUtils';
import { useCombat } from './useCombat';
import { useCharacterActions } from './useCharacterActions';

interface GameContextType {
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
  executeFight: (
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

  const persistCharacter = useCallback((character: Character) => {
    const normalized = normalizeCharacter(character);
    setActiveCharacter(normalized);
    saveLocalData(normalized);
    return normalized;
  }, []);

  // DB error handler
  const handleDbError = useCallback((error: any, context: string) => {
    console.error(`DB error (${context}):`, error);
    setDbAvailable(false);
  }, []);

  // Logout function (defined before hooks so useCharacterActions can reference it)
  const logout = useCallback(() => {
    setActiveCharacter(null);
    clearLocalData();
  }, []);

  // ── Hooks ──────────────────────────────────────────────────────────────────

  const combat = useCombat({
    activeCharacter,
    persistCharacter,
    handleDbError,
    setLastXpGain,
    setLastLevelUp,
    setActiveCharacter,
    dbAvailable,
  });

  const actions = useCharacterActions({
    activeCharacter,
    persistCharacter,
    handleDbError,
    logout,
  });

  // ── Sync character with Supabase ──────────────────────────────────────────

  const syncCharacterWithSupabase = useCallback(async (character: Character): Promise<SyncResult> => {
    if (!character.id) return { status: 'missing' };

    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', character.id)
        .single();

      if (error || !data) {
        if (error?.code === 'PGRST116') { // Not found
          return { status: 'missing' };
        }
        throw error;
      }

      const supabaseData = convertFromSupabase(data);
      setDbAvailable(true);
      return {
        status: 'ok',
        character: {
          ...supabaseData,
          id: character.id,
        },
      };
    } catch (error) {
      handleDbError(error, 'sync');
      return { status: 'error' };
    }
  }, [handleDbError]);

  // ── Load character on mount ────────────────────────────────────────────────

  useEffect(() => {
    const loadCharacter = async () => {
      const localChar = loadLocalData();
      if (!localChar) {
        setLoading(false);
        return;
      }

      if (!localChar.id) {
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
        // Status is 'missing' - character has been deleted on server
        clearLocalData();
        setActiveCharacter(null);
        setDbAvailable(true);
      }

      setLoading(false);
    };

    loadCharacter();
  }, [isOnline, persistCharacter, syncCharacterWithSupabase]);

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = useCallback(async (name: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('name', name)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return 'Fighter not found!';
        }
        throw error;
      }

      if (!data) {
        return 'Fighter not found!';
      }

      const fullChar = normalizeCharacter({
        ...convertFromSupabase(data),
        id: data.id,
      });

      persistCharacter(fullChar);
      setDbAvailable(true);
      return null;
    } catch (error) {
      handleDbError(error, 'login');
      return 'Connection error - please check your internet connection and try again';
    }
  }, [handleDbError, persistCharacter]);

  // ── Set character ──────────────────────────────────────────────────────────

  const setCharacter = useCallback((char: Character) => {
    persistCharacter(char);
  }, [persistCharacter]);

  // ── Retry connection ───────────────────────────────────────────────────────

  const retryConnection = useCallback(async (): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setDbAvailable(false);
        return false;
      }
      const { error } = await supabase
        .from('server_time')
        .select('timestamp')
        .limit(1);

      if (error) throw error;

      setDbAvailable(true);
      return true;
    } catch (error) {
      console.error('Supabase retry failed:', error);
      setDbAvailable(false);
      return false;
    }
  }, []);

  // ── Clear XP notifications ─────────────────────────────────────────────────

  const clearXpNotifications = useCallback(() => {
    setLastXpGain(null);
    setLastLevelUp(null);
  }, []);

  // ── Resolve pending fights on mount ────────────────────────────────────────

  useEffect(() => {
    if (!activeCharacter?.pendingFight) return;
    if (combat.initiatedMatchmakingRef.current) return;
    combat.resolvePendingFight(activeCharacter);
  }, [activeCharacter, combat.resolvePendingFight, combat.initiatedMatchmakingRef]);

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
    useFight: combat.useFight,
    executeFight: combat.useFight,
    findOpponent: combat.findOpponent,
    startMatchmaking: combat.startMatchmaking,
    clearXpNotifications,
    allocateStatPoint: actions.allocateStatPoint,
    rollLootbox: actions.rollLootbox,
    setAutoMode: actions.setAutoMode,
    deleteCharacter: actions.deleteCharacter,
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
