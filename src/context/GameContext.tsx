import { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, getDocsFromServer, updateDoc, doc, limit, deleteField, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Character, IncomingFightHistory, PendingFight, PendingFightOpponent } from '../types/Character';
import { gainXp } from '../utils/xpUtils';
import { applyStatPoint, StatKey } from '../utils/statUtils';
import { GAME_RULES } from '../config/gameRules';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { findOpponent, MatchmakingResult } from '../utils/matchmakingUtils';
import { ITEM_ASSETS } from '../data/itemAssets';
import { canRollLootbox, rollLootbox } from '../utils/lootboxUtils';
import { PixelItemAsset } from '../types/Item';
import { simulateCombat } from '../utils/combatUtils';

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

// Constants
const LOCAL_STORAGE_KEY = 'bitbrawler_active_char';
const INVENTORY_CAPACITY = 24;
const COMBAT_LOG_HISTORY_CAP = 20;

const normalizeCharacter = (character: Character): Character => {
  return {
    ...character,
    focus: character.focus ?? GAME_RULES.STATS.BASE_VALUE,
    statPoints: character.statPoints ?? 0,
    inventory: character.inventory ?? [],
    lastLootRoll: character.lastLootRoll ?? 0,
    incomingFightHistory: character.incomingFightHistory ?? [],
  };
};

const buildPendingOpponent = (opponent: Character): PendingFightOpponent => {
  const base: PendingFightOpponent = {
    name: opponent.name,
    gender: opponent.gender,
    seed: opponent.seed,
    level: opponent.level,
    experience: opponent.experience,
    strength: opponent.strength,
    vitality: opponent.vitality,
    dexterity: opponent.dexterity,
    luck: opponent.luck,
    intelligence: opponent.intelligence,
    focus: opponent.focus ?? GAME_RULES.STATS.BASE_VALUE,
    hp: opponent.hp,
    maxHp: opponent.maxHp,
    wins: opponent.wins || 0,
    losses: opponent.losses || 0,
    fightsLeft: opponent.fightsLeft || 0,
    lastFightReset: opponent.lastFightReset || Date.now(),
    inventory: opponent.inventory ?? []
  };

  if (opponent.firestoreId) {
    base.firestoreId = opponent.firestoreId;
  }

  if (typeof opponent.isBot === 'boolean') {
    base.isBot = opponent.isBot;
  }

  return base;
};

const hydratePendingOpponent = (snapshot: PendingFightOpponent): Character => {
  return normalizeCharacter({
    seed: snapshot.seed,
    name: snapshot.name,
    gender: snapshot.gender,
    level: snapshot.level,
    experience: snapshot.experience ?? 0,
    strength: snapshot.strength,
    vitality: snapshot.vitality,
    dexterity: snapshot.dexterity,
    luck: snapshot.luck,
    intelligence: snapshot.intelligence,
    focus: snapshot.focus ?? GAME_RULES.STATS.BASE_VALUE,
    hp: snapshot.hp,
    maxHp: snapshot.maxHp,
    wins: snapshot.wins ?? 0,
    losses: snapshot.losses ?? 0,
    fightsLeft: snapshot.fightsLeft ?? 0,
    lastFightReset: snapshot.lastFightReset ?? Date.now(),
    firestoreId: snapshot.firestoreId,
    isBot: snapshot.isBot,
    inventory: snapshot.inventory ?? []
  });
};

