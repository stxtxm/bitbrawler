import { createClient } from '@supabase/supabase-js'

// Configuration Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Initialisation de Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types pour les tables
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
  last_fight_reset: number
  fight_history: any[]
  fought_today: string[]
  stat_points: number
  pending_fight: any
  inventory: string[]
  last_loot_roll: number
  incoming_fight_history: any[]
  is_bot: boolean
  auto_mode: boolean
}

export type ServerTimeRow = {
  id: number
  timestamp: number
}