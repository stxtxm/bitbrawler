import { createClient } from '@supabase/supabase-js'
import type { FightHistory, IncomingFightHistory, PendingFight } from '../types/Character'
import type { BossProgress } from '../utils/bossUtils'

// Active project (new account) — fallback = new project for CI/tests, override via .env.example
// Legacy project kept as comment in .env.example for easy revert.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gunuqjythwgbdbuyshoh.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Oeu79XQ1_UyaUjOn90-9DQ_FxGrdfeB'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('supabaseUrl or supabaseAnonKey is required')
}

if (import.meta.env.DEV || typeof console !== 'undefined') {
  console.info('[BitBrawler] Supabase target:', supabaseUrl)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Character table row type
export type CharacterRow = {
  id: string
  created_at: string
  name: string
  gender: string
  seed: string
  level: number
  hp: number
  max_hp: number
  strength: number
  vitality: number
  dexterity: number
  luck: number
  intelligence: number
  focus: number
  experience: number
  wins: number
  losses: number
  fights_left: number
  pve_fights_left: number
  last_fight_reset: number
  fight_history: FightHistory[]
  fought_today: string[]
  stat_points: number
  pending_fight: PendingFight | null
  inventory: string[]
  last_loot_roll: number
  lootbox_streak: number
  lootbox_pity?: number
  incoming_fight_history: IncomingFightHistory[]
  is_bot: boolean
  auto_mode: boolean
  equipped_items: {
    weapon: string | null;
    armor: string | null;
    accessory: string | null;
  } | null;
  last_idle_check: string | null;
  last_active: string | null;
  idle_streak: number;
  idle_max_streak: number;
  idle_total_kills: number;
  idle_total_xp: number;
  essence: number;
  item_upgrades: Record<string, number> | null;
  medal_progress?: Record<string, { completed: boolean; progress: number; unlockedAt?: number }> | null;
  medal_inventory_bonus?: number;
  medal_xp_bonus?: number;
  medal_title?: string | null;
  medal_aura?: boolean;
  push_endpoint?: string | null;
  push_keys?: string | null;
  push_subscribed?: boolean | null;
  boss_progress?: BossProgress | null;
}

export type ServerTimeRow = {
  id: number
  timestamp: number
}