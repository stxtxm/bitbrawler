import { CharacterRow } from '../config/supabase';
import { Character } from '../types/Character';

/**
 * Column projections that drastically reduce egress on Supabase free tier
 * (5 GB/month egress budget — the Rankings page used to fetch select('*')
 * on the whole table, which is the main quota burner).
 */
export const RANKINGS_SELECT_COLUMNS = 'id,name,gender,seed,level,appearance';
export const MATCHMAKING_SELECT_COLUMNS =
  'id,name,gender,seed,appearance,level,hp,max_hp,is_bot,strength,vitality,dexterity,luck,intelligence,focus,equipped_items,item_upgrades';

/** Convert a partial row (light projection) into a combat-ready Character.
 * Heavy state (inventory, histories, medals...) is left as defaults — only
 * combat-critical fields are populated from the row. */
export function convertFromMatchmakingRow(row: Partial<CharacterRow>): Character {
  return {
    name: row.name ?? 'Unknown',
    gender: (row.gender as 'male' | 'female') ?? 'male',
    seed: row.seed ?? 'seed',
    appearance: (row.appearance as any) ?? undefined,
    level: row.level ?? 1,
    hp: row.hp ?? 100,
    maxHp: row.max_hp ?? 100,
    strength: row.strength ?? 10,
    vitality: row.vitality ?? 10,
    dexterity: row.dexterity ?? 10,
    luck: row.luck ?? 10,
    intelligence: row.intelligence ?? 10,
    focus: row.focus ?? 10,
    experience: 0,
    wins: 0,
    losses: 0,
    fightsLeft: 0,
    pveFightsLeft: 5,
    lastFightReset: 0,
    fightHistory: [],
    foughtToday: [],
    statPoints: 0,
    pendingFight: undefined,
    inventory: [],
    lastLootRoll: 0,
    incomingFightHistory: [],
    isBot: row.is_bot ?? false,
    autoMode: false,
    equippedItems: row.equipped_items ?? { weapon: null, armor: null, accessory: null },
    itemUpgrades: row.item_upgrades ?? undefined,
    id: row.id,
  };
}

export function convertFromSupabase(row: CharacterRow): Character {
  const rawBoss: any = row.boss_progress ?? undefined;
  let bossProgress: any = undefined;
  let bossProgresses: any = undefined;
  let abyssalBossProgress: any = undefined;
  if (rawBoss) {
    if ('bossId' in rawBoss && 'bossHp' in rawBoss) {
      bossProgress = rawBoss;
      bossProgresses = { void_titan: rawBoss };
    } else if (typeof rawBoss === 'object') {
      bossProgresses = rawBoss;
      bossProgress = rawBoss.void_titan ?? rawBoss.abyssal_monarch ?? undefined;
      abyssalBossProgress = rawBoss.abyssal_monarch ?? undefined;
      if (!bossProgress && rawBoss.bossId) bossProgress = rawBoss;
    }
  }
  const abyssalFromRow: any = (row as any).abyssal_boss_progress ?? undefined;
  if (abyssalFromRow && !abyssalBossProgress) {
    abyssalBossProgress = abyssalFromRow;
    bossProgresses = { ...(bossProgresses ?? {}), abyssal_monarch: abyssalFromRow };
  }
  return {
    name: row.name,
    gender: row.gender as 'male' | 'female',
    seed: row.seed,
    appearance: (row.appearance as any) ?? undefined,
    level: row.level,
    hp: row.hp,
    maxHp: row.max_hp,
    strength: row.strength,
    vitality: row.vitality,
    dexterity: row.dexterity,
    luck: row.luck,
    intelligence: row.intelligence,
    focus: row.focus,
    experience: row.experience,
    wins: row.wins,
    losses: row.losses,
    fightsLeft: row.fights_left,
    pveFightsLeft: row.pve_fights_left ?? 5,
    lastFightReset: row.last_fight_reset,
    fightHistory: row.fight_history,
    foughtToday: row.fought_today,
    statPoints: row.stat_points,
    pendingFight: row.pending_fight ?? undefined,
    inventory: row.inventory,
    lastLootRoll: row.last_loot_roll,
    lootboxStreak: row.lootbox_streak ?? 0,
    lootboxPityCount: row.lootbox_pity ?? 0,
    incomingFightHistory: row.incoming_fight_history,
    isBot: row.is_bot,
    autoMode: row.auto_mode,
    equippedItems: row.equipped_items ?? { weapon: null, armor: null, accessory: null },
    id: row.id,
    lastIdleCheck: row.last_idle_check ? new Date(row.last_idle_check).getTime() : 0,
    lastActive: row.last_active ? new Date(row.last_active).toISOString() : 0,
    idleStreak: row.idle_streak ?? 0,
    idleMaxStreak: row.idle_max_streak ?? 0,
    idleTotalKills: row.idle_total_kills ?? 0,
    idleTotalXp: row.idle_total_xp ?? 0,
    essence: row.essence ?? 0,
    itemUpgrades: row.item_upgrades ?? undefined,
    medalProgress: row.medal_progress ?? undefined,
    medalInventoryBonus: row.medal_inventory_bonus ?? 0,
    medalXpBonus: row.medal_xp_bonus ?? 0,
    medalTitle: row.medal_title ?? undefined,
    medalAura: row.medal_aura ?? false,
    pushEndpoint: row.push_endpoint ?? null,
    pushKeys: row.push_keys ?? null,
    pushSubscribed: row.push_subscribed ?? false,
    bossProgress,
    bossProgresses,
    abyssalBossProgress,
  } as any;
}

