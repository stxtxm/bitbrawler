import { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, getDocsFromServer, updateDoc, doc, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Character } from '../types/Character';
import { gainXp } from '../utils/xpUtils';
import { GAME_RULES } from '../config/gameRules';
import { shouldResetDaily } from '../utils/dailyReset';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { findOpponent, MatchmakingResult } from '../utils/matchmakingUtils';

interface GameContextType {
  activeCharacter: Character | null;
  loading: boolean;
  firebaseAvailable: boolean;
  lastXpGain: number | null;
  lastLevelUp: { levelsGained: number; newLevel: number } | null;
  login: (name: string) => Promise<string | null>;
  logout: () => void;
  setCharacter: (char: Character) => void;
  retryConnection: () => Promise<boolean>;
  useFight: (won: boolean, xpGained: number, opponentName: string) => Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null>;
  findOpponent: () => Promise<MatchmakingResult | null>;
  clearXpNotifications: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// Constants
const LOCAL_STORAGE_KEY = 'bitbrawler_active_char';
const DAILY_RESET_INTERVAL = 60000; // 1 minute

// Helper functions
const clearLocalData = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
};

const saveLocalData = (character: Character) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(character));
};

const loadLocalData = (): Character | null => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    clearLocalData();
    return null;
  }
};

const getServerTime = async (): Promise<number> => {
  try {
    const serverTimeSnapshot = await getDocs(collection(db, "server_time"));
    return serverTimeSnapshot.docs[0]?.data()?.timestamp || Date.now();
  } catch {
    return Date.now();
  }
};

