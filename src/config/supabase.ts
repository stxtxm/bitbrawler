import { createClient } from '@supabase/supabase-js'
import type { FightHistory, IncomingFightHistory, PendingFight } from '../types/Character'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bhbpvbfvuayafygdrbgb.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TvmRepD1Trhu5bQIGZbkmg_YZ3FI3Gn'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('supabaseUrl or supabaseAnonKey is required')
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
  incoming_fight_history: IncomingFightHistory[]
  is_bot: boolean
  auto_mode: boolean
  equipped_items: {
    weapon: string | null;
    armor: string | null;
    accessory: string | null;
  } | null
}

export type ServerTimeRow = {
  id: number
  timestamp: number
}