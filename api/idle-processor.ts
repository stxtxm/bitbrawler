import { createClient } from '@supabase/supabase-js'
import { IncomingMessage, ServerResponse } from 'http'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Character {
  id?: string
  name?: string
  level: number
  hp: number
  maxHp: number
  strength: number
  vitality: number
  dexterity: number
  luck: number
  intelligence: number
  focus: number
  experience: number
  statPoints: number
  autoMode?: boolean
  isBot?: boolean
  equippedItems?: Record<string, string | null>
  idleStreak?: number
  idleMaxStreak?: number
  idleTotalKills?: number
  idleTotalXp?: number
  essence?: number
  lastIdleCheck?: number
  lastActive?: number
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const BASE_VALUE = 10
const POINTS_PER_LEVEL = 1
const HP_PER_LEVEL = 20

const MIN_INTERVAL = 4500
const BASE_INTERVAL = 12000
const SPEED_FACTOR = 0.015
const POWER_RATIO_FACTOR = 0.3
const MAX_POWER_RATIO = 2.5
const XP_BONUS_RATIO = 0.2
const STREAK_BONUS_PER_STEP = 0.01
const STREAK_BONUS_CAP = 0.25
const ESSENCE_BASE_RATE = 0.2
const ESSENCE_LOSS_RATIO = 0.3
const ESSENCE_LEVEL_SCALE = 0.08
const ESSENCE_SOFT_CAP = 500

const MONSTER_IDS = ['GOBLIN', 'OGRE', 'WRAITH', 'SLIME', 'SKELETON', 'BAT', 'SPIDER']

interface MonsterDef {
  id: string
  name: string
  statMultiplier: number
  baseStats: { strength: number; vitality: number; dexterity: number; luck: number; intelligence: number; focus: number }
}

const MONSTER_DEFS: Record<string, MonsterDef> = {
  GOBLIN: { id: 'GOBLIN', name: 'Goblin', statMultiplier: 1.0, baseStats: { strength: 6, vitality: 4, dexterity: 5, luck: 3, intelligence: 2, focus: 3 } },
  OGRE: { id: 'OGRE', name: 'Ogre', statMultiplier: 1.3, baseStats: { strength: 10, vitality: 8, dexterity: 2, luck: 2, intelligence: 1, focus: 2 } },
  WRAITH: { id: 'WRAITH', name: 'Wraith', statMultiplier: 1.2, baseStats: { strength: 4, vitality: 3, dexterity: 7, luck: 5, intelligence: 6, focus: 5 } },
  SLIME: { id: 'SLIME', name: 'Slime', statMultiplier: 0.8, baseStats: { strength: 3, vitality: 6, dexterity: 2, luck: 1, intelligence: 1, focus: 1 } },
  SKELETON: { id: 'SKELETON', name: 'Skeleton', statMultiplier: 1.1, baseStats: { strength: 7, vitality: 5, dexterity: 4, luck: 2, intelligence: 3, focus: 4 } },
  BAT: { id: 'BAT', name: 'Bat', statMultiplier: 0.7, baseStats: { strength: 3, vitality: 2, dexterity: 6, luck: 4, intelligence: 1, focus: 2 } },
  SPIDER: { id: 'SPIDER', name: 'Spider', statMultiplier: 0.9, baseStats: { strength: 5, vitality: 4, dexterity: 5, luck: 3, intelligence: 2, focus: 3 } },
}

// ─────────────────────────────────────────────────────────────
// Pure utility functions (inlined — no src/ imports)
// ─────────────────────────────────────────────────────────────

function getRandomMonsterId(): string {
  return MONSTER_IDS[Math.floor(Math.random() * MONSTER_IDS.length)]
}

function monsterStatForLevel(base: number, level: number, multiplier: number): number {
  return Math.round(base + (level - 1) * 0.5 * multiplier)
}

function generateMonster(monsterId: string, level: number): Character {
  const def = MONSTER_DEFS[monsterId] || MONSTER_DEFS.GOBLIN
  const m = def.statMultiplier
  const b = def.baseStats
  return {
    level,
    hp: 20 + level * 5 + Math.round(b.vitality * m * 2),
    maxHp: 20 + level * 5 + Math.round(b.vitality * m * 2),
    strength: monsterStatForLevel(b.strength, level, m),
    vitality: monsterStatForLevel(b.vitality, level, m),
    dexterity: monsterStatForLevel(b.dexterity, level, m),
    luck: monsterStatForLevel(b.luck, level, m),
    intelligence: monsterStatForLevel(b.intelligence, level, m),
    focus: monsterStatForLevel(b.focus, level, m),
    experience: 0,
    statPoints: 0,
  }
}

function getReferenceMonster(level: number): Character {
  return generateMonster('GOBLIN', level)
}

function calculateCombatStats(c: Character) {
  const attack = c.strength * 0.6 + c.dexterity * 0.2 + c.intelligence * 0.2
  const defense = c.vitality * 0.5 + c.luck * 0.2
  const speed = c.dexterity * 0.5 + c.focus * 0.3
  return { attack, defense, speed }
}

interface CombatResult {
  winner: 'attacker' | 'defender'
  hpLoss: number
}

function simulateCombat(attacker: Character, defender: Character): CombatResult {
  const aStats = calculateCombatStats(attacker)
  const dStats = calculateCombatStats(defender)

  const attackRoll = aStats.attack * (0.8 + Math.random() * 0.4)
  const defenseRoll = dStats.defense * (0.8 + Math.random() * 0.4)

  const attackerValue = attackRoll + aStats.speed * 0.1
  const defenderValue = defenseRoll + dStats.speed * 0.1

  return attackerValue >= defenderValue
    ? { winner: 'attacker', hpLoss: Math.max(1, Math.floor(attackRoll - defenseRoll * 0.5)) }
    : { winner: 'defender', hpLoss: Math.max(1, Math.floor(dStats.attack * (0.8 + Math.random() * 0.4) - aStats.defense * 0.3)) }
}

function xpForNextLevel(level: number): number {
  if (level >= 99) return Infinity
  return Math.floor(120 * Math.pow(level, 1.65))
}

function totalXpForLevel(level: number): number {
  if (level <= 1) return 0
  let total = 0
  for (let i = 1; i < level; i++) total += xpForNextLevel(i)
  return Math.floor(total)
}

function gainXp(character: Character, xp: number): { updatedCharacter: Character; levelsGained: number } {
  let { level, experience } = character
  const startingLevel = level
  experience += xp

  while (level < 99) {
    if (experience >= totalXpForLevel(level + 1)) {
      level++
    } else {
      break
    }
  }

  const levelsGained = level - startingLevel
  const updatedCharacter: Character = {
    ...character,
    level,
    experience,
    maxHp: (character.maxHp || 100) + levelsGained * HP_PER_LEVEL,
    hp: (character.hp || 100) + levelsGained * HP_PER_LEVEL,
  }

  return { updatedCharacter, levelsGained }
}

function autoAllocateStatPointsRandom(character: Character, points: number): Character {
  const stats = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus'] as const
  const updated = { ...character }
  for (let i = 0; i < points; i++) {
    const key = stats[Math.floor(Math.random() * stats.length)]
    updated[key] = (updated[key] || 0) + 1
    updated.statPoints = (updated.statPoints || 0) - 1
  }
  return updated
}

function applyEquipmentToCharacter(character: Character): Character {
  return { ...character }
}

function computeEfficiency(playerStats: ReturnType<typeof calculateCombatStats>, monsterStats: ReturnType<typeof calculateCombatStats>, dexterity: number) {
  const powerRatio = Math.min(playerStats.attack / Math.max(monsterStats.defense, 1), MAX_POWER_RATIO)
  const speedRatio = playerStats.speed / Math.max(monsterStats.speed, 1)
  const efficiency = Math.min(powerRatio * 0.6 + speedRatio * 0.4, 1.0)
  const effectiveInterval = Math.max(MIN_INTERVAL, BASE_INTERVAL - Math.round(dexterity * SPEED_FACTOR * 1000) - Math.round(powerRatio * POWER_RATIO_FACTOR * 1000))
  const xpBonusMultiplier = 1 + (powerRatio - 1) * XP_BONUS_RATIO
  return { powerRatio, efficiency, effectiveInterval, xpBonusMultiplier }
}

function calculateOfflineFightsWithEfficiency(start: number, end: number, interval: number): number {
  const elapsed = end - start
  if (elapsed <= 0) return 0
  return Math.floor(elapsed / interval)
}

function calculateIdleXp(won: boolean, level: number): number {
  const baseXp = won ? 125 : 50
  const levelScaling = 1 + (level - 1) * 0.06
  const pveModifier = 0.7
  const idleModifier = 0.18
  const variance = 0.9 + Math.random() * 0.2
  return Math.floor(baseXp * levelScaling * pveModifier * idleModifier * variance)
}

// ─────────────────────────────────────────────────────────────
// Idle processor logic
// ─────────────────────────────────────────────────────────────

const IDLE_WINDOW_MS = 60_000
const DB_BATCH_SIZE = 10

const SELECT_COLUMNS = [
  'id', 'name', 'level', 'hp', 'max_hp',
  'strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus',
  'experience', 'stat_points', 'last_idle_check',
  'auto_mode', 'is_bot', 'equipped_items',
  'idle_streak', 'idle_max_streak', 'idle_total_kills', 'idle_total_xp',
  'essence', 'last_active',
].join(',')

function calculateIdleEssence(won: boolean, level: number): number {
  const baseRate = won ? ESSENCE_BASE_RATE : ESSENCE_BASE_RATE * ESSENCE_LOSS_RATIO
  const levelScaling = 1 + (level - 1) * ESSENCE_LEVEL_SCALE
  return baseRate * levelScaling
}

function simulateIdleGains(char: Character, idleMs: number): { updated: Character; fights: number } | null {
  if (idleMs <= 30_000) return null

  const effectiveChar = applyEquipmentToCharacter(char)
  const playerStats = calculateCombatStats(char)
  const refMonster = getReferenceMonster(char.level)
  const monsterStats = calculateCombatStats(refMonster)
  const eff = computeEfficiency(playerStats, monsterStats, effectiveChar.dexterity)
  const effectiveInterval = eff.effectiveInterval

  const totalFights = calculateOfflineFightsWithEfficiency(0, idleMs, effectiveInterval)
  if (totalFights <= 0) return null

  let current = { ...char }
  let streak = current.idleStreak ?? 0
  let kills = current.idleTotalKills ?? 0
  let idleTotal = current.idleTotalXp ?? 0
  let essenceAccum = 0

  for (let f = 0; f < totalFights; f++) {
    const monsterId = getRandomMonsterId()
    const monster = generateMonster(monsterId, current.level)
    const combat = simulateCombat(current, monster)
    const won = combat.winner === 'attacker'

    const baseXp = calculateIdleXp(won, current.level)
    const xpBonus = eff.xpBonusMultiplier - 1
    const streakBonus = Math.min(streak * STREAK_BONUS_PER_STEP, STREAK_BONUS_CAP)
    const finalXp = Math.floor(baseXp * (1 + xpBonus) * (1 + streakBonus))

    const essenceGain = calculateIdleEssence(won, current.level)
    essenceAccum += essenceGain

    const result = gainXp(current, finalXp)
    const pointsGained = result.levelsGained * POINTS_PER_LEVEL
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

  const essenceDelta = Math.min(Math.round(essenceAccum), ESSENCE_SOFT_CAP - (current.essence ?? 0))
  if (essenceDelta > 0) {
    current = { ...current, essence: (current.essence ?? 0) + essenceDelta }
  }

  return { updated: current, fights: totalFights }
}

function toSupabaseUpdates(c: Character, now: string): Record<string, any> {
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
    essence: c.essence,
  }
}

function toClientResponse(c: Character, now: string): Record<string, any> {
  return {
    lastIdleCheck: now,
    experience: c.experience,
    level: c.level,
    hp: c.hp,
    maxHp: c.maxHp,
    strength: c.strength,
    vitality: c.vitality,
    dexterity: c.dexterity,
    luck: c.luck,
    intelligence: c.intelligence,
    focus: c.focus,
    statPoints: c.statPoints,
    idleStreak: c.idleStreak,
    idleMaxStreak: c.idleMaxStreak,
    idleTotalKills: c.idleTotalKills,
    idleTotalXp: c.idleTotalXp,
    essence: c.essence,
  }
}

async function processCharacter(
  candidate: { id: string; char: Character; lastCheck: number },
  supabase: any,
): Promise<{ updated: Character | null; fights: number; xp: number; levels: number; essence: number }> {
  const idleMs = Date.now() - candidate.lastCheck
  const now = new Date().toISOString()

  if (idleMs <= 30_000) {
    await supabase.from('characters').update({ last_idle_check: now }).eq('id', candidate.id)
    return { updated: null, fights: 0, xp: 0, levels: 0, essence: 0 }
  }

  // ── Anti-conflit: vérifie que last_idle_check n'a pas changé ──
  // Empêche le cron d'écraser les données traitées par on-demand
  const { data: freshRow } = await supabase
    .from('characters')
    .select('last_idle_check')
    .eq('id', candidate.id)
    .single()

  if (freshRow) {
    const freshCheck = new Date(freshRow.last_idle_check).getTime()
    // Si last_idle_check a été mis à jour entre la lecture et maintenant
    // (par un appel on-demand), on skip pour éviter la race condition
    if (candidate.lastCheck > 0 && freshCheck !== candidate.lastCheck) {
      return { updated: null, fights: 0, xp: 0, levels: 0, essence: 0 }
    }
  }

  const result = simulateIdleGains(candidate.char, idleMs)
  if (!result) {
    await supabase.from('characters').update({ last_idle_check: now }).eq('id', candidate.id)
    return { updated: null, fights: 0, xp: 0, levels: 0, essence: 0 }
  }

  const { updated: updatedChar, fights: simulatedFights } = result
  const levelDiff = updatedChar.level - candidate.char.level
  const xpDiff = (updatedChar.experience ?? 0) - (candidate.char.experience ?? 0)
  const essenceDiff = (updatedChar.essence ?? 0) - (candidate.char.essence ?? 0)
  const updates = toSupabaseUpdates(updatedChar, now)
  await supabase.from('characters').update(updates).eq('id', candidate.id)

  return { updated: updatedChar, fights: simulatedFights, xp: xpDiff, levels: levelDiff, essence: essenceDiff }
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
      catch { resolve({}) }
    })
  })
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────

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

  // ── On-demand: single character ──
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

    const row = data as any
    const candidate = {
      id: row.id as string,
      char: {
        id: row.id,
        name: row.name,
        level: row.level ?? 1,
        hp: row.hp ?? 100,
        maxHp: row.max_hp ?? 100,
        strength: row.strength ?? 10,
        vitality: row.vitality ?? 10,
        dexterity: row.dexterity ?? 10,
        luck: row.luck ?? 10,
        intelligence: row.intelligence ?? 10,
        focus: row.focus ?? BASE_VALUE,
        experience: row.experience ?? 0,
        statPoints: row.stat_points ?? 0,
        isBot: row.is_bot ?? false,
        autoMode: row.auto_mode ?? false,
        equippedItems: row.equipped_items ?? { weapon: null, armor: null, accessory: null },
        idleStreak: row.idle_streak ?? 0,
        idleMaxStreak: row.idle_max_streak ?? 0,
        idleTotalKills: row.idle_total_kills ?? 0,
        idleTotalXp: row.idle_total_xp ?? 0,
        essence: row.essence ?? 0,
        lastIdleCheck: row.last_idle_check ? new Date(row.last_idle_check).getTime() : 0,
      } as Character,
      lastCheck: row.last_idle_check ? new Date(row.last_idle_check).getTime() : 0,
    }

    const result = await processCharacter(candidate, supabase)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      character_id: body.character_id,
      updated: result.updated ? toClientResponse(result.updated, new Date().toISOString()) : null,
      fights: result.fights,
      xp: result.xp,
      levels: result.levels,
      essence: result.essence,
    }))
    return
  }

  // ── Cron mode ──
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

  const candidates = (data as any[]).map((row: any) => ({
    id: row.id as string,
    char: {
      id: row.id,
      name: row.name,
      level: row.level ?? 1,
      hp: row.hp ?? 100,
      maxHp: row.max_hp ?? 100,
      strength: row.strength ?? 10,
      vitality: row.vitality ?? 10,
      dexterity: row.dexterity ?? 10,
      luck: row.luck ?? 10,
      intelligence: row.intelligence ?? 10,
      focus: row.focus ?? BASE_VALUE,
      experience: row.experience ?? 0,
      statPoints: row.stat_points ?? 0,
      isBot: row.is_bot ?? false,
      autoMode: row.auto_mode ?? false,
      equippedItems: row.equipped_items ?? { weapon: null, armor: null, accessory: null },
      idleStreak: row.idle_streak ?? 0,
      idleMaxStreak: row.idle_max_streak ?? 0,
      idleTotalKills: row.idle_total_kills ?? 0,
      idleTotalXp: row.idle_total_xp ?? 0,
      essence: row.essence ?? 0,
      lastIdleCheck: row.last_idle_check ? new Date(row.last_idle_check).getTime() : 0,
    } as Character,
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
