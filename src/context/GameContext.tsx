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
import { ItemSlot, PixelItemAsset } from '../types/Item';
import { getItemById } from '../utils/equipmentUtils';
import { simulateCombat } from '../utils/combatUtils';
import {
  createBossProgress,
  ensureBossDailyReset,
  getBossRewards,
  resolveBossAttack,
  getBossProgressForId,
  setBossProgressForId,
} from '../utils/bossUtils';
import { ABYSSAL_BOSS_ID, BOSS_ID, BossId } from '../data/bossAssets';
import { convertFromSupabase, convertToSupabase } from '../utils/supabaseUtils';
import {
  INVENTORY_CAPACITY, COMBAT_LOG_HISTORY_CAP,
  normalizeCharacter, buildPendingOpponent, hydratePendingOpponent,
  clearLocalData, saveLocalData, loadLocalData,
  coerceMonotonicProgress,
  SyncResult,
} from '../utils/persistenceUtils';
import {
  getEssenceYield,
  performFusion,
  performUpgrade,
} from '../utils/forgeUtils';
import { buyShopOffer as buyShopOfferUtil, rerollShopOffers as rerollShopOffersUtil, type ShopOffer } from '../utils/shopUtils';
import { markOfferPurchased, markRerollUsed } from '../utils/shopStorage';
import {
  checkMedals,
  applyMedalReward,
  getDefaultMedalProgress,
} from '../utils/medalUtils';
import type { MedalDef, SpecialMedalContext } from '../utils/medalUtils';
import { usePushReminders, type PushSubscriptionUpdate } from '../hooks/usePushReminders';

