import { createClient } from '@supabase/supabase-js'
import { IncomingMessage, ServerResponse } from 'http'
import { Character } from '../src/types/Character'
import { generateMonster, getRandomMonsterId, getReferenceMonster } from '../src/utils/monsterUtils'
import { simulateCombat, calculateCombatStats } from '../src/utils/combatUtils'
import { gainXp } from '../src/utils/xpUtils'
import { GAME_RULES } from '../src/config/gameRules'
import { autoAllocateStatPointsRandom } from '../src/utils/statUtils'
import { applyEquipmentToCharacter } from '../src/utils/equipmentUtils'
import { computeEfficiency, calculateOfflineFightsWithEfficiency } from '../src/utils/idleEfficiencyUtils'
import { calculateIdleXp } from '../src/utils/idleXpUtils'
import { IDLE_CONFIG } from '../src/config/idleConfig'

const IDLE_WINDOW_MINUTES = 2
const DB_BATCH_SIZE = 10

const SELECT_COLUMNS = [
  'id', 'name', 'level', 'hp', 'max_hp',
  'strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus',
  'experience', 'stat_points', 'last_idle_check',
  'auto_mode', 'is_bot', 'equipped_items',
  'idle_streak', 'idle_max_streak', 'idle_total_kills', 'idle_total_xp',
].join(',')

function convertRowToCharacter(row: any): Character {
  return {
    id: row.id,
    name: row.name,
    gender: 'male',
    seed: row.id ?? 'idle-processor',
    level: row.level ?? 1,
    hp: row.hp ?? 100,
    maxHp: row.max_hp ?? 100,
    strength: row.strength ?? 10,
    vitality: row.vitality ?? 10,
    dexterity: row.dexterity ?? 10,
    luck: row.luck ?? 10,
    intelligence: row.intelligence ?? 10,
    focus: row.focus ?? GAME_RULES.STATS.BASE_VALUE,
    experience: row.experience ?? 0,
    wins: 0,
    losses: 0,
    fightsLeft: 0,
    lastFightReset: 0,
    statPoints: row.stat_points ?? 0,
    isBot: row.is_bot ?? false,
    autoMode: row.auto_mode ?? false,
    equippedItems: row.equipped_items ?? { weapon: null, armor: null, accessory: null },
    idleStreak: row.idle_streak ?? 0,
    idleMaxStreak: row.idle_max_streak ?? 0,
    idleTotalKills: row.idle_total_kills ?? 0,
    idleTotalXp: row.idle_total_xp ?? 0,
    lastIdleCheck: row.last_idle_check ? new Date(row.last_idle_check).getTime() : 0,
  }
}

interface IdleChar {
  id: string
  char: Character
  lastCheck: number
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'POST required' }))
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }))
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const cutoff = new Date(Date.now() - IDLE_WINDOW_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('characters')
    .select(SELECT_COLUMNS)
    .lt('last_idle_check', cutoff)
    .is('pending_fight', null)
    .limit(500)

  if (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: error.message }))
    return
  }

  if (!data || data.length === 0) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ processed: 0, message: 'No idle characters' }))
    return
  }

  const candidates: IdleChar[] = data.map((row: any) => ({
    id: row.id as string,
    char: convertRowToCharacter(row),
    lastCheck: row.last_idle_check ? new Date(row.last_idle_check).getTime() : 0,
  }))

  let processed = 0
  const results: string[] = []

  for (let i = 0; i < candidates.length; i += DB_BATCH_SIZE) {
    const batch = candidates.slice(i, i + DB_BATCH_SIZE)
    await Promise.all(batch.map(async (candidate) => {
      const idleMs = Date.now() - candidate.lastCheck
      if (idleMs <= 30_000) {
        await supabase
          .from('characters')
          .update({ last_idle_check: new Date().toISOString() })
          .eq('id', candidate.id)
        return
      }

      const effectiveChar = applyEquipmentToCharacter(candidate.char)
      const playerStats = calculateCombatStats(candidate.char)
      const refMonster = getReferenceMonster(candidate.char.level)
      const monsterStats = calculateCombatStats(refMonster)
      const eff = computeEfficiency(playerStats, monsterStats, effectiveChar.dexterity)
      const effectiveInterval = eff.effectiveInterval

      const fights = calculateOfflineFightsWithEfficiency(
        idleMs,
        Date.now(),
        effectiveInterval,
      )
      if (fights <= 0) {
        await supabase
          .from('characters')
          .update({ last_idle_check: new Date().toISOString() })
          .eq('id', candidate.id)
        return
      }

      let current = { ...candidate.char }
      let streak = current.idleStreak ?? 0
      let kills = current.idleTotalKills ?? 0
      let idleTotal = current.idleTotalXp ?? 0

      for (let f = 0; f < fights; f++) {
        const monsterId = getRandomMonsterId()
        const monster = generateMonster(monsterId, current.level)
        const combat = simulateCombat(current, monster)
        const won = combat.winner === 'attacker'

        const baseXp = calculateIdleXp(won, current.level)
        const xpBonus = eff.xpBonusMultiplier - 1
        const streakBonus = Math.min(
          streak * IDLE_CONFIG.EFFICIENCY.STREAK_BONUS_PER_STEP,
          IDLE_CONFIG.EFFICIENCY.STREAK_BONUS_CAP,
        )
        const finalXp = Math.floor(baseXp * (1 + xpBonus) * (1 + streakBonus))

        const result = gainXp(current, finalXp)
        const pointsGained = result.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL
        if (won) { streak++; kills++ } else { streak = 0 }
        idleTotal += finalXp

        const updated = {
          ...result.updatedCharacter,
          idleStreak: streak,
          idleMaxStreak: Math.max(streak, current.idleMaxStreak ?? 0),
          idleTotalKills: kills,
          idleTotalXp: idleTotal,
          statPoints: (result.updatedCharacter.statPoints ?? 0) + pointsGained,
        }

        current = updated.autoMode && pointsGained > 0
          ? autoAllocateStatPointsRandom(updated, pointsGained)
          : updated
      }

      const levelDiff = current.level - candidate.char.level
      const xpDiff = (current.experience ?? 0) - (candidate.char.experience ?? 0)

      const updates: Record<string, any> = {
        last_idle_check: new Date().toISOString(),
        experience: current.experience,
        level: current.level,
        hp: current.hp,
        max_hp: current.maxHp,
        strength: current.strength,
        vitality: current.vitality,
        dexterity: current.dexterity,
        luck: current.luck,
        intelligence: current.intelligence,
        focus: current.focus,
        stat_points: current.statPoints,
        idle_streak: current.idleStreak,
        idle_max_streak: current.idleMaxStreak,
        idle_total_kills: current.idleTotalKills,
        idle_total_xp: current.idleTotalXp,
      }

      await supabase.from('characters').update(updates).eq('id', candidate.id)

      const label = levelDiff > 0
        ? `${candidate.char.name}: LVL +${levelDiff}, +${xpDiff} XP`
        : `${candidate.char.name}: +${xpDiff} XP`
      results.push(label)
    }))
    processed += batch.length
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ processed, results }))
}
