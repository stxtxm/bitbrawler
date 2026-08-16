/**
 * QA Analysis Tests
 *
 * Tests for the QA stats analysis aggregation logic that handles:
 * - PvE monster data
 * - Equipment data 
 * - Streak data
 *
 * These test the pure computation logic used in scripts/analyze-qa-stats.ts
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Types matching RunRecord from analyze-qa-stats.ts ──

interface FightRecord {
  result: 'victory' | 'defeat' | 'draw'
  xp: number | null
  fight_duration_ms: number
  max_hp?: number | null
  fight_type?: 'pvp' | 'pve' | 'boss'
  monster_name?: string | null
  boss_hp_left?: number | null
  boss_max_hp?: number | null
}

interface LootboxResult {
  available: boolean
  opened?: boolean
  item?: string | null
  rarity?: string | null
  item_stats?: string[]
  reason?: string
  raw_text?: string
}

interface RunRecord {
  date: string
  run: string
  character: string
  fights: FightRecord[]
  lootbox?: LootboxResult | null
  initial_equipment?: Array<{ slot: string; name: string; rarity?: string }> | null
  final_equipment?: Array<{ slot: string; name: string; rarity?: string }> | null
  lootbox_equipment?: Array<{ slot: string; name: string; rarity?: string }> | null
  initial_streak?: number | null
  final_streak?: number | null
  lootbox_streak?: number | null
  initial_max_hp?: number | null
  final_max_hp?: number | null
  character_action?: string | null
  replaced_character?: string | null
  pve_data?: {
    fights: number
    wins: number
    xp_total: number
    monsters_faced: string[]
    pve_shifted?: boolean
    boss_name?: string | null
    boss_locked_level?: number | null
    boss_hp?: number | null
    boss_max_hp?: number | null
  }
  errors: string[]
}

interface EquipmentAnalysis {
  runs_with_data: number
  item_names: string[]
  unique_item_count: number
}

interface StreakAnalysis {
  avg_initial_streak: number
  avg_final_streak: number
  runs_with_data: number
}

interface HpAnalysis {
  avg_initial_max_hp: number
  avg_final_max_hp: number
  avg_hp_growth_per_run: number
  runs_with_hp_data: number
  runs_excluded_by_character_replacement: number
}

// ── Pure analysis functions (mirroring analyze-qa-stats.ts logic) ──

function computePveMonsters(fights: FightRecord[]): Record<string, number> {
  const pveFights = fights.filter(f => f.fight_type === 'pve')
  const monsters: Record<string, number> = {}
  for (const f of pveFights) {
    if (f.monster_name) {
      const name = f.monster_name.trim()
      monsters[name] = (monsters[name] || 0) + 1
    }
  }
  return monsters
}

// Validate and clean a captured equipment name. Corrupted names (emoji remnants
// such as variation selectors after slot icons, or inventory section labels) are
// cleaned so real items are recovered; only non-item values are excluded (#710).
function cleanEquipmentName(name: string): string | null {
  if (!name) return null
  const clean = name.replace(/[\uFE0F\u200D]/g, '').trim().replace(/^[^\p{L}\p{N}]+/u, '').trim()
  if (clean.length < 2) return null
  if (!/[a-zA-Z]/.test(clean)) return null
  const upper = clean.toUpperCase()
  if (upper === 'EMPTY' || upper === 'WEAPONS' || upper === 'ARMOR' || upper === 'ACCESSORIES') return null
  return clean
}

function computeEquipmentAnalysis(runs: RunRecord[]): EquipmentAnalysis | null {
  const runsWithEquipment = runs.filter(
    (r) => r.initial_equipment !== null &&
      r.initial_equipment !== undefined &&
      r.initial_equipment.some(e => cleanEquipmentName(e.name) !== null)
  )
  const runsWithLootboxEquipment = runs.filter(
    (r) => r.lootbox_equipment !== null &&
      r.lootbox_equipment !== undefined &&
      r.lootbox_equipment.some(e => cleanEquipmentName(e.name) !== null)
  )
  const allEquippedItems = [
    ...runsWithEquipment.flatMap(r => r.initial_equipment!.map(e => e.name)),
    ...runsWithLootboxEquipment.flatMap(r => r.lootbox_equipment!.map(e => e.name)),
  ]
    .map(cleanEquipmentName)
    .filter((n): n is string => n !== null)
  if (allEquippedItems.length === 0) return null

  return {
    runs_with_data: runsWithEquipment.length + runsWithLootboxEquipment.length,
    item_names: [...new Set(allEquippedItems)],
    unique_item_count: new Set(allEquippedItems).size,
  }
}

function computeStreakAnalysis(runs: RunRecord[]): StreakAnalysis | null {
  const runsWithInitStreak = runs.filter(
    (r): r is RunRecord & { initial_streak: number } => typeof r.initial_streak === 'number'
  )
  const runsWithFinalStreak = runs.filter(
    (r): r is RunRecord & { final_streak: number } => typeof r.final_streak === 'number'
  )
  const runsWithLootboxStreak = runs.filter(
    (r): r is RunRecord & { lootbox_streak: number } => typeof r.lootbox_streak === 'number'
  )

  if (runsWithInitStreak.length === 0 && runsWithLootboxStreak.length === 0) return null

  return {
    avg_initial_streak: runsWithInitStreak.length > 0
      ? runsWithInitStreak.reduce((s, r) => s + r.initial_streak, 0) / runsWithInitStreak.length
      : 0,
    avg_final_streak: runsWithFinalStreak.length > 0
      ? runsWithFinalStreak.reduce((s, r) => s + r.final_streak, 0) / runsWithFinalStreak.length
      : (runsWithLootboxStreak.length > 0
        ? runsWithLootboxStreak.reduce((s, r) => s + r.lootbox_streak, 0) / runsWithLootboxStreak.length
        : 0),
    runs_with_data: Math.max(runsWithInitStreak.length, runsWithLootboxStreak.length),
  }
}

function computePveWinRate(pveFights: FightRecord[]): number {
  if (pveFights.length === 0) return 0
  const wins = pveFights.filter(f => f.result === 'victory')
  return wins.length / pveFights.length
}

// ── PvE→Boss shift helpers (mirror of analyze-qa-stats.ts #705) ──
// Since the #633 boss-toggle removal, PvE mode launches the raid boss fight
// (LOCKED LVL 30). Runs that hit the lock are marked pve_data.pve_shifted so
// monster PvE analysis is not mistaken for live data; boss fights are tracked
// separately via fight_type === 'boss' and excluded from the PvP bucket.

function computePveShiftedRuns(runs: RunRecord[]): RunRecord[] {
  return runs.filter(r => r.pve_data?.pve_shifted === true)
}

function computeBossFightStats(fights: FightRecord[]): {
  boss_fights: number
  boss_win_rate: number | null
  boss_avg_xp_per_fight: number | null
} {
  const bossFights = fights.filter(f => f.fight_type === 'boss')
  if (bossFights.length === 0) {
    return { boss_fights: 0, boss_win_rate: null, boss_avg_xp_per_fight: null }
  }
  const bossWins = bossFights.filter(f => f.result === 'victory')
  const bossXpFights = bossFights.filter((f): f is FightRecord & { xp: number } => f.xp !== null)
  return {
    boss_fights: bossFights.length,
    boss_win_rate: bossWins.length / bossFights.length,
    boss_avg_xp_per_fight: bossXpFights.length > 0
      ? bossXpFights.reduce((s, f) => s + f.xp, 0) / bossXpFights.length
      : 0,
  }
}

function computePvpFightsExcludingBoss(fights: FightRecord[]): FightRecord[] {
  return fights.filter(f => f.fight_type !== 'pve' && f.fight_type !== 'boss')
}

// ── Character-replacement exclusion (mirror of analyze-qa-stats.ts) ──
// A run that replaces the character mid-run (QA bot `created-after-*` actions)
// reads initial_max_hp on the OLD character and final_max_hp on the NEW one,
// so final drops sharply. Such runs must be excluded from HP/essence growth
// metrics because they mix two different characters (#696).

function isCharacterReplacedRun(r: RunRecord): boolean {
  if (typeof r.initial_max_hp === 'number' && typeof r.final_max_hp === 'number') {
    if (r.final_max_hp < r.initial_max_hp - 10) return true
  }
  if (typeof r.character_action === 'string' && r.character_action.startsWith('created-after-')) {
    if (r.replaced_character !== null && r.replaced_character !== undefined) {
      return true
    }
  }
  return false
}

function computeHpAnalysis(runs: RunRecord[]): HpAnalysis | null {
  const allRunsWithHpData = runs.filter(
    r => typeof r.initial_max_hp === 'number' && typeof r.final_max_hp === 'number'
  )
  const excludedRuns = allRunsWithHpData.filter(isCharacterReplacedRun)
  const runsWithHpData = allRunsWithHpData.filter(r => !isCharacterReplacedRun(r))
  if (runsWithHpData.length === 0) return null

  const avgInitialHp = runsWithHpData.reduce((s, r) => s + (r.initial_max_hp ?? 0), 0) / runsWithHpData.length
  const avgFinalHp = runsWithHpData.reduce((s, r) => s + (r.final_max_hp ?? 0), 0) / runsWithHpData.length
  const avgGrowth = runsWithHpData.reduce((s, r) => s + ((r.final_max_hp ?? 0) - (r.initial_max_hp ?? 0)), 0) / runsWithHpData.length

  return {
    avg_initial_max_hp: Math.round(avgInitialHp * 10) / 10,
    avg_final_max_hp: Math.round(avgFinalHp * 10) / 10,
    avg_hp_growth_per_run: Math.round(avgGrowth * 10) / 10,
    runs_with_hp_data: runsWithHpData.length,
    runs_excluded_by_character_replacement: excludedRuns.length,
  }
}

// ── Tests ──

describe('QA PvE Analysis', () => {
  describe('computePveMonsters', () => {
    it('returns empty object when no PvE fights exist', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pvp' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pvp' },
      ]
      expect(computePveMonsters(fights)).toEqual({})
    })

    it('aggregates monster names from PvE fights', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
      ]
      expect(computePveMonsters(fights)).toEqual({ Goblin: 2, Ogre: 1 })
    })

    it('ignores PvE fights with null monster_name', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: null },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveMonsters(fights)).toEqual({ Goblin: 1, Ogre: 1 })
    })

    it('ignores PvP fights even if they have monster_name', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pvp', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveMonsters(fights)).toEqual({ Ogre: 1 })
    })

    it('trims whitespace from monster names', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: '  Goblin  ' },
      ]
      const result = computePveMonsters(fights)
      expect(result).toEqual({ Goblin: 1 })
    })

    it('handles empty fights array', () => {
      expect(computePveMonsters([])).toEqual({})
    })
  })

  describe('computePveWinRate', () => {
    it('returns 0 for no PvE fights', () => {
      expect(computePveWinRate([])).toBe(0)
    })

    it('calculates correct win rate', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'defeat', xp: 25, fight_duration_ms: 3000, fight_type: 'pve', monster_name: 'Ogre' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Wraith' },
      ]
      expect(computePveWinRate(fights)).toBeCloseTo(2 / 3, 5)
    })

    it('returns 1.0 for all wins', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveWinRate(fights)).toBe(1.0)
    })

    it('returns 0 for all losses', () => {
      const fights: FightRecord[] = [
        { result: 'defeat', xp: 25, fight_duration_ms: 3000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'defeat', xp: 25, fight_duration_ms: 3000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveWinRate(fights)).toBe(0)
    })

    it('counts draws as non-wins', () => {
      const fights: FightRecord[] = [
        { result: 'draw', xp: 50, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computePveWinRate(fights)).toBe(0.5)
    })
  })
})

describe('QA PvE→Boss Shift Analysis (#705)', () => {
  describe('computePveShiftedRuns', () => {
    it('returns empty when no run reports pve_data.pve_shifted', () => {
      const runs: RunRecord[] = [
        { date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [] },
        { date: '2026-08-16', run: 'r2', character: 'B', fights: [], errors: [], pve_data: { fights: 0, wins: 0, xp_total: 0, monsters_faced: [] } },
      ]
      expect(computePveShiftedRuns(runs)).toHaveLength(0)
    })

    it('returns runs where pve_data.pve_shifted is true (PvE mode = locked boss)', () => {
      const runs: RunRecord[] = [
        { date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [], pve_data: { fights: 0, wins: 0, xp_total: 0, monsters_faced: [], pve_shifted: true, boss_locked_level: 30 } },
        { date: '2026-08-16', run: 'r2', character: 'B', fights: [], errors: [], pve_data: { fights: 0, wins: 0, xp_total: 0, monsters_faced: [] } },
      ]
      expect(computePveShiftedRuns(runs)).toHaveLength(1)
    })
  })

  describe('computeBossFightStats', () => {
    it('returns zeros/null when no boss fights exist', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pvp' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
      ]
      expect(computeBossFightStats(fights)).toEqual({ boss_fights: 0, boss_win_rate: null, boss_avg_xp_per_fight: null })
    })

    it('aggregates boss fights with win rate and avg XP', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 360, fight_duration_ms: 20000, fight_type: 'boss', monster_name: 'VOID TITAN' },
        { result: 'defeat', xp: 0, fight_duration_ms: 30000, fight_type: 'boss', monster_name: 'VOID TITAN' },
      ]
      const stats = computeBossFightStats(fights)
      expect(stats.boss_fights).toBe(2)
      expect(stats.boss_win_rate).toBeCloseTo(0.5, 5)
      expect(stats.boss_avg_xp_per_fight).toBe(180)
    })

    it('ignores non-boss fights entirely', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 360, fight_duration_ms: 20000, fight_type: 'boss', monster_name: 'VOID TITAN' },
      ]
      const stats = computeBossFightStats(fights)
      expect(stats.boss_fights).toBe(1)
      expect(stats.boss_avg_xp_per_fight).toBe(360)
    })
  })

  describe('computePvpFightsExcludingBoss', () => {
    it('excludes boss fights from the PvP bucket', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pvp' },
        { result: 'victory', xp: 360, fight_duration_ms: 20000, fight_type: 'boss', monster_name: 'VOID TITAN' },
      ]
      const pvp = computePvpFightsExcludingBoss(fights)
      expect(pvp).toHaveLength(1)
      expect(pvp[0].fight_type).toBe('pvp')
    })

    it('keeps legacy fights without fight_type in the PvP bucket', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000 },
        { result: 'victory', xp: 360, fight_duration_ms: 20000, fight_type: 'boss', monster_name: 'VOID TITAN' },
      ]
      expect(computePvpFightsExcludingBoss(fights)).toHaveLength(1)
    })
  })
})

describe('QA Equipment Analysis', () => {
  it('returns null when no equipment data exists', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [] },
    ]
    expect(computeEquipmentAnalysis(runs)).toBeNull()
  })

  it('aggregates equipment from initial_equipment', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: 'Iron Sword', rarity: 'common' },
          { slot: 'armor', name: 'Leather Armor', rarity: 'common' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.runs_with_data).toBe(1)
    expect(result!.unique_item_count).toBe(2)
    expect(result!.item_names).toContain('Iron Sword')
    expect(result!.item_names).toContain('Leather Armor')
  })

  it('aggregates equipment from lootbox_equipment', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        lootbox_equipment: [
          { slot: 'weapon', name: 'Steel Sword', rarity: 'rare' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.runs_with_data).toBe(1)
    expect(result!.unique_item_count).toBe(1)
    expect(result!.item_names).toContain('Steel Sword')
  })

  it('combines both initial and lootbox equipment', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: 'Iron Sword' },
        ],
        lootbox_equipment: [
          { slot: 'armor', name: 'Steel Armor' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.unique_item_count).toBe(2)
    expect(result!.runs_with_data).toBe(2) // both initial and lootbox count as separate
  })

  it('deduplicates item names across runs', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: 'Iron Sword' },
        ],
      },
      {
        date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: 'Iron Sword' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.unique_item_count).toBe(1)
    expect(result!.item_names).toEqual(['Iron Sword'])
  })

  it('handles runs with empty equipment arrays', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [],
      },
      {
        date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [],
        lootbox_equipment: [
          { slot: 'weapon', name: 'Bronze Dagger' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.runs_with_data).toBe(1)
    expect(result!.unique_item_count).toBe(1)
  })

  it('ignores null equipment fields', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: null,
        lootbox_equipment: null,
      },
    ]
    expect(computeEquipmentAnalysis(runs)).toBeNull()
  })

  it('recovers real item names from emoji remnants and excludes section labels (#710)', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: '\uFE0F Iron Sword' },
          { slot: 'armor', name: '\uFE0F ARMOR' },
        ],
      },
      {
        date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [],
        initial_equipment: [
          { slot: 'weapon', name: 'Steel Sword' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    // r1's "️ Iron Sword" is recovered as "Iron Sword"; the "️ ARMOR" section
    // label is dropped. Both runs count as having data.
    expect(result!.runs_with_data).toBe(2)
    expect(result!.unique_item_count).toBe(2)
    expect(result!.item_names).toEqual(['Iron Sword', 'Steel Sword'])
  })

  it('drops emoji-only and section-label equipment names entirely (#710)', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [
          { slot: '?', name: 'ARMOR' },
          { slot: '?', name: 'WEAPONS' },
          { slot: '?', name: '\uFE0F' },
        ],
      },
    ]
    expect(computeEquipmentAnalysis(runs)).toBeNull()
  })

  it('accepts real single-word item names as valid equipment (#710)', () => {
    expect(cleanEquipmentName('Flamberge')).toBe('Flamberge')
    expect(cleanEquipmentName('Voidreaper')).toBe('Voidreaper')
    expect(cleanEquipmentName('Iron Sword')).toBe('Iron Sword')
    expect(cleanEquipmentName('\uFE0F Iron Sword')).toBe('Iron Sword')
    expect(cleanEquipmentName('EMPTY')).toBeNull()
    expect(cleanEquipmentName('\uFE0F')).toBeNull()
    expect(cleanEquipmentName('')).toBeNull()
  })
})

describe('QA Streak Analysis', () => {
  it('returns null when no streak data exists', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [] },
    ]
    expect(computeStreakAnalysis(runs)).toBeNull()
  })

  it('calculates average initial streak', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 2 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 4 },
      { date: '2026-01-03', run: 'r3', character: 'C3', fights: [], errors: [], initial_streak: 6 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_initial_streak).toBe(4)
    expect(result!.runs_with_data).toBe(3)
  })

  it('calculates average final streak from final_streak', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 2, final_streak: 3 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 4, final_streak: 5 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_initial_streak).toBe(3)
    expect(result!.avg_final_streak).toBe(4)
    expect(result!.runs_with_data).toBe(2)
  })

  it('falls back to lootbox_streak for final streak when final_streak is missing', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 2, lootbox_streak: 3 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 4, lootbox_streak: 6 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_final_streak).toBe(4.5)
    expect(result!.runs_with_data).toBe(2)
  })

  it('prefers final_streak over lootbox_streak', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_streak: 2, final_streak: 3, lootbox_streak: 5,
      },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_final_streak).toBe(3)
  })

  it('handles zero streak values', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 0, final_streak: 0 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 0, final_streak: 1 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_initial_streak).toBe(0)
    expect(result!.avg_final_streak).toBe(0.5)
  })

  it('handles mixed presence of streak data', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 3 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [] }, // no streak data
      { date: '2026-01-03', run: 'r3', character: 'C3', fights: [], errors: [], initial_streak: 5 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_initial_streak).toBe(4)
    expect(result!.runs_with_data).toBe(2)
  })

  it('returns null when all initial streak values are null/undefined', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: null },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: undefined },
    ]
    expect(computeStreakAnalysis(runs)).toBeNull()
  })
})

describe('QA Level-Up Event Contract', () => {
  it('qa-bot.mjs binds levels_gained to the camelCase local (no ReferenceError shorthand)', () => {
    const source = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')
    // The fight-loop level-up event must emit the snake_case key the analyzer
    // expects (analyze-qa-stats.ts LevelUpEvent.levels_gained). A bare shorthand
    // `levels_gained,` would reference a non-existent variable (the local is
    // `levelsGained`) → ReferenceError that crashes every QA run on level-up (#630).
    expect(source).toContain('levels_gained: levelsGained,')
    expect(source).not.toMatch(/levels_gained,\s*\n/)
  })
})

describe('QA Bot Overlay Deadlock Contract', () => {
  const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  function extractAsyncFunction(source: string, name: string): string | null {
    const start = source.indexOf(`async function ${name}(`)
    if (start === -1) return null
    const bodyStart = source.indexOf('{', start)
    let depth = 0
    for (let i = bodyStart; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) return source.slice(start, i + 1)
      }
    }
    return null
  }

  function requireAsyncFunction(name: string): string {
    const fn = extractAsyncFunction(qaBotSource, name)
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error(`qa-bot.mjs missing async function ${name}()`)
    return fn
  }

  it('registers a locator handler for .inventory-overlay that force-closes it', () => {
    // Without this handler (unlike the level-up one) the inventory overlay can
    // stay open and intercept pointer events on Settings/Inventory (#637).
    expect(qaBotSource).toContain("page.addLocatorHandler(")
    expect(qaBotSource).toContain("page.locator('.inventory-overlay')")
    expect(qaBotSource).toContain('.inventory-close')
  })

  it('defines a dismissModals(page) helper that polls for overlay detach', () => {
    const fn = requireAsyncFunction('dismissModals')
    expect(fn).toContain("keyboard.press('Escape')")
    expect(fn).toContain("page.locator('.retro-modal-overlay').first()")
    expect(fn).toContain("page.locator('.lootbox-result-overlay').first()")
    expect(fn).toContain("state: 'detached'")
  })

  it('syncAutoMode dismisses open modals before clicking Settings', () => {
    const fn = requireAsyncFunction('syncAutoMode')
    const dismissIdx = fn.indexOf('dismissModals(page)')
    const settingsClickIdx = fn.indexOf('settingsBtn.click()')
    expect(dismissIdx).toBeGreaterThan(-1)
    expect(settingsClickIdx).toBeGreaterThan(dismissIdx)
  })

  it('handleDailyLootbox waits for inventory-overlay detach and does not silently swallow close errors', () => {
    const fn = requireAsyncFunction('handleDailyLootbox')
    expect(fn).toContain("waitForSelector('.inventory-overlay'")
    expect(fn).toContain("state: 'detached'")
    expect(fn).not.toMatch(/closeInventory\.click\(\)\.catch\(\(\) => \{\}\)/)
  })

  it('guards the .inventory-overlay locator handler with suppressInventoryHandler + noWaitAfter (deadlock v2 #645)', () => {
    // The #637 handler dismisses the inventory on EVERY intercepted action. During
    // handleDailyLootbox the overlay must stay OPEN (the lootbox button lives inside
    // it), so the handler fights the flow → infinite retry → 30s timeout (#645).
    // A bare `return` guard is NOT enough: Playwright waits for the selector to be
    // hidden after the handler unless noWaitAfter is set, which would still block.
    expect(qaBotSource).toContain('let suppressInventoryHandler = false')
    const overlayLocatorIdx = qaBotSource.indexOf("page.locator('.inventory-overlay')")
    expect(overlayLocatorIdx).toBeGreaterThan(-1)
    const handlerBlock = qaBotSource.slice(overlayLocatorIdx, overlayLocatorIdx + 700)
    expect(handlerBlock).toContain('if (suppressInventoryHandler) return')
    expect(handlerBlock).toContain('noWaitAfter: true')
  })

  it('handleDailyLootbox suppresses the inventory handler before opening inventory and re-arms it on every exit path (#645)', () => {
    const fn = requireAsyncFunction('handleDailyLootbox')
    const setIdx = fn.indexOf('suppressInventoryHandler = true')
    const clickIdx = fn.indexOf('inventoryBtn.click()')
    expect(setIdx).toBeGreaterThan(-1)
    expect(setIdx).toBeLessThan(clickIdx)
    const afterSet = fn.slice(setIdx)
    const returnsAfter = (afterSet.match(/return \{/g) || []).length
    const unsets = (afterSet.match(/suppressInventoryHandler = false/g) || []).length
    expect(returnsAfter).toBeGreaterThan(0)
    expect(unsets).toBe(returnsAfter)
  })

  it('syncAutoMode targets the Auto mode switch with a strict locator, never the generic [role="switch"] fallback (#653)', () => {
    // The composite locator '[role="switch"][aria-label="Auto mode"], [role="switch"],
    // .pixel-switch' .first() resolved to the PvE switch (ActionPanel, higher in DOM)
    // instead of the Auto mode switch inside the settings modal → click intercepted by
    // the settings-overlay → 30s timeout on every run (#653).
    const fn = requireAsyncFunction('syncAutoMode')
    expect(fn).toContain("getByRole('switch', { name: 'Auto mode' })")
    expect(fn).not.toContain('[role="switch"][aria-label="Auto mode"], [role="switch"], .pixel-switch')
    expect(fn).not.toMatch(/,\s*\[role="switch"\]/)
  })

  it('syncAutoMode verifies the settings overlay is open before clicking the Auto mode switch (#653)', () => {
    const fn = requireAsyncFunction('syncAutoMode')
    const overlayCheckIdx = fn.indexOf('settings-overlay')
    const clickIdx = fn.indexOf('autoSwitch.click()')
    expect(overlayCheckIdx).toBeGreaterThan(-1)
    expect(clickIdx).toBeGreaterThan(overlayCheckIdx)
  })

  it('syncAutoMode retries the toggle with force click when aria-checked does not change after click (#653)', () => {
    const fn = requireAsyncFunction('syncAutoMode')
    const firstClick = fn.indexOf('autoSwitch.click()')
    const forceClick = fn.indexOf('autoSwitch.click({ force: true })')
    expect(firstClick).toBeGreaterThan(-1)
    expect(forceClick).toBeGreaterThan(firstClick)
    const retryChecked = fn.indexOf("getAttribute('aria-checked')", forceClick)
    expect(retryChecked).toBeGreaterThan(forceClick)
  })
})

describe('QA Bot Equipment Capture Contract (#710)', () => {
  const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  function extractAsyncFunction(source: string, name: string): string | null {
    const start = source.indexOf(`async function ${name}(`)
    if (start === -1) return null
    const bodyStart = source.indexOf('{', start)
    let depth = 0
    for (let i = bodyStart; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) return source.slice(start, i + 1)
      }
    }
    return null
  }

  function requireAsyncFunction(name: string): string {
    const fn = extractAsyncFunction(qaBotSource, name)
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error(`qa-bot.mjs missing async function ${name}()`)
    return fn
  }

  // Every `return` after the flag is set must be preceded by a re-arm. Without
  // it the .inventory-overlay handler stays suppressed forever and future clicks
  // on the inventory are no longer auto-dismissed (#710, same invariant as #645).
  function assertEveryReturnReArms(fn: string): void {
    const setIdx = fn.indexOf('suppressInventoryHandler = true')
    expect(setIdx).toBeGreaterThan(-1)
    const afterSet = fn.slice(setIdx)
    const returnsAfter = (afterSet.match(/return /g) || []).length
    const unsets = (afterSet.match(/suppressInventoryHandler = false/g) || []).length
    expect(returnsAfter).toBeGreaterThan(0)
    expect(unsets).toBeGreaterThan(0)
    let cursor = setIdx
    let idx = -1
    while ((idx = fn.indexOf('return ', cursor)) !== -1) {
      const unsetBefore = fn.lastIndexOf('suppressInventoryHandler = false', idx)
      expect(unsetBefore).toBeGreaterThan(setIdx)
      cursor = idx + 7
    }
  }

  it('parseEquippedItems suppresses the inventory handler before opening the panel and re-arms on every exit path (#710)', () => {
    const fn = requireAsyncFunction('parseEquippedItems')
    const setIdx = fn.indexOf('suppressInventoryHandler = true')
    const clickIdx = fn.indexOf('invBtn.click()')
    expect(setIdx).toBeGreaterThan(-1)
    expect(setIdx).toBeLessThan(clickIdx)
    assertEveryReturnReArms(fn)
  })

  it('parseStreak suppresses the inventory handler before opening the panel and re-arms on every exit path (#710)', () => {
    const fn = requireAsyncFunction('parseStreak')
    const setIdx = fn.indexOf('suppressInventoryHandler = true')
    const clickIdx = fn.indexOf('invBtn.click()')
    expect(setIdx).toBeGreaterThan(-1)
    expect(setIdx).toBeLessThan(clickIdx)
    assertEveryReturnReArms(fn)
  })

  it('parseEquippedItemsFromBody cleans names via cleanItemName (strips emoji remnants, rejects section labels) (#710)', () => {
    const fn = requireAsyncFunction('parseEquippedItemsFromBody')
    expect(fn).toContain('cleanItemName(')
    expect(fn).not.toContain("itemName.length >= 2 && /[a-zA-Z]/.test(itemName)")
  })

  it('defines a cleanItemName helper that strips variation selectors and leading emoji junk (#710)', () => {
    const fnStart = qaBotSource.indexOf('function cleanItemName(')
    expect(fnStart).toBeGreaterThan(-1)
    const fn = qaBotSource.slice(fnStart, fnStart + 600)
    expect(fn).toContain('\\uFE0F\\u200D')
    expect(fn).toContain('[^\\p{L}\\p{N}]+')
    expect(fn).toContain("'WEAPONS'")
    expect(fn).toContain("'ARMOR'")
    expect(fn).toContain("'ACCESSORIES'")
    expect(fn).toContain("'EMPTY'")
  })

  it('analyze-qa-stats.ts cleans corrupted equipment names in the equipment analysis (#710)', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
    expect(source).toContain('function cleanEquipmentName(')
    expect(source).toContain('.some(e => cleanEquipmentName(e.name) !== null)')
    expect(source).toContain('.filter((n): n is string => n !== null)')
  })

  it('handleDailyLootbox equips the lootbox item so the loadout records real equipment (#710)', () => {
    const fn = requireAsyncFunction('handleDailyLootbox')
    const equipIdx = fn.indexOf('button[aria-label^="Equip "]')
    const resultOverlayIdx = fn.indexOf('.lootbox-result-overlay')
    const closeIdx = fn.lastIndexOf('closeInventory')
    expect(equipIdx).toBeGreaterThan(-1)
    expect(equipIdx).toBeGreaterThan(resultOverlayIdx)
    expect(closeIdx).toBeGreaterThan(equipIdx)
    expect(fn).toContain('.inv-loadout-slot.filled')
    expect(fn).toContain('Equipped lootbox item')
  })
})

describe('QA Bot Locked Tab Skip Contract', () => {
  const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  function extractAsyncFunction(source: string, name: string): string | null {
    const start = source.indexOf(`async function ${name}(`)
    if (start === -1) return null
    const bodyStart = source.indexOf('{', start)
    let depth = 0
    for (let i = bodyStart; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) return source.slice(start, i + 1)
      }
    }
    return null
  }

  function requireAsyncFunction(name: string): string {
    const fn = extractAsyncFunction(qaBotSource, name)
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error(`qa-bot.mjs missing async function ${name}()`)
    return fn
  }

  it('defines an isTabLocked helper that detects disabled tabs or "Unlocks at LVL" titles (#685)', () => {
    const fn = extractAsyncFunction(qaBotSource, 'isTabLocked')
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error('qa-bot.mjs missing async function isTabLocked()')
    expect(fn).toContain('isDisabled()')
    expect(fn).toContain('Unlocks at LVL')
    expect(fn).toContain("getAttribute('title')")
  })

  it('testForgeSystem guards the Fusion tab click with isTabLocked and skips via createSkippedForgeResult (#685)', () => {
    const fn = requireAsyncFunction('testForgeSystem')
    const lockIdx = fn.indexOf('isTabLocked(fusionTab)')
    const clickIdx = fn.indexOf('fusionTab.click()')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(clickIdx).toBeGreaterThan(lockIdx)
    const skipIdx = fn.indexOf('createSkippedForgeResult(', lockIdx)
    expect(skipIdx).toBeGreaterThan(-1)
    expect(skipIdx).toBeLessThan(clickIdx)
  })

  it('testForgeSystem guards the Upgrade tab click with isTabLocked and skips via createSkippedForgeResult (#685)', () => {
    const fn = requireAsyncFunction('testForgeSystem')
    const lockIdx = fn.indexOf('isTabLocked(upgradeTab)')
    const clickIdx = fn.indexOf('upgradeTab.click()')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(clickIdx).toBeGreaterThan(lockIdx)
    const skipIdx = fn.indexOf('createSkippedForgeResult(', lockIdx)
    expect(skipIdx).toBeGreaterThan(-1)
    expect(skipIdx).toBeLessThan(clickIdx)
  })

  it('testShopSystem guards the Shop tab click with isTabLocked and returns createSkippedShopResult (#685)', () => {
    const fn = requireAsyncFunction('testShopSystem')
    const lockIdx = fn.indexOf('isTabLocked(shopTab)')
    const clickIdx = fn.indexOf('shopTab.click()')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(clickIdx).toBeGreaterThan(lockIdx)
    const skipIdx = fn.indexOf('createSkippedShopResult(', lockIdx)
    expect(skipIdx).toBeGreaterThan(-1)
    expect(skipIdx).toBeLessThan(clickIdx)
  })
})

describe('QA Bot Fight CTA Robustness Contract', () => {
  const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  function extractAsyncFunction(source: string, name: string): string | null {
    const start = source.indexOf(`async function ${name}(`)
    if (start === -1) return null
    const bodyStart = source.indexOf('{', start)
    let depth = 0
    for (let i = bodyStart; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) return source.slice(start, i + 1)
      }
    }
    return null
  }

  function requireAsyncFunction(name: string): string {
    const fn = extractAsyncFunction(qaBotSource, name)
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error(`qa-bot.mjs missing async function ${name}()`)
    return fn
  }

  it('togglePveMode toggles based on the target switch aria-checked, not the desired boolean (#689)', () => {
    // The PvP switch's aria-checked already encodes "PvP mode active" (true when
    // in PvP). The old `isOn !== enablePve` check read "false" for the PvP switch
    // while in PvE mode, so toggling back to PvP silently did nothing → the bot
    // stayed in PvE mode where the boss is locked (LOCKED LVL 30) → 0 fights.
    // The post-click verification must also compare against `true` (target mode
    // active), never against the desired boolean.
    const fn = requireAsyncFunction('togglePveMode')
    expect(fn).toContain('if (!isOn) {')
    expect(fn).not.toContain('isOn !== enablePve')
    expect(fn).toContain('if (verified === true) {')
    expect(fn).toContain('if (retryVerified === true) {')
    expect(fn).not.toContain('verified === enablePve')
  })

  it('readArenaStatus exposes fightButtonEnabled, isSearching and isPveLocked (#689)', () => {
    const fn = requireAsyncFunction('readArenaStatus')
    expect(fn).toContain('fightButtonEnabled')
    expect(fn).toContain('isDisabled()')
    expect(fn).toContain('isSearching')
    expect(fn).toContain('isPveLocked')
    expect(fn).toContain("fightButtonLabel.includes('SEARCHING')")
    expect(fn).toContain("fightButtonLabel.includes('LOCKED LVL')")
  })

  it('defines a buildArenaStatusRecord helper capturing the fight-gate diagnostics (#689)', () => {
    const fn = extractAsyncFunction(qaBotSource, 'buildArenaStatusRecord')
      ?? (() => {
        const start = qaBotSource.indexOf('function buildArenaStatusRecord(')
        if (start === -1) return null
        const bodyStart = qaBotSource.indexOf('{', start)
        let depth = 0
        for (let i = bodyStart; i < qaBotSource.length; i++) {
          if (qaBotSource[i] === '{') depth++
          else if (qaBotSource[i] === '}') {
            depth--
            if (depth === 0) return qaBotSource.slice(start, i + 1)
          }
        }
        return null
      })()
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error('qa-bot.mjs missing function buildArenaStatusRecord()')
    for (const key of ['fightButtonLabel', 'fightButtonVisible', 'fightButtonEnabled', 'fightsAvailable', 'isResting', 'hasFightCta', 'isSearching', 'isPveLocked']) {
      expect(fn).toContain(key)
    }
  })

  it('runFightSequence gates fights on fightButtonEnabled + energy, not the raw FIGHT label (#689)', () => {
    const fn = requireAsyncFunction('runFightSequence')
    expect(fn).toContain('!arenaStatus.fightButtonEnabled')
    expect(fn).not.toContain('!arenaStatus.hasFightCta')
    expect(fn).toContain('runRecord.arena_status = buildArenaStatusRecord(')
  })

  it('runFightSequence treats SEARCHING... with a wait+retry loop (max 2 retries) before failing (#689)', () => {
    const fn = requireAsyncFunction('runFightSequence')
    const searchIdx = fn.indexOf('isSearching')
    expect(searchIdx).toBeGreaterThan(-1)
    expect(fn.indexOf('await sleep(3000)', searchIdx)).toBeGreaterThan(searchIdx)
    expect(fn.indexOf('retry < 2', searchIdx)).toBeGreaterThan(searchIdx)
  })

  it('runFightSequence falls back from PvE-locked (LOCKED LVL) to PvP mode before replacing the character (#689)', () => {
    const fn = requireAsyncFunction('runFightSequence')
    const lockIdx = fn.indexOf('isPveLocked')
    expect(lockIdx).toBeGreaterThan(-1)
    const toggleIdx = fn.indexOf('togglePveMode(page, false)', lockIdx)
    expect(toggleIdx).toBeGreaterThan(lockIdx)
    const missingCtaIdx = fn.indexOf("'missing-fight-cta'")
    expect(missingCtaIdx).toBeGreaterThan(toggleIdx)
  })

  it('defines a retryArenaReload helper that reloads the page and re-waits for the arena (#689)', () => {
    const fn = extractAsyncFunction(qaBotSource, 'retryArenaReload')
    expect(fn).not.toBeNull()
    if (fn === null) throw new Error('qa-bot.mjs missing async function retryArenaReload()')
    expect(fn).toContain('page.reload(')
    expect(fn).toContain('waitForArena(page')
  })

  it('runFightSequence reloads the arena before replacing the character on missing-fight-cta (#689)', () => {
    const fn = requireAsyncFunction('runFightSequence')
    const reloadIdx = fn.indexOf('retryArenaReload(page)')
    expect(reloadIdx).toBeGreaterThan(-1)
    const missingIdx = fn.indexOf("'missing-fight-cta'")
    expect(missingIdx).toBeGreaterThan(reloadIdx)
  })

  it('runRecord initializes arena_status to null (#689)', () => {
    expect(qaBotSource).toContain('arena_status: null')
  })

  it('readArenaStatus parses bossLockedLevel from the LOCKED LVL label (#705)', () => {
    const fn = requireAsyncFunction('readArenaStatus')
    expect(fn).toContain('bossLockedLevel')
    expect(fn).toContain('match(/LOCKED LVL')
  })

  it('runFightSequence records a PvE-observation (pve_data.pve_shifted) when the boss is locked (Option A, #705)', () => {
    const fn = requireAsyncFunction('runFightSequence')
    const lockIdx = fn.indexOf('isPveLocked')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(fn.indexOf('pve_data.pve_shifted = true', lockIdx)).toBeGreaterThan(lockIdx)
    expect(fn.indexOf('captureBossStatus(page)', lockIdx)).toBeGreaterThan(lockIdx)
    expect(fn.indexOf('togglePveMode(page, false)', lockIdx)).toBeGreaterThan(lockIdx)
  })

  it('runFightSequence launches a real boss fight via captureBossFight once the character reaches the boss gate (Option B, #705)', () => {
    const fn = requireAsyncFunction('runFightSequence')
    const lockIdx = fn.indexOf('isPveLocked')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(fn.indexOf('currentLevel >= bossLockedLevel', lockIdx)).toBeGreaterThan(lockIdx)
    expect(fn.indexOf('captureBossFight(page, runKey', lockIdx)).toBeGreaterThan(lockIdx)
  })

  it('defines a captureBossStatus helper reading boss name/HP from the arena DOM (#705)', () => {
    const fn = requireAsyncFunction('captureBossStatus')
    expect(fn).toContain('.boss-hp-name')
    expect(fn).toContain('.boss-hp-num')
    expect(fn).toContain('boss_name')
    expect(fn).toContain('boss_max_hp')
  })

  it('defines a captureBossFight helper producing a fight_type: boss record (#705)', () => {
    const fn = requireAsyncFunction('captureBossFight')
    expect(fn).toContain("fight_type: 'boss'")
    expect(fn).toContain('monster_name: BOSS_NAME')
    expect(fn).toContain('VICTORY')
  })

  it('runRecord pve_data initializes pve_shifted to false (#705)', () => {
    expect(qaBotSource).toContain('pve_shifted: false')
  })
})

describe('QA Character Replacement Exclusion', () => {
  describe('isCharacterReplacedRun', () => {
    it('detects replacement when final_max_hp < initial_max_hp - 10 (#696)', () => {
      const r: RunRecord = {
        date: '2026-08-13', run: '339', character: 'SWIFTVALE', fights: [], errors: [],
        initial_max_hp: 442, final_max_hp: 213,
      }
      expect(isCharacterReplacedRun(r)).toBe(true)
    })

    it('keeps runs with healthy HP growth (no drop > 10)', () => {
      const r: RunRecord = {
        date: '2026-08-13', run: '341', character: 'RIDERSAGE', fights: [], errors: [],
        initial_max_hp: 224, final_max_hp: 277,
      }
      expect(isCharacterReplacedRun(r)).toBe(false)
    })

    it('detects replacement via character_action created-after-* even without HP data', () => {
      const r: RunRecord = {
        date: '2026-08-13', run: 'r1', character: 'X', fights: [], errors: [],
        character_action: 'created-after-exhausted-energy', replaced_character: 'Y',
      }
      expect(isCharacterReplacedRun(r)).toBe(true)
    })

    it('keeps runs with created-after-* action but no replaced_character', () => {
      const r: RunRecord = {
        date: '2026-08-13', run: 'r2', character: 'X', fights: [], errors: [],
        character_action: 'created-after-exhausted-energy',
      }
      expect(isCharacterReplacedRun(r)).toBe(false)
    })

    it('keeps runs with replaced_character but a non-created-after action', () => {
      const r: RunRecord = {
        date: '2026-08-13', run: 'r3', character: 'X', fights: [], errors: [],
        character_action: 'reused', replaced_character: 'Y',
      }
      expect(isCharacterReplacedRun(r)).toBe(false)
    })
  })

  describe('computeHpAnalysis', () => {
    it('excludes replaced-character runs from the averages and reports the exclusion count (#696)', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-13', run: '339', character: 'SWIFTVALE', fights: [], errors: [],
          initial_max_hp: 442, final_max_hp: 213,
          character_action: 'created-after-exhausted-energy', replaced_character: 'BLACKAGENT',
        },
        {
          date: '2026-08-13', run: '340', character: 'RIDERSAGE', fights: [], errors: [],
          initial_max_hp: 320, final_max_hp: 224,
          character_action: 'created-after-exhausted-energy', replaced_character: 'SWIFTVALE',
        },
        {
          date: '2026-08-13', run: '341', character: 'RIDERSAGE', fights: [], errors: [],
          initial_max_hp: 224, final_max_hp: 277, character_action: 'reused',
        },
      ]
      const result = computeHpAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.runs_with_hp_data).toBe(1)
      expect(result!.runs_excluded_by_character_replacement).toBe(2)
      expect(result!.avg_initial_max_hp).toBe(224)
      expect(result!.avg_final_max_hp).toBe(277)
      expect(result!.avg_hp_growth_per_run).toBe(53)
    })

    it('keeps all runs when no replacement is detected', () => {
      const runs: RunRecord[] = [
        { date: '2026-08-13', run: 'r1', character: 'A', fights: [], errors: [], initial_max_hp: 200, final_max_hp: 220 },
        { date: '2026-08-13', run: 'r2', character: 'B', fights: [], errors: [], initial_max_hp: 300, final_max_hp: 310 },
      ]
      const result = computeHpAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.runs_with_hp_data).toBe(2)
      expect(result!.runs_excluded_by_character_replacement).toBe(0)
      expect(result!.avg_hp_growth_per_run).toBe(15) // (20 + 10) / 2
    })
  })

  describe('analyze-qa-stats.ts source contract', () => {
    it('applies the character-replacement filter to HP/essence analysis and reports excluded runs (#696)', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('runs_excluded_by_character_replacement')
      expect(source).toContain('r.final_max_hp < r.initial_max_hp - 10')
      expect(source).toContain("startsWith('created-after-')")
      expect(source).toContain('allRunsWithEssenceData.filter(r => !isCharacterReplacedRun(r))')
    })
  })
})

describe('QA PvE→Boss Shift Analyzer Contract (#705)', () => {
  it('analyze-qa-stats.ts exposes the pve_shifted flag and boss fight metrics', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
    expect(source).toContain("f.fight_type === 'boss'")
    expect(source).toContain('pve_shifted')
    expect(source).toContain('boss_fights')
    expect(source).toContain('boss_win_rate')
    expect(source).toContain("f.fight_type !== 'pve' && f.fight_type !== 'boss'")
  })
})