interface GameContextType {
  activeCharacter: Character | null;
  loading: boolean;
  dbAvailable: boolean;
  lastXpGain: number | null;
  lastLevelUp: { levelsGained: number; newLevel: number; hpGained: number } | null;
  login: (name: string) => Promise<string | null>;
  logout: () => Promise<void>;
  setCharacter: (char: Character) => void;
  updatePushSubscription: (update: PushSubscriptionUpdate) => Promise<void>;
  retryConnection: () => Promise<boolean>;
  useFight: (
    won: boolean,
    xpGained: number,
    opponentName: string,
    opponentId: string,
    options?: { consumeEnergy?: boolean; characterOverride?: Character }
  ) => Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null>;
  useBossFight: (
    won: boolean,
    xpGained: number,
    bossName: string,
    options?: { consumeEnergy?: boolean; characterOverride?: Character; bossHpLeft?: number; bossId?: BossId }
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
  addEssence: (amount: number) => Promise<Character | null>;
  spendEssence: (amount: number) => Promise<Character | null>;
  salvageItems: (itemId: string) => Promise<Character | null>;
  fuseItems: (items: PixelItemAsset[]) => Promise<{ result: PixelItemAsset | null; updatedChar: Character | null }>;
  upgradeItem: (itemId: string) => Promise<Character | null>;
  buyShopOffer: (index: number) => Promise<Character | null>;
  rerollShopOffers: () => Promise<ShopOffer[] | null>;
  lastUnlockedMedal: MedalDef | null;
  clearMedalNotification: () => void;
  pityCount: number;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [lastXpGain, setLastXpGain] = useState<number | null>(null);
  const [lastLevelUp, setLastLevelUp] = useState<{ levelsGained: number; newLevel: number; hpGained: number } | null>(null);
  const [lastUnlockedMedal, setLastUnlockedMedal] = useState<MedalDef | null>(null);
  const [lootboxPityCount, setLootboxPityCount] = useState(0);
  const isOnline = useOnlineStatus();
  usePushReminders(activeCharacter);
  const initiatedMatchmakingRef = useRef(false);
  const charRef = useRef<Character | null>(null)
  // Timestamp of the last foreground transition — wake-up grace window for
  // network calls (Android reconnects the radio a beat after unlock).
  const lastVisibleAtRef = useRef(Date.now())
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'visible') lastVisibleAtRef.current = Date.now()
    }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, []);
  const persistCharacter = useCallback((character: Character) => {
    // Monotonic progress guard: async writers (medal checks resolving late,
    // stale merges) may carry snapshots with LOWER level/experience than the
    // current state. Persisting them regressed progression and replayed the
    // level-up FX on every kill. The higher-experience side wins as a block.
    const current = charRef.current;
    const guarded = coerceMonotonicProgress(character, current);
    const normalized = normalizeCharacter(guarded);
    charRef.current = normalized;
    setActiveCharacter(normalized);
    saveLocalData(normalized);
    return normalized;
  }, []);

  // Keep the in-memory pity counter in sync with the loaded character so it
  // survives page reloads (was previously session-only React state — bug #690).
  useEffect(() => {
    setLootboxPityCount(activeCharacter?.lootboxPityCount ?? 0);
  }, [activeCharacter]);

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

  const hasMedalChanges = (before: Character, after: Character): boolean => {
    return after.medalInventoryBonus !== before.medalInventoryBonus
      || after.medalXpBonus !== before.medalXpBonus
      || after.medalTitle !== before.medalTitle
      || after.medalAura !== before.medalAura
  }

  // ─── Debounced sync ─────────────────────────────────────────────────────
  const DEBOUNCE_SYNC_MS = 30_000
  const pendingSyncCharRef = useRef<Character | null>(null)
  const syncToBackendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cross-source guard shared by flushSyncToBackend and logout-flush:
  // level+experience must come from the SAME side (max() independently
  // creates incoherent pairs that replay burst level-ups every kill).
  const mergeWithServerProgress = useCallback((local: Character, freshRow: any): Character => {
    const localExp = local.experience ?? 0
    const serverExp = freshRow?.experience ?? 0
    const xpSource = serverExp > localExp
      ? {
          experience: serverExp,
          level: freshRow.level ?? local.level,
          hp: Math.max(local.hp ?? 0, freshRow.hp ?? 0),
          maxHp: Math.max(local.maxHp ?? 0, freshRow.max_hp ?? 0),
        }
      : {
          experience: localExp,
          level: local.level ?? 1,
          hp: local.hp ?? 0,
          maxHp: local.maxHp ?? 0,
        }
    const pickBoss = (a: any, b: any): any => {
      if (!a) return b;
      if (!b) return a;
      if ((a.totalKills ?? 0) !== (b.totalKills ?? 0)) return (a.totalKills ?? 0) > (b.totalKills ?? 0) ? a : b;
      return (a.bossHp ?? 0) < (b.bossHp ?? 0) ? a : b;
    };
    const serverBossRaw: any = freshRow?.boss_progress;
    const serverBossVoid = serverBossRaw?.bossId ? serverBossRaw : serverBossRaw?.void_titan;
    const serverAbyss = serverBossRaw?.abyssal_monarch;
    const localAny: any = local as any;
    const mergedVoid = pickBoss(localAny.bossProgress, serverBossVoid) ?? pickBoss(localAny.bossProgresses?.void_titan, serverBossVoid);
    const mergedAbyss = pickBoss(localAny.abyssalBossProgress ?? localAny.bossProgresses?.abyssal_monarch, serverAbyss);
    const mergedProgresses: any = { ...(localAny.bossProgresses ?? {}) };
    if (serverBossRaw?.void_titan || serverBossRaw?.abyssal_monarch) Object.assign(mergedProgresses, serverBossRaw);
    if (mergedVoid) mergedProgresses.void_titan = mergedVoid;
    if (mergedAbyss) mergedProgresses.abyssal_monarch = mergedAbyss;
    return normalizeCharacter({
      ...local,
      ...xpSource,
      idleStreak: Math.max(local.idleStreak ?? 0, freshRow?.idle_streak ?? 0),
      idleMaxStreak: Math.max(local.idleMaxStreak ?? 0, freshRow?.idle_max_streak ?? 0),
      idleTotalKills: Math.max(local.idleTotalKills ?? 0, freshRow?.idle_total_kills ?? 0),
      idleTotalXp: Math.max(local.idleTotalXp ?? 0, freshRow?.idle_total_xp ?? 0),
      essence: Math.max(local.essence ?? 0, freshRow?.essence ?? 0),
      statPoints: Math.max(local.statPoints ?? 0, freshRow?.stat_points ?? 0),
      bossProgress: mergedVoid ?? (local as any).bossProgress ?? undefined,
      bossProgresses: Object.keys(mergedProgresses).length > 0 ? mergedProgresses : undefined,
      abyssalBossProgress: mergedAbyss ?? (local as any).abyssalBossProgress ?? undefined,
    } as any)
  }, [])

  const flushSyncToBackend = useCallback(async () => {
    const toSync = pendingSyncCharRef.current
    pendingSyncCharRef.current = null
    syncToBackendTimeoutRef.current = null
    if (!toSync?.id) return

    const attempt = async (retriesLeft: number): Promise<void> => {
      try {
        // Cross-source guard: the idle cron may have granted XP/essence server-side
        // while this stale local snapshot sat in the queue. Never let a debounced
        // flush DOWNGRADE progress fields — take the max per field before writing.
        const { data: fresh } = await supabase
          .from('characters')
          .select('experience,level,hp,max_hp,idle_streak,idle_max_streak,idle_total_kills,idle_total_xp,essence,stat_points')
          .eq('id', toSync.id)
          .single()
        const merged = fresh ? mergeWithServerProgress(toSync, fresh) : toSync
        const { error } = await supabase
          .from('characters')
          .update(convertToSupabase(merged))
          .eq('id', toSync.id)
        if (error) throw error
      } catch (error: any) {
        // Wake-up grace: timers resumed right after unlock can fire while the
        // radio is still reconnecting — replay once before flagging offline.
        const justWoke = Date.now() - lastVisibleAtRef.current < 5000
        if (retriesLeft > 0 && justWoke && document.visibilityState === 'visible') {
          setTimeout(() => { void attempt(retriesLeft - 1) }, 2500)
          return
        }
        handleDbError(error, 'sync-character')
      }
    }

    await attempt(1)
  }, [handleDbError, mergeWithServerProgress])

  const syncCharacterToBackend = useCallback(async (char: Character) => {
    if (!char.id) return
    pendingSyncCharRef.current = char
    if (syncToBackendTimeoutRef.current === null) {
      syncToBackendTimeoutRef.current = setTimeout(() => {
        flushSyncToBackend()
      }, DEBOUNCE_SYNC_MS)
    }
  }, [flushSyncToBackend])

  // Flush pending sync when page is hidden (navigating away, closing tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushSyncToBackend()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (syncToBackendTimeoutRef.current !== null) {
        clearTimeout(syncToBackendTimeoutRef.current)
      }
    }
  }, [flushSyncToBackend])

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
        const serverChar = syncResult.character;
        const hasMoreXp = (localChar.experience ?? 0) > (serverChar.experience ?? 0);
        const bestChar = hasMoreXp ? localChar : serverChar;
        const pickBossProgress = (a: any, b: any): any => {
          if (!a) return b;
          if (!b) return a;
          if ((a.totalKills ?? 0) !== (b.totalKills ?? 0)) return (a.totalKills ?? 0) > (b.totalKills ?? 0) ? a : b;
          if ((a.bossHp ?? 0) !== (b.bossHp ?? 0)) return (a.bossHp ?? 0) < (b.bossHp ?? 0) ? a : b;
          return (a.lastAttackReset ?? 0) > (b.lastAttackReset ?? 0) ? a : b;
        };
        const anyBest: any = bestChar as any;
        const anyLocal: any = localChar as any;
        const anyServer: any = serverChar as any;
        const mergedVoid = pickBossProgress(anyLocal.bossProgress, anyServer.bossProgress) ?? pickBossProgress(anyLocal.bossProgresses?.void_titan, anyServer.bossProgresses?.void_titan);
        const mergedAbyss = pickBossProgress(anyLocal.abyssalBossProgress ?? anyLocal.bossProgresses?.abyssal_monarch, anyServer.abyssalBossProgress ?? anyServer.bossProgresses?.abyssal_monarch);
        const mergedProgresses: any = { ...(anyBest.bossProgresses ?? anyLocal.bossProgresses ?? anyServer.bossProgresses ?? {}) };
        if (mergedVoid) mergedProgresses.void_titan = mergedVoid;
        if (mergedAbyss) mergedProgresses.abyssal_monarch = mergedAbyss;
        const mergedChar: Character = {
          ...bestChar,
          bossProgress: mergedVoid ?? anyBest.bossProgress ?? anyLocal.bossProgress ?? undefined,
          bossProgresses: Object.keys(mergedProgresses).length > 0 ? mergedProgresses : undefined,
          abyssalBossProgress: mergedAbyss ?? anyBest.abyssalBossProgress ?? anyLocal.abyssalBossProgress ?? undefined,
        } as any;
        const normalized = normalizeCharacter(mergedChar);
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

  // Logout function — flush le sync debounced (médailles/idle) avant de clear, sinon l'XP reste à 0 au prochain login
  const logout = useCallback(async () => {
    const toFlush = pendingSyncCharRef.current;
    if (toFlush?.id) {
      pendingSyncCharRef.current = null;
      if (syncToBackendTimeoutRef.current !== null) {
        clearTimeout(syncToBackendTimeoutRef.current);
        syncToBackendTimeoutRef.current = null;
      }
      try {
        // Same cross-source guard as flushSyncToBackend: never downgrade
        // server-side idle/cron gains with a stale snapshot at logout.
        const { data: fresh } = await supabase
          .from('characters')
          .select('experience,level,hp,max_hp,idle_streak,idle_max_streak,idle_total_kills,idle_total_xp,essence,stat_points')
          .eq('id', toFlush.id)
          .single();
        const merged = fresh ? mergeWithServerProgress(toFlush, fresh) : toFlush;
        const { error } = await supabase.from('characters').update(convertToSupabase(merged)).eq('id', toFlush.id);
        if (error) handleDbError(error, 'logout-flush');
      } catch (e) {
        handleDbError(e, 'logout-flush');
      }
    }
    // Reset the progress-guard reference too: a NEW character created after
    // logout must never be coerced toward the previous one's level (#793 lesson).
    charRef.current = null;
    setActiveCharacter(null);
    clearLocalData();
  }, [handleDbError, mergeWithServerProgress]);

  // Set character function
  const setCharacter = useCallback((char: Character) => {
    persistCharacter(char);
  }, [persistCharacter]);

  // Update push subscription (opt-in/opt-out) and persist it
  const updatePushSubscription = useCallback(async (update: PushSubscriptionUpdate) => {
    if (!activeCharacter?.id) return;
    const updatedChar = normalizeCharacter({
      ...activeCharacter,
      pushEndpoint: update.push_endpoint ?? null,
      pushKeys: update.push_keys ?? null,
      pushSubscribed: update.push_subscribed,
    });
    persistCharacter(updatedChar);
    try {
      const { error } = await supabase
        .from('characters')
        .update(convertToSupabase(updatedChar, ['push_endpoint', 'push_keys', 'push_subscribed']))
        .eq('id', updatedChar.id);
      if (error) throw error;
    } catch (error) {
      handleDbError(error, 'push-subscription');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  // Clear XP notifications
  const clearXpNotifications = useCallback(() => {
    setLastXpGain(null);
    setLastLevelUp(null);
  }, []);

  // Clear medal notification
  const clearMedalNotification = useCallback(() => {
    setLastUnlockedMedal(null);
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

  // Non-blocking medal/achievement check.
  // Fires after a game action (fight, lootbox, forge) to check and apply medal unlocks.
  // Returns the updated character (with medal progress/rewards applied) or the original
  // character if the check fails — the main action must never be blocked by medal logic.
  const checkAndApplyMedals = useCallback(async (
    character: Character,
    extraContext?: SpecialMedalContext,
  ): Promise<Character> => {
    try {
      const currentProgress = character.medalProgress ?? getDefaultMedalProgress();
      const result = checkMedals(character, currentProgress, ITEM_ASSETS, extraContext);

      if (result.newlyUnlocked.length > 0) {
        let updatedChar: Character = { ...character, medalProgress: result.progress };
        for (const medal of result.newlyUnlocked) {
          updatedChar = applyMedalReward(updatedChar, medal.reward);
          setLastUnlockedMedal(medal);
        }
        return normalizeCharacter(updatedChar);
      }

      // Update progress even without new unlocks
      return { ...character, medalProgress: result.progress };
    } catch (error) {
      console.warn('Medal check failed (non-blocking):', error);
      return character;
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
    // Prefer charRef.current (always forced by every persistCharacter) over the
    // React state: a stale activeCharacter here would let a PvP fight write a
    // level/experience pair WITHOUT the latest idle ticks to Supabase — the
    // server idle-processor then computes its gains from that stale row and the
    // offline merge ends up combining a server level with the fresher local XP
    // (burst level-ups in the idle view, see useIdleCombat offline merge).
    const baseCharacter = options?.characterOverride ?? charRef.current ?? activeCharacter;
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
        // Clear stale debounced sync (old 0xp) that would overwrite fresh XP on next flush/logout
        pendingSyncCharRef.current = null;
        if (syncToBackendTimeoutRef.current !== null) {
          clearTimeout(syncToBackendTimeoutRef.current);
          syncToBackendTimeoutRef.current = null;
        }

       // Non-blocking medal/achievement check after PvP fight
      checkAndApplyMedals(updatedChar, {}).then(charWithMedals => {
        persistCharacter(charWithMedals);
        if (hasMedalChanges(updatedChar, charWithMedals)) {
          syncCharacterToBackend(charWithMedals).catch(() => {});
        }
      }).catch(() => {});

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



  const useBossFight = useCallback(async (
    won: boolean,
    _xpGained: number,
    bossName: string,
    options?: { consumeEnergy?: boolean; characterOverride?: Character; bossHpLeft?: number; bossId?: BossId }
  ): Promise<{ xpGained: number; leveledUp: boolean; levelsGained: number; newLevel: number } | null> => {
    const baseCharacter = options?.characterOverride ?? activeCharacter;
    if (!baseCharacter) return null;

    const now = Date.now();
    const shouldConsume = options?.consumeEnergy ?? true;
    const bossId: BossId = options?.bossId ?? (bossName === 'ABYSSAL MONARCH' ? ABYSSAL_BOSS_ID : BOSS_ID);

    // Progress starts fresh on first encounter; daily gauge refills at reset.
    const existingProgress = getBossProgressForId(baseCharacter, bossId) ?? (bossId === BOSS_ID ? baseCharacter.bossProgress : (baseCharacter as any).abyssalBossProgress);
    const baseProgress = existingProgress
      ? ensureBossDailyReset(existingProgress, now)
      : createBossProgress(baseCharacter, now, bossId);

    const rewards = getBossRewards(baseCharacter, won, baseProgress, now);
    const xpResult = gainXp(baseCharacter, won ? rewards.xpGained : 0);

    const historyEntry = { date: now, won, opponentName: bossName };
    const newHistory = [historyEntry, ...(baseCharacter.fightHistory || [])].slice(0, 20);

    const pointsGained = xpResult.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL;

    const finalBossHp = options?.bossHpLeft ?? baseProgress.bossHp;
    let updatedProgress: typeof baseProgress;
    if (shouldConsume) {
      const resolution = resolveBossAttack(
        xpResult.updatedCharacter,
        baseProgress,
        finalBossHp,
        won,
        now,
      );
      updatedProgress = resolution.progress;
    } else {
      updatedProgress = baseProgress;
    }

    let updatedChar: Character = normalizeCharacter({
      ...xpResult.updatedCharacter,
      essence: (baseCharacter.essence ?? 0) + rewards.essenceGained,
      wins: won ? (baseCharacter.wins || 0) + 1 : (baseCharacter.wins || 0),
      losses: baseCharacter.losses || 0,
      fightHistory: newHistory,
      statPoints: (baseCharacter.statPoints || 0) + pointsGained,
    } as any);
    updatedChar = setBossProgressForId(updatedChar, updatedProgress);

    if (updatedChar.autoMode && (updatedChar.statPoints || 0) > 0) {
      updatedChar = normalizeCharacter(
        autoAllocateStatPoints(updatedChar, updatedChar.statPoints || 0)
      );
    }

    if (baseCharacter.id) {
      try {
        const anyUpdated: any = updatedChar;
        let bossProgressPayload: any = null;
        if (anyUpdated.bossProgresses && Object.keys(anyUpdated.bossProgresses).length > 0) {
          const keys = Object.keys(anyUpdated.bossProgresses);
          const hasAbyssal = !!anyUpdated.bossProgresses.abyssal_monarch || !!anyUpdated.abyssalBossProgress;
          if (!hasAbyssal && keys.length === 1 && keys[0] === 'void_titan') {
            bossProgressPayload = anyUpdated.bossProgress ?? anyUpdated.bossProgresses.void_titan;
          } else {
            bossProgressPayload = { ...anyUpdated.bossProgresses };
            if (anyUpdated.abyssalBossProgress && !bossProgressPayload.abyssal_monarch) bossProgressPayload.abyssal_monarch = anyUpdated.abyssalBossProgress;
          }
        } else {
          bossProgressPayload = anyUpdated.bossProgress ?? null;
        }
        const { error } = await supabase
          .from('characters')
          .update({
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
            essence: updatedChar.essence,
            boss_progress: bossProgressPayload,
          })
          .eq('id', baseCharacter.id);

        if (error) throw error;
      } catch (error: any) {
        handleDbError(error, 'use-boss-fight');
        throw new Error("Connection error - boss fight not saved. Please check your internet connection.");
      }
    }

    persistCharacter(updatedChar);
    // Clear stale debounced sync that would overwrite fresh XP
    pendingSyncCharRef.current = null;
    if (syncToBackendTimeoutRef.current !== null) {
      clearTimeout(syncToBackendTimeoutRef.current);
      syncToBackendTimeoutRef.current = null;
    }

    setLastXpGain(won ? rewards.xpGained : 0);
    if (xpResult.leveledUp && !updatedChar.autoMode) {
      setLastLevelUp({
        levelsGained: xpResult.levelsGained,
        newLevel: xpResult.newLevel,
        hpGained: xpResult.levelsGained * HP_PER_LEVEL,
      });
    }

    return {
      xpGained: won ? rewards.xpGained : 0,
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

  // Sync idle gains before a game action.
  // Ensures offline time is processed even if the user hasn't reloaded the page.
  const syncIdleBeforeAction = useCallback(async (): Promise<void> => {
    if (!activeCharacter?.id) return
    const lastActive = activeCharacter.lastActive ?? 0
    if (lastActive <= 0) return
    if (Date.now() - lastActive <= 30_000) return

    try {
      const res = await fetch('/api/idle-processor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: activeCharacter.id }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.fights > 0 && data.updated) {
        const essenceDelta = Math.max(0, data.essence ?? 0)
        const updatedChar = normalizeCharacter({
          ...activeCharacter,
          ...data.updated,
          lastIdleCheck: Date.now(),
          lastActive: Date.now(),
          essence: (activeCharacter.essence ?? 0) + essenceDelta,
        })
        charRef.current = updatedChar
        setActiveCharacter(updatedChar)
        saveLocalData(updatedChar)
      }
    } catch {
      // silent — idle processing will happen via cron
    }
  }, [activeCharacter, normalizeCharacter])

  const startMatchmakingForPlayer = useCallback(async (): Promise<MatchmakingResult | null> => {
    if (!activeCharacter?.id) return null;
    if ((activeCharacter.fightsLeft || 0) <= 0) return null;
    if (activeCharacter.pendingFight) {
      throw new Error('Match already in progress.');
    }
    // Process idle gains before fight
    await syncIdleBeforeAction();
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

    // Process idle gains before lootbox
    await syncIdleBeforeAction();

    // Re-read latest character after sync (sync may have updated it)
    const char = charRef.current ?? activeCharacter;
    if (!char?.id) return null;

    // Re-fetch from server to get the actual last_loot_roll (cross-tab guard)
    let serverLastRoll: number | null = null;
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('last_loot_roll')
        .eq('id', char.id)
        .single();
      if (!error && data && typeof data.last_loot_roll === 'number') {
        serverLastRoll = data.last_loot_roll;
      }
    } catch {
      // Server unavailable — fall through to use local value
    }

    const effectiveLastRoll = serverLastRoll ?? char.lastLootRoll ?? null;
    const now = Date.now();
    if (!canRollLootbox(effectiveLastRoll, now)) {
      throw new Error('Daily lootbox already opened.');
    }

    const inventory = char.inventory || [];
    if (inventory.length >= INVENTORY_CAPACITY) {
      throw new Error('Inventory is full.');
    }

    const currentStreak = char.lootboxStreak ?? 0;
    const newStreak = computeNextStreak(effectiveLastRoll, currentStreak, now);

    const result = rollLootbox(ITEM_ASSETS, {
      excludeIds: inventory,
      level: char.level,
      streak: newStreak,
      pityCount: lootboxPityCount,
    });
    if (!result.item) {
      throw new Error('No new loot available.');
    }
    setLootboxPityCount(result.pityCount);

    const updatedChar = normalizeCharacter({
      ...char,
      inventory: [...inventory, result.item.id],
      lastLootRoll: now,
      lootboxStreak: newStreak,
      lootboxPityCount: result.pityCount,
    });

    try {
      // Optimistic lock: only update if last_loot_roll hasn't changed server-side
      const { data: updatedRows, error } = await supabase
        .from('characters')
        .update({
          inventory: updatedChar.inventory,
          last_loot_roll: updatedChar.lastLootRoll,
          lootbox_streak: updatedChar.lootboxStreak,
          focus: updatedChar.focus,
        })
        .eq('id', char.id)
        .eq('last_loot_roll', effectiveLastRoll ?? 0)
        .select();

      if (error) {
        handleDbError(error, 'lootbox');
        throw new Error('Connection error - lootbox not saved.');
      }

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('Daily lootbox already opened in another tab.');
      }

      persistCharacter(updatedChar);

      // Best-effort pity persistence (lootbox_pity column, migration #692).
      // Emitted via the explicit fields param only — silently ignored while the
      // column doesn't exist yet (PGRST204), so it never breaks the lootbox roll.
      Promise.resolve(
        supabase
          .from('characters')
          .update(convertToSupabase(updatedChar, ['lootbox_pity']))
          .eq('id', char.id)
      ).then(({ error: pityError }) => {
        if (pityError) {
          // Column not migrated yet (or offline) — pity stays local until then
          console.warn('lootbox_pity sync skipped:', pityError.message);
        }
      }).catch(() => {});

      // Non-blocking medal/achievement check after lootbox
      const isFirstLootbox = (char.lastLootRoll ?? 0) === 0 && newStreak > 0;
      const isEpicOrLegendary = result.item.rarity === 'epic' || result.item.rarity === 'legendary';
      const lootboxCtx: SpecialMedalContext = {
        luckyDayRoll: isFirstLootbox && isEpicOrLegendary,
      };
      checkAndApplyMedals(updatedChar, lootboxCtx).then(charWithMedals => {
        persistCharacter(charWithMedals);
        if (hasMedalChanges(updatedChar, charWithMedals)) {
          syncCharacterToBackend(charWithMedals).catch(() => {});
        }
      }).catch(() => {});

      return result.item;
    } catch (error: any) {
      if (error instanceof Error && error.message !== 'Connection error - lootbox not saved.') {
        handleDbError(error, 'lootbox');
      }
      throw error;
    }
  }, [activeCharacter, handleDbError, lootboxPityCount, persistCharacter]);

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
      await logout();
      return true;
    } catch (error: any) {
      handleDbError(error, 'delete-character');
      throw new Error('Connection error - character not deleted.');
    }
  }, [activeCharacter, handleDbError, logout]);

  // ─── Essence Management ─────────────────────────────────────────────────────

  const addEssence = useCallback(async (amount: number): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;
    if (amount <= 0) return null;

    const newEssence = (activeCharacter.essence ?? 0) + amount;
    const updatedChar = normalizeCharacter({
      ...activeCharacter,
      essence: newEssence,
    });

    try {
      await supabase
        .from('characters')
        .update({ essence: newEssence })
        .eq('id', activeCharacter.id!);
      persistCharacter(updatedChar);
      return updatedChar;
    } catch (error: any) {
      handleDbError(error, 'add-essence');
      throw new Error('Connection error - essence not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  const spendEssence = useCallback(async (amount: number): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;
    if (amount <= 0) return null;

    const currentEssence = activeCharacter.essence ?? 0;
    if (currentEssence < amount) return null;

    const newEssence = currentEssence - amount;
    const updatedChar = normalizeCharacter({
      ...activeCharacter,
      essence: newEssence,
    });

    try {
      await supabase
        .from('characters')
        .update({ essence: newEssence })
        .eq('id', activeCharacter.id!);
      persistCharacter(updatedChar);
      return updatedChar;
    } catch (error: any) {
      handleDbError(error, 'spend-essence');
      throw new Error('Connection error - essence not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  // ─── Forge System ──────────────────────────────────────────────────────────

  const salvageItems = useCallback(async (itemId: string): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;

    // Process idle gains before salvage
    await syncIdleBeforeAction();

    // Re-read freshest character: idle sync may have changed state since render
    const current = charRef.current ?? activeCharacter;

    const item = getItemById(itemId, ITEM_ASSETS);
    if (!item) return null;

    const inventory = [...(current.inventory ?? [])];
    const equipped = {
      ...(current.equippedItems ?? { weapon: null, armor: null, accessory: null }),
    };
    const invIdx = inventory.indexOf(itemId);
    const equippedSlot = (['weapon', 'armor', 'accessory'] as ItemSlot[])
      .find((s) => equipped[s] === itemId);

    // Prefer salvaging an unequipped copy from the bag: remove a single
    // occurrence and leave the equipped item untouched. Only when the item is
    // solely equipped (no spare in the bag) do we clear the slot and salvage it.
    // This prevents destroying the equipped item when an identical spare exists.
    if (invIdx !== -1) {
      inventory.splice(invIdx, 1);
    } else if (equippedSlot) {
      equipped[equippedSlot] = null;
    } else {
      return null; // nothing to salvage
    }

    const currentEssence = current.essence ?? 0;
    const newEssence = currentEssence + getEssenceYield(item);

    const normalized = normalizeCharacter({
      ...current,
      inventory,
      equippedItems: equipped,
      essence: newEssence,
    });
    try {
      await supabase
        .from('characters')
        .update({
          inventory: normalized.inventory,
          essence: normalized.essence,
          equipped_items: normalized.equippedItems,
        })
        .eq('id', activeCharacter.id!);
      persistCharacter(normalized);

      // Non-blocking medal/achievement check after salvage
      checkAndApplyMedals(normalized, {}).then(charWithMedals => {
        persistCharacter(charWithMedals);
        if (hasMedalChanges(normalized, charWithMedals)) {
          syncCharacterToBackend(charWithMedals).catch(() => {});
        }
      }).catch(() => {});

      return normalized;
    } catch (error: any) {
      handleDbError(error, 'salvage');
      throw new Error('Connection error - salvage not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  const fuseItems = useCallback(async (items: PixelItemAsset[]): Promise<{
    result: PixelItemAsset | null;
    updatedChar: Character | null;
  }> => {
    if (!activeCharacter?.id) return { result: null, updatedChar: null };

    // Process idle gains before fusion
    await syncIdleBeforeAction();

    // Re-read freshest character: idle sync may have changed state since render
    const baseChar = charRef.current ?? activeCharacter;

    const { result, updatedChar } = performFusion(items, baseChar, ITEM_ASSETS);
    if (updatedChar === baseChar) return { result: null, updatedChar: null };

    const normalized = normalizeCharacter(updatedChar);
    try {
      await supabase
        .from('characters')
        .update({
          inventory: normalized.inventory,
          essence: normalized.essence,
          item_upgrades: normalized.itemUpgrades,
        })
        .eq('id', baseChar.id!);
      persistCharacter(normalized);

      // Non-blocking medal/achievement check after fusion
      checkAndApplyMedals(normalized, {}).then(charWithMedals => {
        persistCharacter(charWithMedals);
        if (hasMedalChanges(normalized, charWithMedals)) {
          syncCharacterToBackend(charWithMedals).catch(() => {});
        }
      }).catch(() => {});

      return { result, updatedChar: normalized };
    } catch (error: any) {
      handleDbError(error, 'fusion');
      throw new Error('Connection error - fusion not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  const upgradeItem = useCallback(async (itemId: string): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;

    // Process idle gains before upgrade
    await syncIdleBeforeAction();

    // Re-read freshest character: idle sync may have changed state since render
    const baseChar = charRef.current ?? activeCharacter;

    const updatedChar = performUpgrade(itemId, baseChar);
    if (updatedChar === baseChar) return null; // nothing changed

    const normalized = normalizeCharacter(updatedChar);
    try {
      await supabase
        .from('characters')
        .update({
          essence: normalized.essence,
          item_upgrades: normalized.itemUpgrades,
        })
        .eq('id', baseChar.id!);
      persistCharacter(normalized);

      // Non-blocking medal/achievement check after upgrade
      checkAndApplyMedals(normalized, {}).then(charWithMedals => {
        persistCharacter(charWithMedals);
        if (hasMedalChanges(normalized, charWithMedals)) {
          syncCharacterToBackend(charWithMedals).catch(() => {});
        }
      }).catch(() => {});

      return normalized;
    } catch (error: any) {
      handleDbError(error, 'upgrade');
      throw new Error('Connection error - upgrade not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  const buyShopOfferAction = useCallback(async (index: number): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;

    // Process idle gains before purchase
    await syncIdleBeforeAction();

    // Re-read freshest character: idle sync may have granted essence since render
    const baseChar = charRef.current ?? activeCharacter;

    const updatedChar = buyShopOfferUtil(index, baseChar, ITEM_ASSETS);
    if (!updatedChar) return null;

    const normalized = normalizeCharacter(updatedChar);

    try {
      await supabase
        .from('characters')
        .update({
          essence: normalized.essence,
          inventory: normalized.inventory,
        })
        .eq('id', baseChar.id!);
      persistCharacter(normalized);
      // Mark sold-out ONLY after persistence succeeded — marking earlier showed
      // SOLD while a transient failure left essence/inventory untouched.
      markOfferPurchased(baseChar.id!, index, new Date().toISOString().slice(0, 10));
      // Drop any stale queued snapshot (pre-purchase essence/inventory)
      pendingSyncCharRef.current = null;
      if (syncToBackendTimeoutRef.current !== null) {
        clearTimeout(syncToBackendTimeoutRef.current);
        syncToBackendTimeoutRef.current = null;
      }

      // Non-blocking medal/achievement check
      checkAndApplyMedals(normalized, {}).then(charWithMedals => {
        persistCharacter(charWithMedals);
        if (hasMedalChanges(normalized, charWithMedals)) {
          syncCharacterToBackend(charWithMedals).catch(() => {});
        }
      }).catch(() => {});

      return normalized;
    } catch (error: any) {
      handleDbError(error, 'shop-purchase');
      throw new Error('Connection error - purchase not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  const rerollShopOffersAction = useCallback(async (): Promise<ShopOffer[] | null> => {
    if (!activeCharacter?.id) return null;

    await syncIdleBeforeAction();

    // Re-read freshest character: idle sync may have granted essence since render
    const baseChar = charRef.current ?? activeCharacter;

    const result = rerollShopOffersUtil(baseChar, ITEM_ASSETS);
    if (!result) return null;

    const normalized = normalizeCharacter(result.character);

    try {
      await supabase
        .from('characters')
        .update({
          essence: normalized.essence,
        })
        .eq('id', baseChar.id!);
      persistCharacter(normalized);
      markRerollUsed(baseChar.id!, new Date().toISOString().slice(0, 10));
      pendingSyncCharRef.current = null;
      if (syncToBackendTimeoutRef.current !== null) {
        clearTimeout(syncToBackendTimeoutRef.current);
        syncToBackendTimeoutRef.current = null;
      }

      checkAndApplyMedals(normalized, {}).then(charWithMedals => {
        persistCharacter(charWithMedals);
        if (hasMedalChanges(normalized, charWithMedals)) {
          syncCharacterToBackend(charWithMedals).catch(() => {});
        }
      }).catch(() => {});

      return result.offers;
    } catch (error: any) {
      handleDbError(error, 'shop-reroll');
      throw new Error('Connection error - reroll not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  // Auto-retry DB connection when user returns to the page after being in background.
  // Prevents the app getting stuck in offline mode after transient network blips.
  // Android restores network a beat AFTER unlock: the first retry (and any
  // flush fired by resumed timers) can fail while radio is still connecting —
  // so we retry with backoff (2s, 6s) instead of a single immediate attempt,
  // and only clear the schedule once the healthcheck passes.
  useEffect(() => {
    if (dbAvailable) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const attempt = () => {
      void retryConnection().then(ok => {
        if (!ok) return
        timers.forEach(clearTimeout)
      })
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !dbAvailable) {
        attempt()
        timers.push(setTimeout(attempt, 2000))
        timers.push(setTimeout(attempt, 6000))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    handleVisibility()
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      timers.forEach(clearTimeout)
    }
  }, [dbAvailable, retryConnection])

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
    updatePushSubscription,
    retryConnection,
    useFight,
    useBossFight,
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
    addEssence,
    spendEssence,
    salvageItems,
    fuseItems,
    upgradeItem,
    buyShopOffer: buyShopOfferAction,
    rerollShopOffers: rerollShopOffersAction,
    lastUnlockedMedal,
    clearMedalNotification,
    pityCount: lootboxPityCount,
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
