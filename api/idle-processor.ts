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

const IDLE_WINDOW_MS = 60_000
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

function simulateIdleGains(char: Character, idleMs: number): Character | null {
  if (idleMs <= 30_000) return null

  const effectiveChar = applyEquipmentToCharacter(char)
  const playerStats = calculateCombatStats(char)
  const refMonster = getReferenceMonster(char.level)
  const monsterStats = calculateCombatStats(refMonster)
  const eff = computeEfficiency(playerStats, monsterStats, effectiveChar.dexterity)
  const effectiveInterval = eff.effectiveInterval

  const fights = calculateOfflineFightsWithEfficiency(
    Date.now() - idleMs,
    Date.now(),
    effectiveInterval,
  )
  if (fights <= 0) return null

  let current = { ...char }
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

  return current
}

function characterToUpdates(c: Character, now: string): Record<string, any> {
  return {
    last_idle_check: now,
    experience: c.experience,
    level: c.level,
    hp: c.hp,
    max_hp: c.maxHp,
    strength: c.strength,
    vitality: c.vitality,
    dexterity: c.dexterity,
    luck: c.luck,
    intelligence: c.intelligence,
    focus: c.focus,
    stat_points: c.statPoints,
    idle_streak: c.idleStreak,
    idle_max_streak: c.idleMaxStreak,
    idle_total_kills: c.idleTotalKills,
    idle_total_xp: c.idleTotalXp,
  }
}

async function processCharacter(
  candidate: IdleChar,
  supabase: ReturnType<typeof createClient>,
): Promise<{ updated: Character | null; fights: number; xp: number; levels: number }> {
  const idleMs = Date.now() - candidate.lastCheck
  const now = new Date().toISOString()

  if (idleMs <= 30_000) {
    await supabase.from('characters').update({ last_idle_check: now }).eq('id', candidate.id)
    return { updated: null, fights: 0, xp: 0, levels: 0 }
  }

  const updatedChar = simulateIdleGains(candidate.char, idleMs)
  if (!updatedChar) {
    await supabase.from('characters').update({ last_idle_check: now }).eq('id', candidate.id)
    return { updated: null, fights: 0, xp: 0, levels: 0 }
  }

  const levelDiff = updatedChar.level - candidate.char.level
  const xpDiff = (updatedChar.experience ?? 0) - (candidate.char.experience ?? 0)

  const updates = characterToUpdates(updatedChar, now)
  await supabase.from('characters').update(updates).eq('id', candidate.id)

  return { updated: updatedChar, fights: 0, xp: xpDiff, levels: levelDiff }
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()))
      } catch {
        resolve({})
      }
    })
  })
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

  const body = await readBody(req)

  // ── On-demand: single character ─────────────────────────────────────────
  if (body?.character_id) {
    const { data, error } = await supabase
      .from('characters')
      .select(SELECT_COLUMNS)
      .eq('id', body.character_id)
      .single()

    if (error || !data) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Character not found' }))
      return
    }

    const candidate: IdleChar = {
      id: data.id,
      char: convertRowToCharacter(data),
      lastCheck: data.last_idle_check ? new Date(data.last_idle_check).getTime() : 0,
    }

    const result = await processCharacter(candidate, supabase)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      character_id: body.character_id,
      updated: result.updated ? characterToUpdates(result.updated, new Date().toISOString()) : null,
      fights: result.fights,
      xp: result.xp,
      levels: result.levels,
    }))
    return
  }

  // ── Cron mode: all idle characters ──────────────────────────────────────
  const cutoff = new Date(Date.now() - IDLE_WINDOW_MS).toISOString()
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
  for (let i = 0; i < candidates.length; i += DB_BATCH_SIZE) {
    const batch = candidates.slice(i, i + DB_BATCH_SIZE)
    await Promise.all(batch.map(c => processCharacter(c, supabase)))
    processed += batch.length
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ processed }))
}