const calculatePendingFightXp = (player: Character, opponent: Character, won: boolean): number => {
  const baseXp = won ? 50 : 20;
  return Math.round(baseXp * (1 + (opponent.level - player.level) * 0.1));
};

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
  const initiatedMatchmakingRef = useRef(false);
  const persistCharacter = useCallback((character: Character) => {
    const normalized = normalizeCharacter(character);
    setActiveCharacter(normalized);
    saveLocalData(normalized);
    return normalized;
  }, []);

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
        setActiveCharacter(normalizeCharacter(localChar));
        setFirebaseAvailable(false);
        setLoading(false);
        return;
      }

      const syncResult = await syncCharacterWithFirestore(localChar);
      if (syncResult.status === 'ok') {
        const normalized = normalizeCharacter(syncResult.character);
        persistCharacter(normalized);
        setFirebaseAvailable(true);
      } else if (syncResult.status === 'error') {
        setActiveCharacter(normalizeCharacter(localChar));
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
  }, [isOnline, persistCharacter, syncCharacterWithFirestore]);


  // Characters are now reset centrally via GitHub Actions every 24h.
  // The frontend syncs the state on mount/login.

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
      const fullChar = normalizeCharacter({
        ...firestoreData,
        firestoreId: doc.id
      });

      persistCharacter(fullChar);
      setFirebaseAvailable(true);
      return null;
    } catch (error) {
      handleFirebaseError(error, 'login');
      return "Connection error - please check your internet connection and try again";
    }
  }, [handleFirebaseError, persistCharacter]);

  // Logout function
  const logout = useCallback(() => {
    setActiveCharacter(null);
    clearLocalData();
  }, []);

  // Set character function
  const setCharacter = useCallback((char: Character) => {
    persistCharacter(char);
  }, [persistCharacter]);

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

  const appendIncomingFightHistory = useCallback(async (
    targetCharacterId: string,
    entry: IncomingFightHistory
  ) => {
    const targetRef = doc(db, 'characters', targetCharacterId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(targetRef);
      if (!snapshot.exists()) return;

      const existingRaw = snapshot.get('incomingFightHistory');
      const existing = Array.isArray(existingRaw) ? existingRaw : [];

      const nextHistory = [entry, ...existing].slice(0, COMBAT_LOG_HISTORY_CAP);
      transaction.update(targetRef, {
        incomingFightHistory: nextHistory
      });
    });
  }, []);

  const useFight = useCallback(async (
    won: boolean,
    xpGained: number,
    opponentName: string,
    opponentId: string,
    options?: { consumeEnergy?: boolean; characterOverride?: Character }
  ): Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null> => {
    const baseCharacter = options?.characterOverride ?? activeCharacter;
    if (!baseCharacter?.firestoreId) return null;

    // Process XP gain and level up
    const xpResult = gainXp(baseCharacter, xpGained);

    // Prepare history entry
    const historyEntry = {
      date: Date.now(),
      won,
      xpGained,
      opponentName
    };

    // Maintain a max of 20 history entries
    const existingHistory = baseCharacter.fightHistory || [];
    const newHistory = [historyEntry, ...existingHistory].slice(0, 20);

    // Track daily opponents
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
      await updateDoc(doc(db, "characters", baseCharacter.firestoreId!), {
        fightsLeft: updatedChar.fightsLeft,
        level: updatedChar.level,
        experience: updatedChar.experience,
        wins: updatedChar.wins,
        losses: updatedChar.losses,
        fightHistory: updatedChar.fightHistory,
        foughtToday: updatedChar.foughtToday,
        statPoints: updatedChar.statPoints,
        focus: updatedChar.focus,
        pendingFight: deleteField()
      });

      persistCharacter(updatedChar);
      initiatedMatchmakingRef.current = false;

      if (opponentId && opponentId !== baseCharacter.firestoreId) {
        const incomingEntry: IncomingFightHistory = {
          date: Date.now(),
          attackerName: baseCharacter.name,
          attackerId: baseCharacter.firestoreId,
          attackerIsBot: !!baseCharacter.isBot,
          won: !won,
          source: 'player'
        };

        appendIncomingFightHistory(opponentId, incomingEntry).catch((error) => {
          console.warn('Incoming fight history sync skipped:', error);
        });
      }

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
  }, [activeCharacter, appendIncomingFightHistory, handleFirebaseError, persistCharacter]);

  const allocateStatPoint = useCallback(async (stat: StatKey): Promise<Character | null> => {
    if (!activeCharacter?.firestoreId) return null;
    if (!activeCharacter.statPoints || activeCharacter.statPoints <= 0) return null;

    const updatedChar = normalizeCharacter(applyStatPoint(activeCharacter, stat));

    try {
      await updateDoc(doc(db, "characters", activeCharacter.firestoreId!), {
        [stat]: (updatedChar as any)[stat],
        hp: updatedChar.hp,
        maxHp: updatedChar.maxHp,
        statPoints: updatedChar.statPoints,
        focus: updatedChar.focus
      });

      persistCharacter(updatedChar);
      return updatedChar;
    } catch (error: any) {
      handleFirebaseError(error, 'stat-allocate');
      throw new Error("Connection error - stat point not saved. Please check your internet connection.");
    }
  }, [activeCharacter, handleFirebaseError, persistCharacter]);

  const startMatchmakingForPlayer = useCallback(async (): Promise<MatchmakingResult | null> => {
    if (!activeCharacter?.firestoreId) return null;
    if ((activeCharacter.fightsLeft || 0) <= 0) return null;
    if (activeCharacter.pendingFight) {
      throw new Error('Match already in progress.');
    }
    initiatedMatchmakingRef.current = true;

    const pending: PendingFight = {
      status: 'searching',
      startedAt: Date.now()
    };

    const reservedChar = normalizeCharacter({
      ...activeCharacter,
      fightsLeft: Math.max(0, (activeCharacter.fightsLeft || 0) - 1),
      pendingFight: pending
    });

    try {
      await updateDoc(doc(db, "characters", activeCharacter.firestoreId!), {
        fightsLeft: reservedChar.fightsLeft,
        pendingFight: pending,
        focus: reservedChar.focus
      });
      persistCharacter(reservedChar);
    } catch (error: any) {
      handleFirebaseError(error, 'matchmaking-start');
      initiatedMatchmakingRef.current = false;
      throw new Error('Connection error - matchmaking not saved.');
    }

    const match = await findOpponent(reservedChar);
    if (!match) {
      const refundedChar = normalizeCharacter({
        ...reservedChar,
        fightsLeft: (reservedChar.fightsLeft || 0) + 1,
        pendingFight: undefined
      });

      try {
        await updateDoc(doc(db, "characters", activeCharacter.firestoreId!), {
          fightsLeft: refundedChar.fightsLeft,
          pendingFight: deleteField(),
          focus: refundedChar.focus
        });
      } catch (error: any) {
        handleFirebaseError(error, 'matchmaking-refund');
      }

      persistCharacter(refundedChar);
      initiatedMatchmakingRef.current = false;
      return null;
    }

    const matchedPending: PendingFight = {
      status: 'matched',
      startedAt: pending.startedAt,
      opponent: buildPendingOpponent(match.opponent),
      matchType: match.matchType
    };

    const matchedChar = normalizeCharacter({
      ...reservedChar,
      pendingFight: matchedPending
    });

    try {
      await updateDoc(doc(db, "characters", activeCharacter.firestoreId!), {
        pendingFight: matchedPending,
        focus: matchedChar.focus
      });
      persistCharacter(matchedChar);
    } catch (error: any) {
      handleFirebaseError(error, 'matchmaking-lock');
      initiatedMatchmakingRef.current = false;
      throw new Error('Connection error - matchmaking not saved.');
    }

    return match;
  }, [activeCharacter, handleFirebaseError, persistCharacter]);

  const resolvingPendingRef = useRef(false);

  const resolvePendingFight = useCallback(async (character: Character) => {
    if (!character.firestoreId) return;
    if (!character.pendingFight) return;
    if (resolvingPendingRef.current) return;
    if (!firebaseAvailable) return;

    resolvingPendingRef.current = true;
    try {
      const pending = character.pendingFight;

      if (pending.status === 'searching') {
        const match = await findOpponent(character);
        if (!match) {
          const refundedChar = normalizeCharacter({
            ...character,
            fightsLeft: (character.fightsLeft || 0) + 1,
            pendingFight: undefined
          });
          await updateDoc(doc(db, "characters", character.firestoreId), {
            fightsLeft: refundedChar.fightsLeft,
            pendingFight: deleteField(),
            focus: refundedChar.focus
          });
          persistCharacter(refundedChar);
          return;
        }

        const matchedPending: PendingFight = {
          status: 'matched',
          startedAt: pending.startedAt,
          opponent: buildPendingOpponent(match.opponent),
          matchType: match.matchType
        };

        const matchedChar = normalizeCharacter({
          ...character,
          pendingFight: matchedPending
        });

        await updateDoc(doc(db, "characters", character.firestoreId), {
          pendingFight: matchedPending,
          focus: matchedChar.focus
        });
        persistCharacter(matchedChar);

        const opponent = hydratePendingOpponent(matchedPending.opponent!);
        const combatResult = simulateCombat(matchedChar, opponent);
        const won = combatResult.winner === 'attacker';
        const xpGained = calculatePendingFightXp(matchedChar, opponent, won);
        await useFight(won, xpGained, opponent.name, opponent.firestoreId || '', {
          consumeEnergy: false,
          characterOverride: matchedChar
        });
        return;
      }

      if (pending.status === 'matched' && pending.opponent) {
        const opponent = hydratePendingOpponent(pending.opponent);
        const combatResult = simulateCombat(character, opponent);
        const won = combatResult.winner === 'attacker';
        const xpGained = calculatePendingFightXp(character, opponent, won);
        await useFight(won, xpGained, opponent.name, opponent.firestoreId || '', {
          consumeEnergy: false,
          characterOverride: character
        });
      }
    } catch (error: any) {
      handleFirebaseError(error, 'pending-fight');
    } finally {
      resolvingPendingRef.current = false;
    }
  }, [firebaseAvailable, handleFirebaseError, persistCharacter, useFight]);

  useEffect(() => {
    if (!activeCharacter?.pendingFight) return;
    if (initiatedMatchmakingRef.current) return;
    resolvePendingFight(activeCharacter);
  }, [activeCharacter, resolvePendingFight]);

  const rollLootboxForPlayer = useCallback(async () => {
    if (!activeCharacter?.firestoreId) return null;

    const now = Date.now();
    if (!canRollLootbox(activeCharacter.lastLootRoll, now)) {
      throw new Error('Daily lootbox already opened.');
    }

    const inventory = activeCharacter.inventory || [];
    if (inventory.length >= INVENTORY_CAPACITY) {
      throw new Error('Inventory is full.');
    }

    const item = rollLootbox(ITEM_ASSETS, { excludeIds: inventory, level: activeCharacter.level });
    if (!item) {
      throw new Error('No new loot available.');
    }

    const updatedChar = normalizeCharacter({
      ...activeCharacter,
      inventory: [...inventory, item.id],
      lastLootRoll: now,
    });

    try {
      await updateDoc(doc(db, "characters", activeCharacter.firestoreId!), {
        inventory: updatedChar.inventory,
        lastLootRoll: updatedChar.lastLootRoll,
        focus: updatedChar.focus
      });
      persistCharacter(updatedChar);
      return item;
    } catch (error: any) {
      handleFirebaseError(error, 'lootbox');
      throw new Error('Connection error - lootbox not saved.');
    }
  }, [activeCharacter, handleFirebaseError, persistCharacter]);

  const setAutoMode = useCallback(async (enabled: boolean) => {
    if (!activeCharacter?.firestoreId) return null;
    const updatedChar = normalizeCharacter({
      ...activeCharacter,
      isBot: enabled
    });

    try {
      await updateDoc(doc(db, "characters", activeCharacter.firestoreId), {
        isBot: enabled
      });
      persistCharacter(updatedChar);
      return updatedChar;
    } catch (error: any) {
      handleFirebaseError(error, 'auto-mode');
      throw new Error('Connection error - auto mode not saved.');
    }
  }, [activeCharacter, handleFirebaseError, persistCharacter]);

  const deleteCharacter = useCallback(async () => {
    if (!activeCharacter?.firestoreId) return false;
    try {
      await deleteDoc(doc(db, "characters", activeCharacter.firestoreId));
      logout();
      return true;
    } catch (error: any) {
      handleFirebaseError(error, 'delete-character');
      throw new Error('Connection error - character not deleted.');
    }
  }, [activeCharacter, handleFirebaseError, logout]);

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
    startMatchmaking: startMatchmakingForPlayer,
    clearXpNotifications,
    allocateStatPoint,
    rollLootbox: rollLootboxForPlayer,
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