export function convertToSupabase(character: Character, fields?: string[]): Partial<CharacterRow> {
  const allFields: Partial<CharacterRow> = {
    name: character.name,
    gender: character.gender as 'male' | 'female',
    seed: character.seed,
    level: character.level,
    hp: character.hp,
    max_hp: character.maxHp,
    strength: character.strength,
    vitality: character.vitality,
    dexterity: character.dexterity,
    luck: character.luck,
    intelligence: character.intelligence,
    focus: character.focus ?? 10,
    experience: character.experience ?? 0,
    wins: character.wins ?? 0,
    losses: character.losses ?? 0,
    fights_left: character.fightsLeft ?? 5,
    pve_fights_left: character.pveFightsLeft ?? 5,
    last_fight_reset: character.lastFightReset ?? Date.now(),
    fight_history: character.fightHistory ?? [],
    fought_today: character.foughtToday ?? [],
    stat_points: character.statPoints ?? 0,
    pending_fight: character.pendingFight ?? null,
    inventory: character.inventory ?? [],
    last_loot_roll: character.lastLootRoll ?? 0,
    lootbox_streak: character.lootboxStreak ?? 0,
    incoming_fight_history: character.incomingFightHistory ?? [],
    is_bot: typeof character.isBot === 'boolean' ? character.isBot : false,
    auto_mode: character.autoMode ?? false,
    equipped_items: character.equippedItems ?? { weapon: null, armor: null, accessory: null },
    last_idle_check: character.lastIdleCheck ? new Date(character.lastIdleCheck).toISOString() : null,
    last_active: character.lastActive ? new Date(character.lastActive).toISOString() : null,
    idle_streak: character.idleStreak ?? 0,
    idle_max_streak: character.idleMaxStreak ?? 0,
    idle_total_kills: character.idleTotalKills ?? 0,
    idle_total_xp: character.idleTotalXp ?? 0,
    ...(character.essence !== undefined ? { essence: character.essence } : {}),
    ...(character.itemUpgrades !== undefined ? { item_upgrades: character.itemUpgrades } : {}),
    ...(character.medalProgress !== undefined ? { medal_progress: character.medalProgress } : {}),
    ...(character.medalInventoryBonus !== undefined ? { medal_inventory_bonus: character.medalInventoryBonus } : {}),
    ...(character.medalXpBonus !== undefined ? { medal_xp_bonus: character.medalXpBonus } : {}),
    ...(character.medalTitle !== undefined ? { medal_title: character.medalTitle } : {}),
    ...(character.medalAura !== undefined ? { medal_aura: character.medalAura } : {}),
    ...(() => {
      const anyChar: any = character;
      if (anyChar.bossProgresses && Object.keys(anyChar.bossProgresses).length > 0) {
        const keys = Object.keys(anyChar.bossProgresses);
        const hasAbyssal = !!anyChar.bossProgresses.abyssal_monarch || !!anyChar.abyssalBossProgress;
        if (!hasAbyssal && keys.length === 1 && keys[0] === 'void_titan') {
          return { boss_progress: anyChar.bossProgress ?? anyChar.bossProgresses.void_titan };
        }
        const merged: any = { ...anyChar.bossProgresses };
        if (anyChar.abyssalBossProgress) merged.abyssal_monarch = anyChar.abyssalBossProgress;
        return { boss_progress: merged };
      }
      if (anyChar.abyssalBossProgress) {
        const map: any = {};
        if (anyChar.bossProgress) map.void_titan = anyChar.bossProgress;
        map.abyssal_monarch = anyChar.abyssalBossProgress;
        return { boss_progress: map };
      }
      if (anyChar.bossProgress !== undefined) return { boss_progress: anyChar.bossProgress };
      return {};
    })(),
    ...(character.appearance !== undefined ? { appearance: character.appearance as any } : {}),
  };
  if (fields) {
    const filtered = Object.fromEntries(
      Object.entries(allFields).filter(([key]) => fields.includes(key))
    ) as Partial<CharacterRow>;
    if (fields.includes('push_endpoint')) {
      filtered.push_endpoint = character.pushEndpoint ?? null;
    }
    if (fields.includes('push_keys')) {
      filtered.push_keys = character.pushKeys ?? null;
    }
    if (fields.includes('push_subscribed')) {
      filtered.push_subscribed = character.pushSubscribed ?? false;
    }
    if (fields.includes('lootbox_pity')) {
      filtered.lootbox_pity = character.lootboxPityCount ?? 0;
    }
    return filtered;
  }
  return allFields;
}
