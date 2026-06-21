import { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { Character, IncomingFightHistory, PendingFight } from '../types/Character';
import { gainXp, calculateFightXp } from '../utils/xpUtils';
import { applyStatPoint, autoAllocateStatPoints, HP_PER_LEVEL, StatKey } from '../utils/statUtils';
import { GAME_RULES } from '../config/gameRules';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { findOpponent, MatchmakingResult } from '../utils/matchmakingUtils';
import { ITEM_ASSETS } from '../data/itemAssets';
import { canRollLootbox, computeNextStreak, rollLootbox } from '../utils/lootboxUtils';
import { PixelItemAsset } from '../types/Item';
import { simulateCombat } from '../utils/combatUtils';
import { convertFromSupabase, convertToSupabase } from '../utils/supabaseUtils';
import {
  INVENTORY_CAPACITY, COMBAT_LOG_HISTORY_CAP,
  normalizeCharacter, buildPendingOpponent, hydratePendingOpponent,
  clearLocalData, saveLocalData, loadLocalData,
  SyncResult,
} from '../utils/persistenceUtils';
import {
  salvageItem as forgeSalvageItem,
  performFusion,
  performUpgrade,
  canFuse,
  canUpgrade,
} from '../utils/forgeUtils';
import { ESSENCE_SOFT_CAP, FUSION_COST, UPGRADE_COST, MAX_UPGRADE_LEVEL } from '../data/forgeConstants';
import { RARITY_RANK } from '../utils/lootboxUtils';
import { useNotification } from '../hooks/useNotification';

interface GameContextType {
  activeCharacter: Character | null;
  loading: boolean;
  dbAvailable: boolean;
  lastXpGain: number | null;
  lastLevelUp: { levelsGained: number; newLevel: number; hpGained: number } | null;
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
  usePveFight: (
    won: boolean,
    xpGained: number,
    monsterName: string,
    options?: { consumeEnergy?: boolean; characterOverride?: Character }
  ) => Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null>;
  findOpponent: () => Promise<MatchmakingResult | null>;
  clearXpNotifications: () => void;
  allocateStatPoint: (stat: StatKey) => Promise<Character | null>;
  saveStatAllocations: (allocations: Partial<Record<StatKey, number>>) => Promise<Character | null>;
  saveEquipment: (char: Character) => Promise<Character | null>;
  rollLootbox: () => Promise<PixelItemAsset | null>;
  startMatchmaking: () => Promise<MatchmakingResult | null>;
  setAutoMode: (enabled: boolean) => Promise<Character | null>;
  deleteCharacter: () => Promise<boolean>;
  syncCharacterToBackend: (char: Character) => Promise<void>;
  essence: number;
  salvageItems: (itemId: string) => Promise<Character | null>;
  fuseItems: (items: PixelItemAsset[]) => Promise<{ result: PixelItemAsset | null; updatedChar: Character | null }>;
  upgradeItem: (itemId: string) => Promise<Character | null>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [lastXpGain, setLastXpGain] = useState<number | null>(null);
  const [lastLevelUp, setLastLevelUp] = useState<{ levelsGained: number; newLevel: number; hpGained: number } | null>(null);
  const isOnline = useOnlineStatus();
  const { notify } = useNotification();
  const initiatedMatchmakingRef = useRef(false);
  const persistCharacter = useCallback((character: Character) => {
    const normalized = normalizeCharacter(character);
    setActiveCharacter(normalized);
    saveLocalData(normalized);
    return normalized;
  }, []);

  // Item name helper
  const getItemName = useCallback((itemId: string): string => {
    return ITEM_ASSETS.find(a => a.id === itemId)?.name ?? itemId;
  }, []);

  // DB error handler
  const handleDbError = useCallback((error: any, context: string) => {
     console.error(`DB error (${context}):`, error);
    setDbAvailable(false);
  }, []);

  // Sync character with Supabase
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
          id: character.id
        }
      };
    } catch (error) {
      handleDbError(error, 'sync');
      return { status: 'error' };
    }
  }, [handleDbError]);

  const syncCharacterToBackend = useCallback(async (char: Character) => {
    if (!char.id) return;
    try {
      const { error } = await supabase
        .from('characters')
        .update(convertToSupabase(char))
        .eq('id', char.id);
      if (error) throw error;
    } catch (error: any) {
      handleDbError(error, 'sync-character');
    }
  }, [handleDbError]);

  // Load character on mount
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
        // Keep the character with the most XP — handles the case where
        // the last idle sync didn't complete before page unload
        const serverChar = syncResult.character;
        const hasMoreXp = (localChar.experience ?? 0) > (serverChar.experience ?? 0);
        const bestChar = hasMoreXp ? localChar : serverChar;
        const normalized = normalizeCharacter(bestChar);
        persistCharacter(normalized);
        setDbAvailable(true);
        // If local had more XP, sync it back to Supabase
        if (hasMoreXp) {
          syncCharacterToBackend(normalized);
        }
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
  }, [isOnline, persistCharacter, syncCharacterWithSupabase, syncCharacterToBackend]);


  // Characters are now reset centrally via GitHub Actions every 24h.
  // The frontend syncs the state on mount/login.

  // Login function
  const login = useCallback(async (name: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('name', name)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return "Fighter not found!";
        }
        throw error;
      }

      if (!data) {
        return "Fighter not found!";
      }

      const fullChar = normalizeCharacter({
        ...convertFromSupabase(data),
        id: data.id
      });

      persistCharacter(fullChar);
      setDbAvailable(true);
      return null;
    } catch (error) {
      handleDbError(error, 'login');
      return "Connection error - please check your internet connection and try again";
    }
  }, [handleDbError, persistCharacter]);

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
        setDbAvailable(false);
        return false;
      }
      // Check Supabase connection by fetching server time
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

  const appendIncomingFightHistory = useCallback(async (
    targetCharacterId: string,
    entry: IncomingFightHistory
  ) => {
    try {
      // Get current history
      const { data, error } = await supabase
        .from('characters')
        .select('incoming_fight_history')
        .eq('id', targetCharacterId)
        .single();

      if (error || !data) return;

      const existing = Array.isArray(data.incoming_fight_history) ? data.incoming_fight_history : [];
      const nextHistory = [entry, ...existing].slice(0, COMBAT_LOG_HISTORY_CAP);

      // Update with new history
      await supabase
        .from('characters')
        .update({ incoming_fight_history: nextHistory })
        .eq('id', targetCharacterId);
    } catch (error) {
      console.warn('Failed to append incoming fight history:', error);
    }
  }, []);

  const useFight = useCallback(async (
    won: boolean,
    xpGained: number,
    opponentName: string,
    opponentId: string,
    options?: { consumeEnergy?: boolean; characterOverride?: Character }
  ): Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null> => {
    const baseCharacter = options?.characterOverride ?? activeCharacter;
    if (!baseCharacter?.id) return null;

    // Process XP gain and level up
    const xpResult = gainXp(baseCharacter, xpGained);

    // Prepare history entry
    const historyEntry = {
      date: Date.now(),
      won,
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

    let updatedChar: Character = normalizeCharacter({
      ...xpResult.updatedCharacter,
      fightsLeft: Math.max(0, (baseCharacter.fightsLeft || 0) - (shouldConsumeEnergy ? 1 : 0)),
      wins: won ? (baseCharacter.wins || 0) + 1 : (baseCharacter.wins || 0),
      losses: won ? (baseCharacter.losses || 0) : (baseCharacter.losses || 0) + 1,
      fightHistory: newHistory,
      foughtToday: newFoughtToday,
      statPoints: existingPoints + pointsGained,
      pendingFight: undefined
    });

    // Auto-allocate stat points in auto-mode (skip UI overlay fragility)
    if (updatedChar.autoMode && (updatedChar.statPoints || 0) > 0) {
      updatedChar = normalizeCharacter(
        autoAllocateStatPoints(updatedChar, updatedChar.statPoints || 0)
      );
    }

     try {
        const { error } = await supabase
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
           strength: updatedChar.strength,
           vitality: updatedChar.vitality,
           dexterity: updatedChar.dexterity,
           luck: updatedChar.luck,
           intelligence: updatedChar.intelligence,
           focus: updatedChar.focus,
           hp: updatedChar.hp,
           max_hp: updatedChar.maxHp,
           pending_fight: null
         })
         .eq('id', baseCharacter.id!);

       if (error) throw error;

       persistCharacter(updatedChar);
       initiatedMatchmakingRef.current = false;

      if (opponentId && opponentId !== baseCharacter.id) {
        const incomingEntry: IncomingFightHistory = {
          date: Date.now(),
          attackerName: baseCharacter.name,
          attackerId: baseCharacter.id,
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
      if (xpResult.leveledUp && !updatedChar.autoMode) {
        setLastLevelUp({
          levelsGained: xpResult.levelsGained,
          newLevel: xpResult.newLevel,
          hpGained: xpResult.levelsGained * HP_PER_LEVEL,
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

      handleDbError(error, 'use-fight');
      throw new Error("Connection error - fight not counted. Please check your internet connection.");
    }
  }, [activeCharacter, appendIncomingFightHistory, handleDbError, persistCharacter]);

  const usePveFight = useCallback(async (
    won: boolean,
    xpGained: number,
    monsterName: string,
    options?: { consumeEnergy?: boolean; characterOverride?: Character }
  ): Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null> => {
    const baseCharacter = options?.characterOverride ?? activeCharacter;
    if (!baseCharacter) return null;

    const xpResult = gainXp(baseCharacter, xpGained);

    const historyEntry = { date: Date.now(), won, opponentName: monsterName };
    const existingHistory = baseCharacter.fightHistory || [];
    const newHistory = [historyEntry, ...existingHistory].slice(0, 20);

    const pointsGained = xpResult.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL;
    const existingPoints = baseCharacter.statPoints || 0;
    const shouldConsumeEnergy = options?.consumeEnergy ?? true;

    let updatedChar: Character = normalizeCharacter({
      ...xpResult.updatedCharacter,
      pveFightsLeft: Math.max(0, (baseCharacter.pveFightsLeft ?? 5) - (shouldConsumeEnergy ? 1 : 0)),
      fightsLeft: baseCharacter.fightsLeft,
      wins: won ? (baseCharacter.wins || 0) + 1 : (baseCharacter.wins || 0),
      losses: won ? (baseCharacter.losses || 0) : (baseCharacter.losses || 0) + 1,
      fightHistory: newHistory,
      statPoints: existingPoints + pointsGained,
    });

    if (updatedChar.autoMode && (updatedChar.statPoints || 0) > 0) {
      updatedChar = normalizeCharacter(
        autoAllocateStatPoints(updatedChar, updatedChar.statPoints || 0)
      );
    }

    if (baseCharacter.id) {
      try {
        const { error } = await supabase
          .from('characters')
          .update({
            pve_fights_left: updatedChar.pveFightsLeft,
            level: updatedChar.level,
            experience: updatedChar.experience,
            wins: updatedChar.wins,
            losses: updatedChar.losses,
            fight_history: updatedChar.fightHistory,
            stat_points: updatedChar.statPoints,
            strength: updatedChar.strength,
            vitality: updatedChar.vitality,
            dexterity: updatedChar.dexterity,
            luck: updatedChar.luck,
            intelligence: updatedChar.intelligence,
            focus: updatedChar.focus,
            hp: updatedChar.hp,
            max_hp: updatedChar.maxHp,
          })
          .eq('id', baseCharacter.id);

        if (error) throw error;
      } catch (error: any) {
        handleDbError(error, 'use-pve-fight');
        throw new Error("Connection error - PvE fight not saved. Please check your internet connection.");
      }
    }

    persistCharacter(updatedChar);

    setLastXpGain(xpGained);
    if (xpResult.leveledUp && !updatedChar.autoMode) {
      setLastLevelUp({
        levelsGained: xpResult.levelsGained,
        newLevel: xpResult.newLevel,
        hpGained: xpResult.levelsGained * HP_PER_LEVEL,
      });
    }

    return {
      xpGained,
      leveledUp: xpResult.leveledUp,
      levelsGained: xpResult.levelsGained,
      newLevel: xpResult.newLevel,
    };
  }, [activeCharacter, handleDbError, persistCharacter]);

  const allocateStatPoint = useCallback(async (stat: StatKey): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;
    if (!activeCharacter.statPoints || activeCharacter.statPoints <= 0) return null;

    const updatedChar = normalizeCharacter(applyStatPoint(activeCharacter, stat));

     try {
       const { error } = await supabase
        .from('characters')
        .update({
          [stat]: (updatedChar as any)[stat],
          hp: updatedChar.hp,
          max_hp: updatedChar.maxHp,
          stat_points: updatedChar.statPoints,
          focus: updatedChar.focus
        })
        .eq('id', activeCharacter.id!);

       if (error) throw error;

       persistCharacter(updatedChar);
       return updatedChar;
     } catch (error: any) {
       handleDbError(error, 'stat-allocate');
       throw new Error("Connection error - stat point not saved. Please check your internet connection.");
     }
  }, [activeCharacter, handleDbError, persistCharacter]);

  const saveStatAllocations = useCallback(async (allocations: Partial<Record<StatKey, number>>): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;

    let updatedChar = activeCharacter;
    const entries = Object.entries(allocations) as [StatKey, number][];
    for (const [stat, count] of entries) {
      for (let i = 0; i < count; i++) {
        updatedChar = applyStatPoint(updatedChar, stat);
      }
    }

    updatedChar = normalizeCharacter(updatedChar);

    try {
      const { error } = await supabase
        .from('characters')
        .update({
          strength: updatedChar.strength,
          vitality: updatedChar.vitality,
          dexterity: updatedChar.dexterity,
          luck: updatedChar.luck,
          intelligence: updatedChar.intelligence,
          focus: updatedChar.focus,
          hp: updatedChar.hp,
          max_hp: updatedChar.maxHp,
          stat_points: updatedChar.statPoints,
        })
        .eq('id', activeCharacter.id!);

      if (error) throw error;

      persistCharacter(updatedChar);
      return updatedChar;
    } catch (error: any) {
      handleDbError(error, 'stat-allocate');
      throw new Error("Connection error - stat points not saved. Please check your internet connection.");
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  const saveEquipment = useCallback(async (char: Character): Promise<Character | null> => {
    if (!char.id) return null;

    const normalized = normalizeCharacter(char);

    try {
      const { error } = await supabase
        .from('characters')
        .update({
          inventory: normalized.inventory,
          equipped_items: normalized.equippedItems,
        })
        .eq('id', char.id);

      if (error) throw error;

      persistCharacter(normalized);
      return normalized;
    } catch (error: any) {
      handleDbError(error, 'save-equipment');
      throw new Error("Connection error - equipment not saved. Please check your internet connection.");
    }
  }, [handleDbError, persistCharacter]);

  const startMatchmakingForPlayer = useCallback(async (): Promise<MatchmakingResult | null> => {
    if (!activeCharacter?.id) return null;
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
       await supabase
        .from('characters')
        .update({
          fights_left: reservedChar.fightsLeft,
          pending_fight: pending,
          focus: reservedChar.focus
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
        pendingFight: undefined
      });

       try {
         await supabase
          .from('characters')
          .update({
            fights_left: refundedChar.fightsLeft,
            pending_fight: null,
            focus: refundedChar.focus
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
      matchType: match.matchType
    };

    const matchedChar = normalizeCharacter({
      ...reservedChar,
      pendingFight: matchedPending
    });

     try {
       await supabase
        .from('characters')
        .update({
          pending_fight: matchedPending,
          focus: matchedChar.focus
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

  const resolvingPendingRef = useRef(false);

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
            pendingFight: undefined
          });
           await supabase
            .from('characters')
            .update({
              fights_left: refundedChar.fightsLeft,
              pending_fight: null,
              focus: refundedChar.focus
            })
            .eq('id', character.id);
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

         await supabase
          .from('characters')
          .update({
            pending_fight: matchedPending,
            focus: matchedChar.focus
          })
          .eq('id', character.id);
         persistCharacter(matchedChar);

        const opponent = hydratePendingOpponent(matchedPending.opponent!);
        const combatResult = simulateCombat(matchedChar, opponent);
        const won = combatResult.winner === 'attacker';
        const xpGained = calculateFightXp(won, matchedChar.level, opponent.level);
        await useFight(won, xpGained, opponent.name, opponent.id || '', {
          consumeEnergy: false,
          characterOverride: matchedChar
        });
        return;
      }

      if (pending.status === 'matched' && pending.opponent) {
        const opponent = hydratePendingOpponent(pending.opponent);
        const combatResult = simulateCombat(character, opponent);
        const won = combatResult.winner === 'attacker';
        const xpGained = calculateFightXp(won, character.level, opponent.level);
        await useFight(won, xpGained, opponent.name, opponent.id || '', {
          consumeEnergy: false,
          characterOverride: character
        });
      }
    } catch (error: any) {
      handleDbError(error, 'pending-fight');
    } finally {
      resolvingPendingRef.current = false;
    }
  }, [dbAvailable, handleDbError, persistCharacter, useFight]);

  useEffect(() => {
    if (!activeCharacter?.pendingFight) return;
    if (initiatedMatchmakingRef.current) return;
    resolvePendingFight(activeCharacter);
  }, [activeCharacter, resolvePendingFight]);

  const rollLootboxForPlayer = useCallback(async () => {
    if (!activeCharacter?.id) return null;

    const now = Date.now();
    if (!canRollLootbox(activeCharacter.lastLootRoll, now)) {
      throw new Error('Daily lootbox already opened.');
    }

    const inventory = activeCharacter.inventory || [];
    if (inventory.length >= INVENTORY_CAPACITY) {
      throw new Error('Inventory is full.');
    }

    const currentStreak = activeCharacter.lootboxStreak ?? 0;
    const newStreak = computeNextStreak(activeCharacter.lastLootRoll, currentStreak, now);

    const item = rollLootbox(ITEM_ASSETS, {
      excludeIds: inventory,
      level: activeCharacter.level,
      streak: newStreak,
    });
    if (!item) {
      throw new Error('No new loot available.');
    }

    const updatedChar = normalizeCharacter({
      ...activeCharacter,
      inventory: [...inventory, item.id],
      lastLootRoll: now,
      lootboxStreak: newStreak,
    });

     try {
       await supabase
        .from('characters')
        .update({
          inventory: updatedChar.inventory,
          last_loot_roll: updatedChar.lastLootRoll,
          lootbox_streak: updatedChar.lootboxStreak,
          focus: updatedChar.focus
        })
        .eq('id', activeCharacter.id!);
       persistCharacter(updatedChar);
       return item;
     } catch (error: any) {
       handleDbError(error, 'lootbox');
       throw new Error('Connection error - lootbox not saved.');
     }
   }, [activeCharacter, handleDbError, persistCharacter]);

  const setAutoMode = useCallback(async (enabled: boolean) => {
    if (!activeCharacter?.id) return null;
    // Auto mode makes the character functionally a bot — keep both flags in sync
    const updatedChar = normalizeCharacter({
      ...activeCharacter,
      autoMode: enabled,
      isBot: enabled,
    });

    try {
      await supabase
       .from('characters')
       .update({
         auto_mode: enabled,
         is_bot: enabled,
       })
       .eq('id', activeCharacter.id);
      persistCharacter(updatedChar);
      return updatedChar;
    } catch (error: any) {
      handleDbError(error, 'auto-mode');
      throw new Error('Connection error - auto mode not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);


  const deleteCharacter = useCallback(async () => {
    if (!activeCharacter?.id) return false;
    try {
      await supabase
       .from('characters')
       .delete()
       .eq('id', activeCharacter.id);
      logout();
      return true;
    } catch (error: any) {
      handleDbError(error, 'delete-character');
      throw new Error('Connection error - character not deleted.');
    }
  }, [activeCharacter, handleDbError, logout]);

  // ─── Forge System ──────────────────────────────────────────────────────────

  const salvageItems = useCallback(async (itemId: string): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;

    const oldEssence = activeCharacter.essence ?? 0;
    const updatedChar = forgeSalvageItem(itemId, activeCharacter, ITEM_ASSETS);
    if (updatedChar === activeCharacter) return null; // nothing changed

    const essenceGain = (updatedChar.essence ?? 0) - oldEssence;
    const normalized = normalizeCharacter(updatedChar);
    try {
      await supabase
        .from('characters')
        .update({
          inventory: normalized.inventory,
          essence: normalized.essence,
        })
        .eq('id', activeCharacter.id!);
      persistCharacter(normalized);

      const itemName = getItemName(itemId);
      notify(`Salvaged ${itemName} → ${essenceGain} Essence`, 'success');

      // Warning when approaching soft cap
      if ((normalized.essence ?? 0) > ESSENCE_SOFT_CAP - 100) {
        notify(`Essence nearing cap (${normalized.essence}/${ESSENCE_SOFT_CAP})`, 'warning');
      }

      return normalized;
    } catch (error: any) {
      handleDbError(error, 'salvage');
      throw new Error('Connection error - salvage not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter, notify, getItemName]);

  const fuseItems = useCallback(async (items: PixelItemAsset[]): Promise<{
    result: PixelItemAsset | null;
    updatedChar: Character | null;
  }> => {
    if (!activeCharacter?.id) return { result: null, updatedChar: null };

    // Pre-check for common failure modes
    if (!canFuse(items, activeCharacter)) {
      const cost = items.length > 0 ? FUSION_COST[items[0].rarity] : 0;
      if (cost > 0 && (activeCharacter.essence ?? 0) < cost) {
        notify('Not enough essence!', 'error');
      } else if ((activeCharacter.inventory?.length ?? 0) >= INVENTORY_CAPACITY) {
        notify('Inventory full!', 'error');
      }
      return { result: null, updatedChar: null };
    }

    const { result, updatedChar } = performFusion(items, activeCharacter, ITEM_ASSETS);
    if (updatedChar === activeCharacter) return { result: null, updatedChar: null };

    const normalized = normalizeCharacter(updatedChar);
    try {
      await supabase
        .from('characters')
        .update({
          inventory: normalized.inventory,
          essence: normalized.essence,
          item_upgrades: normalized.itemUpgrades,
        })
        .eq('id', activeCharacter.id!);
      persistCharacter(normalized);

      if (result) {
        const baseRarity = items[0].rarity;
        const isLucky = RARITY_RANK[result.rarity] > RARITY_RANK[baseRarity] + 1;
        const itemsStr = items.map(i => i.name).join(' + ');
        if (isLucky) {
          notify(`Lucky fusion! ${itemsStr} → ${result.name} ⭐!`, 'success');
        } else {
          notify(`Fusion successful! ${itemsStr} → ${result.name}!`, 'success');
        }
      }

      return { result, updatedChar: normalized };
    } catch (error: any) {
      handleDbError(error, 'fusion');
      throw new Error('Connection error - fusion not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter, notify]);

  const upgradeItem = useCallback(async (itemId: string): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;

    // Pre-check for common failure modes
    if (!canUpgrade(itemId, activeCharacter)) {
      const currentLevel = activeCharacter.itemUpgrades?.[itemId] ?? 0;
      if (currentLevel >= MAX_UPGRADE_LEVEL) {
        notify('Item already at max level!', 'warning');
      } else if ((activeCharacter.essence ?? 0) < UPGRADE_COST) {
        notify('Not enough essence!', 'error');
      }
      return null;
    }

    const updatedChar = performUpgrade(itemId, activeCharacter);
    if (updatedChar === activeCharacter) return null; // nothing changed

    const normalized = normalizeCharacter(updatedChar);
    try {
      await supabase
        .from('characters')
        .update({
          essence: normalized.essence,
          item_upgrades: normalized.itemUpgrades,
        })
        .eq('id', activeCharacter.id!);
      persistCharacter(normalized);

      const newLevel = normalized.itemUpgrades?.[itemId] ?? 0;
      const itemName = getItemName(itemId);
      notify(`Upgrade success! ${itemName} now +${newLevel}`, 'success');

      return normalized;
    } catch (error: any) {
      handleDbError(error, 'upgrade');
      throw new Error('Connection error - upgrade not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter, notify, getItemName]);

  // Find opponent for matchmaking
  const findOpponentForPlayer = useCallback(async (): Promise<MatchmakingResult | null> => {
    if (!activeCharacter) return null;
    return await findOpponent(activeCharacter);
  }, [activeCharacter]);

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
    usePveFight,
    findOpponent: findOpponentForPlayer,
    startMatchmaking: startMatchmakingForPlayer,
    clearXpNotifications,
    allocateStatPoint,
    saveStatAllocations,
    saveEquipment,
    rollLootbox: rollLootboxForPlayer,
    setAutoMode,
    deleteCharacter,
    syncCharacterToBackend,
    essence: activeCharacter?.essence ?? 0,
    salvageItems,
    fuseItems,
    upgradeItem,
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