type SyncResult =
  | { status: 'ok'; character: Character }
  | { status: 'missing' }
  | { status: 'error' };

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseAvailable, setFirebaseAvailable] = useState(true);
  const [lastXpGain, setLastXpGain] = useState<number | null>(null);
  const [lastLevelUp, setLastLevelUp] = useState<{ levelsGained: number; newLevel: number } | null>(null);
  const isOnline = useOnlineStatus();

  // Firebase error handler
  const handleFirebaseError = useCallback((error: any, context: string) => {
    console.error(`Firebase error (${context}):`, error);
    setFirebaseAvailable(false);
  }, []);

  // Sync character with Firestore
  const syncCharacterWithFirestore = useCallback(async (character: Character): Promise<SyncResult> => {
    if (!character.firestoreId) return { status: 'missing' };

    try {
      const docSnap = await getDocs(query(collection(db, "characters"), where("__name__", "==", character.firestoreId)));
      if (docSnap.empty) {
        return { status: 'missing' };
      }

      const firestoreData = docSnap.docs[0].data() as Character;
      setFirebaseAvailable(true);
      return {
        status: 'ok',
        character: {
          ...firestoreData,
          firestoreId: character.firestoreId
        }
      };
    } catch (error) {
      handleFirebaseError(error, 'sync');
      return { status: 'error' };
    }
  }, [handleFirebaseError]);

  // Load character on mount
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
        setActiveCharacter(localChar);
        setFirebaseAvailable(false);
        setLoading(false);
        return;
      }

      const syncResult = await syncCharacterWithFirestore(localChar);
      if (syncResult.status === 'ok') {
        setActiveCharacter(syncResult.character);
        saveLocalData(syncResult.character);
        setFirebaseAvailable(true);
      } else if (syncResult.status === 'error') {
        setActiveCharacter(localChar);
        setFirebaseAvailable(false);
      } else {
        // Status is 'missing' - character has been deleted on server
        clearLocalData();
        setActiveCharacter(null);
        setFirebaseAvailable(true);
      }

      setLoading(false);
    };

    loadCharacter();
  }, [isOnline, syncCharacterWithFirestore]);

  // Daily reset check
  useEffect(() => {
    if (!activeCharacter?.firestoreId) return;
    if (!isOnline || !firebaseAvailable) return;

    const checkDailyReset = async () => {
      try {
        if (!shouldResetDaily(activeCharacter.lastFightReset)) return;

        const serverTime = await getServerTime();
        const updatedChar = {
          ...activeCharacter,
          fightsLeft: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
          lastFightReset: serverTime
        };

        await updateDoc(doc(db, "characters", activeCharacter.firestoreId!), {
          fightsLeft: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
          lastFightReset: serverTime
        });

        setActiveCharacter(updatedChar);
        saveLocalData(updatedChar);
      } catch (error) {
        handleFirebaseError(error, 'daily-reset');
      }
    };

    checkDailyReset();
    const interval = setInterval(checkDailyReset, DAILY_RESET_INTERVAL);

    return () => clearInterval(interval);
  }, [activeCharacter, firebaseAvailable, handleFirebaseError, isOnline]);

  // Login function
  const login = useCallback(async (name: string): Promise<string | null> => {
    try {
      const q = query(collection(db, "characters"), where("name", "==", name));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return "Fighter not found!";
      }

      const doc = querySnapshot.docs[0];
      const firestoreData = doc.data() as Character;
      const fullChar = {
        ...firestoreData,
        firestoreId: doc.id
      };

      setActiveCharacter(fullChar);
      saveLocalData(fullChar);
      setFirebaseAvailable(true);
      return null;
    } catch (error) {
      handleFirebaseError(error, 'login');
      return "Connection error - please check your internet connection and try again";
    }
  }, [handleFirebaseError]);

  // Logout function
  const logout = useCallback(() => {
    setActiveCharacter(null);
    clearLocalData();
  }, []);

  // Set character function
  const setCharacter = useCallback((char: Character) => {
    setActiveCharacter(char);
    saveLocalData(char);
  }, []);

  // Clear XP notifications
  const clearXpNotifications = useCallback(() => {
    setLastXpGain(null);
    setLastLevelUp(null);
  }, []);

  const retryConnection = useCallback(async (): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setFirebaseAvailable(false);
        return false;
      }
      const q = query(collection(db, "server_time"), limit(1));
      await getDocsFromServer(q);
      setFirebaseAvailable(true);
      return true;
    } catch (error) {
      console.error('Firebase retry failed:', error);
      setFirebaseAvailable(false);
      return false;
    }
  }, []);

  const useFight = useCallback(async (won: boolean, xpGained: number, opponentName: string): Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null> => {
    if (!activeCharacter?.firestoreId) return null;

    // Process XP gain and level up
    const xpResult = gainXp(activeCharacter, xpGained);

    // Prepare history entry
    const historyEntry = {
      date: Date.now(),
      won,
      xpGained,
      opponentName
    };

    // Maintain a max of 20 history entries
    const existingHistory = activeCharacter.fightHistory || [];
    const newHistory = [historyEntry, ...existingHistory].slice(0, 20);

    const updatedChar = {
      ...xpResult.updatedCharacter,
      fightsLeft: Math.max(0, (activeCharacter.fightsLeft || 0) - 1),
      wins: won ? (activeCharacter.wins || 0) + 1 : (activeCharacter.wins || 0),
      losses: won ? (activeCharacter.losses || 0) : (activeCharacter.losses || 0) + 1,
      fightHistory: newHistory
    };

    try {
      await updateDoc(doc(db, "characters", activeCharacter.firestoreId!), {
        fightsLeft: updatedChar.fightsLeft,
        level: updatedChar.level,
        experience: updatedChar.experience,
        wins: updatedChar.wins,
        losses: updatedChar.losses,
        fightHistory: updatedChar.fightHistory
      });

      setActiveCharacter(updatedChar);
      saveLocalData(updatedChar);

      // Set XP notifications
      setLastXpGain(xpGained);
      if (xpResult.leveledUp) {
        setLastLevelUp({
          levelsGained: xpResult.levelsGained,
          newLevel: xpResult.newLevel
        });
      }

      return {
        xpGained,
        leveledUp: xpResult.leveledUp,
        levelsGained: xpResult.levelsGained,
        newLevel: xpResult.newLevel
      };
    } catch (error: any) {
      // Check if character was deleted while playing
      if (error && (error.code === 'not-found' || error.message?.includes('not found'))) {
        clearLocalData();
        setActiveCharacter(null);
        throw new Error("Your character has been deleted or is no longer available.");
      }

      handleFirebaseError(error, 'use-fight');
      throw new Error("Connection error - fight not counted. Please check your internet connection.");
    }
  }, [activeCharacter, handleFirebaseError]);

  // Find opponent for matchmaking
  const findOpponentForPlayer = useCallback(async (): Promise<MatchmakingResult | null> => {
    if (!activeCharacter) return null;
    return await findOpponent(activeCharacter);
  }, [activeCharacter]);

  const value: GameContextType = {
    activeCharacter,
    loading,
    firebaseAvailable,
    lastXpGain,
    lastLevelUp,
    login,
    logout,
    setCharacter,
    retryConnection,
    useFight,
    findOpponent: findOpponentForPlayer,
    clearXpNotifications,
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
