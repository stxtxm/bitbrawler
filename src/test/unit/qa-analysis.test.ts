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

interface IdleFightRecord {
  result: 'victory' | 'defeat'
  xp: number | null
  essence: number | null
  monster?: string | null
}

interface RunRecord {
  date: string
  run: string
  character: string
  fights: FightRecord[]
  idle_fights?: IdleFightRecord[]
  idle_runner?: {
    xp_events?: Array<{ result?: string; xp?: number; monster?: string }>
  }
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
  character_type?: 'fresh' | 'persistent' | null
  final_stats?: { level: number | null; xp: number | null; wins: number | null; losses: number | null } | null
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
  shop?: { essence_before?: number | null; essence_after?: number | null }
  shop_data?: {
    offers?: Array<{ name: string; rarity?: string | null; price: number | null }>
    purchased_offer?: number | null
    essence_after_purchase?: number | null
  }
  essence?: {
    shop_before?: number | null
    shop_after?: number | null
  }
  skipped_fights?: Array<{ index: number; reason: string }>
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

// Corrupted-name guard shared by the analyzer and the QA bot's body-text fallback
// (#710): names that are emoji-only, variation-selector remnants ("\uFE0F ARMOR"),
// or inventory group labels ("WEAPONS", "ARMOR", "ACCESSORIES") must never reach
// equipment_analysis.
const EQUIPMENT_GROUP_LABELS = new Set([
  'WEAPONS', 'ARMOR', 'ACCESSORIES', 'TRINKETS', 'SHIELDS', 'RINGS', 'AMULETS',
  'WANDS', 'STAFFS', 'BOWS', 'DAGGERS', 'HELMETS', 'BOOTS', 'GLOVES', 'CLOAKS', 'ROBES', 'CHARMS',
])

function sanitizeEquippedItemName(name: string): string {
  return String(name)
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s\-–—.:*"'()\[\]{}]+/u, '')
    .replace(/[\s×]+$/u, '')
    .trim()
}

function isEquipmentGroupLabel(name: string): boolean {
  const lettersOnly = String(name).replace(/[^a-zA-Z]/g, '').toUpperCase()
  return EQUIPMENT_GROUP_LABELS.has(lettersOnly)
}

function isValidEquippedItemName(name: string): boolean {
  const sanitized = sanitizeEquippedItemName(name)
  return (
    sanitized.length >= 2 &&
    /[a-zA-Z]/.test(sanitized) &&
    sanitized.toUpperCase() !== 'EMPTY' &&
    !isEquipmentGroupLabel(sanitized)
  )
}

function computeEquipmentAnalysis(runs: RunRecord[]): EquipmentAnalysis | null {
  const runsWithEquipment = runs
    .filter(
      (r) => r.initial_equipment !== null && r.initial_equipment !== undefined && r.initial_equipment.length > 0
    )
    .filter((r) => r.initial_equipment!.some((e) => isValidEquippedItemName(e.name)))
  const runsWithLootboxEquipment = runs
    .filter(
      (r) => r.lootbox_equipment !== null && r.lootbox_equipment !== undefined && r.lootbox_equipment.length > 0
    )
    .filter((r) => r.lootbox_equipment!.some((e) => isValidEquippedItemName(e.name)))
  const allEquippedItems = [
    ...runsWithEquipment.flatMap(r => r.initial_equipment!.map(e => e.name).filter(isValidEquippedItemName)),
    ...runsWithLootboxEquipment.flatMap(r => r.lootbox_equipment!.map(e => e.name).filter(isValidEquippedItemName)),
  ]
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

// ── Shop simulated affordability (mirror of analyze-qa-stats.ts #711) ──
// Real shop purchases are near-impossible for fresh/mid-game QA characters
// (prices 150/250/350 💎 vs avg ~14 💎), so avg_shop_spent stays null and the
// economic balance is blind. We simulate rational purchases from the observed
// offer pool + essence_before: a run "would purchase" when it can afford the
// cheapest offer, and the simulated_purchase_rate proxies the real rate.

interface ShopSimulatedAnalysis {
  runs_with_shop_data: number
  avg_essence_before: number | null
  avg_offer_price: number | null
  min_offer_price: number | null
  max_offer_price: number | null
  offer_rarity_distribution: Record<string, number>
  affordable_offer_count: number
  avg_affordable_offer_count: number | null
  would_purchase_runs: number
  simulated_purchase_rate: number | null
}

function computeShopSimulatedAnalysis(runs: RunRecord[]): ShopSimulatedAnalysis | null {
  const runsWithShopData = runs.filter(
    (r): r is RunRecord & { shop_data: { offers: Array<{ name: string; rarity?: string | null; price: number | null }> } } =>
      r.shop_data?.offers != null && r.shop_data.offers.length > 0
  )
  if (runsWithShopData.length === 0) return null

  const allPrices: number[] = []
  const rarityDist: Record<string, number> = {}
  let affordableTotal = 0
  let wouldPurchaseRuns = 0
  let essenceSum = 0
  let essenceCount = 0

  for (const r of runsWithShopData) {
    const offers = r.shop_data.offers
    const prices = offers
      .map(o => o.price)
      .filter((p): p is number => typeof p === 'number')
    allPrices.push(...prices)

    for (const o of offers) {
      if (o.rarity && typeof o.rarity === 'string' && o.rarity.trim() !== '') {
        const key = o.rarity.toLowerCase()
        rarityDist[key] = (rarityDist[key] || 0) + 1
      }
    }

    const essenceBefore = r.shop?.essence_before ?? r.essence?.shop_before
    if (typeof essenceBefore === 'number') {
      essenceSum += essenceBefore
      essenceCount++
      affordableTotal += prices.filter(p => p <= essenceBefore).length
      if (prices.length > 0 && essenceBefore >= Math.min(...prices)) {
        wouldPurchaseRuns++
      }
    }
  }

  return {
    runs_with_shop_data: runsWithShopData.length,
    avg_essence_before: essenceCount > 0 ? Math.round((essenceSum / essenceCount) * 100) / 100 : null,
    avg_offer_price: allPrices.length > 0
      ? Math.round((allPrices.reduce((s, p) => s + p, 0) / allPrices.length) * 100) / 100
      : null,
    min_offer_price: allPrices.length > 0 ? Math.min(...allPrices) : null,
    max_offer_price: allPrices.length > 0 ? Math.max(...allPrices) : null,
    offer_rarity_distribution: rarityDist,
    affordable_offer_count: affordableTotal,
    avg_affordable_offer_count: essenceCount > 0
      ? Math.round((affordableTotal / essenceCount) * 100) / 100
      : null,
    would_purchase_runs: wouldPurchaseRuns,
    simulated_purchase_rate: Math.round((wouldPurchaseRuns / runsWithShopData.length) * 1000) / 1000,
  }
}

// ── Recent-window alert helpers (mirror of analyze-qa-stats.ts #730) ──
// Issues/suggestions must be computed on a recent window: the all-time
// cumulative rate stays in the report, but stale eras (pre-fix runs) must not
// keep triggering the same false-positive alerts forever.

const RECENT_WINDOW_RUNS = 30
const RECENT_IDLE_RUNS = 15

// Real character stat keys (short labels parsed from the arena panel). The
// structured parse can also capture non-stat counters (e.g. 'fights' from the
// PvE panel) which must not be compared against STATS.MIN_VALUE/MAX_VALUE.
const STAT_KEYS = new Set(['str', 'vit', 'dex', 'luk', 'int', 'foc'])

function isErrorRun(r: RunRecord): boolean {
  return !!r.errors && r.errors.length > 0 && (!r.fights || r.fights.length === 0)
}

function isHalfwayRun(r: RunRecord): boolean {
  return !!r.fights && r.fights.length > 0 && !!r.errors && r.errors.length > 0
}

function computeRecentErrorCounts(
  runs: RunRecord[],
  windowSize = RECENT_WINDOW_RUNS,
): { recent_runs: number; error_runs: number; halfway_runs: number } {
  const recent = runs.slice(-windowSize)
  return {
    recent_runs: recent.length,
    error_runs: recent.filter(isErrorRun).length,
    halfway_runs: recent.filter(isHalfwayRun).length,
  }
}

function collectIdleFights(runs: RunRecord[]): IdleFightRecord[] {
  const fights: IdleFightRecord[] = []
  for (const r of runs) {
    if (r.idle_fights && r.idle_fights.length > 0) {
      fights.push(...r.idle_fights)
    } else if (r.idle_runner?.xp_events?.length) {
      for (const evt of r.idle_runner.xp_events) {
        fights.push({
          result: evt.result?.toUpperCase().includes('VICTORY') ? 'victory' : 'defeat',
          xp: evt.xp ?? null,
          essence: null,
          monster: evt.monster ?? null,
        })
      }
    }
  }
  return fights
}

function computeRecentIdleWinRate(runsWithIdleData: RunRecord[], windowSize = RECENT_IDLE_RUNS): number | null {
  const recentFights = collectIdleFights(runsWithIdleData.slice(-windowSize))
  if (recentFights.length === 0) return null
  return recentFights.filter(f => f.result === 'victory').length / recentFights.length
}

function isStatKey(key: string): boolean {
  return STAT_KEYS.has(key)
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
    const addHandlerIdx = qaBotSource.indexOf('page.addLocatorHandler(')
    expect(addHandlerIdx).toBeGreaterThan(-1)
    const overlayLocatorIdx = qaBotSource.indexOf("page.locator('.inventory-overlay')", addHandlerIdx)
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

  it('testShopSystem opens the inventory modal instead of navigating to the Forge page (#724)', () => {
    // The shop moved from a Forge tab to a tab inside the Inventory modal
    // (InventoryPanel.tsx tabs 🎒 INVENTORY / 🏪 SHOP). The bot must open the
    // inventory via the arena header button and find the SHOP tab there, not
    // navigate to /forge and look for a non-existent Shop tab.
    const fn = requireAsyncFunction('testShopSystem')
    expect(fn).not.toContain('navigateToForge(page)')
    expect(fn).toContain("button[aria-label=\"Inventory\"]")
    expect(fn).toContain('.inventory-overlay')
    expect(fn).toContain('button[role="tab"]:has-text("SHOP")')
    expect(fn).not.toContain('.forge-tab:has-text("Shop")')
  })

  it('testShopSystem suppresses the inventory overlay handler before opening the modal and re-arms it on every exit path (#724)', () => {
    // The .inventory-overlay locator handler dismisses the overlay on EVERY
    // Playwright action while it is visible (#637/#645/#710). Opening the
    // inventory to reach the shop would deadlock unless the handler is
    // suppressed for the whole read and re-armed on every exit path.
    const fn = requireAsyncFunction('testShopSystem')
    const setIdx = fn.indexOf('suppressInventoryHandler = true')
    const invBtnClickIdx = fn.indexOf('invBtn.click()')
    expect(setIdx).toBeGreaterThan(-1)
    expect(setIdx).toBeLessThan(invBtnClickIdx)
    const afterSet = fn.slice(setIdx)
    const returnsAfter = (afterSet.match(/\breturn (?:shopResult|createSkippedShopResult)/g) || []).length
    const unsets = (afterSet.match(/suppressInventoryHandler = false/g) || []).length
    expect(returnsAfter).toBeGreaterThan(0)
    expect(unsets).toBe(returnsAfter)
  })

  it('testShopSystem closes the inventory modal (not leaveForge) after the shop read (#724)', () => {
    const fn = requireAsyncFunction('testShopSystem')
    expect(fn).not.toContain('leaveForge(page)')
    expect(fn).toContain('button[aria-label="Close inventory"], .inventory-close')
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

describe('QA Shop Simulated Affordability Analysis (#711)', () => {
  describe('computeShopSimulatedAnalysis', () => {
    it('returns null when no run has shop_data with offers', () => {
      const runs: RunRecord[] = [
        { date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [], shop_data: { offers: [] } },
        { date: '2026-08-16', run: 'r2', character: 'B', fights: [], errors: [] },
      ]
      expect(computeShopSimulatedAnalysis(runs)).toBeNull()
    })

    it('counts affordable offers per run (price <= essence_before)', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [],
          shop: { essence_before: 200 },
          shop_data: {
            offers: [
              { name: 'Marchandise', rarity: 'common', price: 150 },
              { name: 'Pièce rare', rarity: 'rare', price: 250 },
              { name: 'Coffre mystère', rarity: 'epic', price: 350 },
            ],
          },
        },
      ]
      const result = computeShopSimulatedAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.runs_with_shop_data).toBe(1)
      expect(result!.affordable_offer_count).toBe(1)
      expect(result!.avg_affordable_offer_count).toBe(1)
      expect(result!.would_purchase_runs).toBe(1)
      expect(result!.simulated_purchase_rate).toBe(1)
    })

    it('marks a run as would_purchase when essence_before >= cheapest offer price', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [],
          shop: { essence_before: 150 },
          shop_data: {
            offers: [
              { name: 'Marchandise', rarity: 'common', price: 150 },
              { name: 'Pièce rare', rarity: 'rare', price: 250 },
            ],
          },
        },
        {
          date: '2026-08-16', run: 'r2', character: 'B', fights: [], errors: [],
          shop: { essence_before: 40 },
          shop_data: {
            offers: [
              { name: 'Marchandise', rarity: 'common', price: 150 },
              { name: 'Pièce rare', rarity: 'rare', price: 250 },
            ],
          },
        },
      ]
      const result = computeShopSimulatedAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.would_purchase_runs).toBe(1)
      expect(result!.simulated_purchase_rate).toBe(0.5)
      expect(result!.affordable_offer_count).toBe(1)
    })

    it('computes the simulated_purchase_rate across all runs with shop_data', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [],
          shop: { essence_before: 500 },
          shop_data: { offers: [{ name: 'Item', rarity: 'rare', price: 200 }] },
        },
        {
          date: '2026-08-16', run: 'r2', character: 'B', fights: [], errors: [],
          shop: { essence_before: 100 },
          shop_data: { offers: [{ name: 'Item', rarity: 'rare', price: 200 }] },
        },
        {
          date: '2026-08-16', run: 'r3', character: 'C', fights: [], errors: [],
          shop: { essence_before: 220 },
          shop_data: { offers: [{ name: 'Item', rarity: 'rare', price: 200 }] },
        },
      ]
      const result = computeShopSimulatedAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.would_purchase_runs).toBe(2)
      expect(result!.simulated_purchase_rate).toBe(0.667) // Math.round(2/3 * 1000) / 1000
      expect(result!.avg_essence_before).toBe(273.33)
    })

    it('aggregates the offer pool: avg/min/max price and rarity distribution', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [],
          shop: { essence_before: 300 },
          shop_data: {
            offers: [
              { name: 'Marchandise', rarity: 'common', price: 150 },
              { name: 'Pièce rare', rarity: 'RARE', price: 250 },
              { name: 'Coffre mystère', rarity: 'epic', price: 350 },
            ],
          },
        },
        {
          date: '2026-08-16', run: 'r2', character: 'B', fights: [], errors: [],
          shop: { essence_before: 400 },
          shop_data: {
            offers: [
              { name: 'Marchandise', rarity: 'common', price: 150 },
              { name: 'Pièce rare', rarity: 'rare', price: 250 },
            ],
          },
        },
      ]
      const result = computeShopSimulatedAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.avg_offer_price).toBe(230) // (150+250+350+150+250) / 5
      expect(result!.min_offer_price).toBe(150)
      expect(result!.max_offer_price).toBe(350)
      expect(result!.offer_rarity_distribution).toEqual({ common: 2, rare: 2, epic: 1 })
    })

    it('falls back to essence.shop_before when shop.essence_before is missing', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [],
          essence: { shop_before: 180 },
          shop_data: { offers: [{ name: 'Item', rarity: 'common', price: 150 }] },
        },
      ]
      const result = computeShopSimulatedAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.avg_essence_before).toBe(180)
      expect(result!.would_purchase_runs).toBe(1)
    })

    it('ignores offers with null price but keeps runs with valid prices', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [],
          shop: { essence_before: 200 },
          shop_data: {
            offers: [
              { name: 'Unparsed', rarity: null, price: null },
              { name: 'Marchandise', rarity: 'common', price: 150 },
            ],
          },
        },
      ]
      const result = computeShopSimulatedAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.avg_offer_price).toBe(150)
      expect(result!.affordable_offer_count).toBe(1)
      expect(result!.would_purchase_runs).toBe(1)
    })

    it('keeps runs without essence_before in the denominator but not in would_purchase', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [],
          shop: { essence_before: null },
          shop_data: { offers: [{ name: 'Item', rarity: 'common', price: 150 }] },
        },
        {
          date: '2026-08-16', run: 'r2', character: 'B', fights: [], errors: [],
          shop: { essence_before: 200 },
          shop_data: { offers: [{ name: 'Item', rarity: 'common', price: 150 }] },
        },
      ]
      const result = computeShopSimulatedAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.runs_with_shop_data).toBe(2)
      expect(result!.would_purchase_runs).toBe(1)
      expect(result!.simulated_purchase_rate).toBe(0.5)
      expect(result!.avg_essence_before).toBe(200)
      expect(result!.avg_affordable_offer_count).toBe(1)
    })

    it('handles no offer prices at all (all null)', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-16', run: 'r1', character: 'A', fights: [], errors: [],
          shop: { essence_before: 200 },
          shop_data: { offers: [{ name: 'X', rarity: null, price: null }] },
        },
      ]
      const result = computeShopSimulatedAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.avg_offer_price).toBeNull()
      expect(result!.min_offer_price).toBeNull()
      expect(result!.max_offer_price).toBeNull()
      expect(result!.affordable_offer_count).toBe(0)
      expect(result!.would_purchase_runs).toBe(0)
      expect(result!.simulated_purchase_rate).toBe(0)
    })
  })

  describe('analyze-qa-stats.ts source contract (#711)', () => {
    it('exposes shop.simulated with affordability metrics and a purchase-rate suggestion', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('shop_data?.offers')
      expect(source).toContain('affordable_offer_count')
      expect(source).toContain('would_purchase_runs')
      expect(source).toContain('simulated_purchase_rate')
      expect(source).toContain('offer_rarity_distribution')
      expect(source).toContain('simulated: shopSimulated')
      expect(source).toContain('r.shop?.essence_before ?? r.essence?.shop_before')
    })
  })
})

describe('QA Equipment Name Sanitization Contract (#710)', () => {
  it('rejects emoji-only and variation-selector-only names', () => {
    expect(isValidEquippedItemName('⚔️')).toBe(false)
    expect(isValidEquippedItemName('🛡️')).toBe(false)
    expect(isValidEquippedItemName('🔮')).toBe(false)
    expect(isValidEquippedItemName('\uFE0F')).toBe(false)
    expect(isValidEquippedItemName('️')).toBe(false)
  })

  it('rejects empty and EMPTY slot markers', () => {
    expect(isValidEquippedItemName('')).toBe(false)
    expect(isValidEquippedItemName('EMPTY')).toBe(false)
    expect(isValidEquippedItemName('  ')).toBe(false)
  })

  it('rejects inventory group labels that the body-text fallback captures as item names', () => {
    expect(isValidEquippedItemName('WEAPONS')).toBe(false)
    expect(isValidEquippedItemName('ARMOR')).toBe(false)
    expect(isValidEquippedItemName('ACCESSORIES')).toBe(false)
    expect(isValidEquippedItemName('⚔️ WEAPONS')).toBe(false)
    expect(isValidEquippedItemName('🛡️ ARMOR')).toBe(false)
    expect(isValidEquippedItemName('💍 ACCESSORIES')).toBe(false)
  })

  it('sanitizes leading emoji/variation-selector remnants and accepts real item names', () => {
    expect(sanitizeEquippedItemName('\uFE0F ARMOR')).toBe('ARMOR')
    expect(isValidEquippedItemName('\uFE0F ARMOR')).toBe(false) // group label after sanitize
    expect(isValidEquippedItemName('Iron Sword')).toBe(true)
    expect(isValidEquippedItemName('Leather Vest')).toBe(true)
    expect(isValidEquippedItemName('Voidreaper')).toBe(true)
    expect(isValidEquippedItemName('Heaven\'s Edge')).toBe(true)
  })

  it('strips the unequip button × from names rendered on the same line', () => {
    expect(sanitizeEquippedItemName('Iron Sword ×')).toBe('Iron Sword')
    expect(sanitizeEquippedItemName('⚔️ Iron Sword ×')).toBe('Iron Sword')
    expect(isValidEquippedItemName('Iron Sword ×')).toBe(true)
  })

  it('filters corrupted names out of computeEquipmentAnalysis (mirror of analyzer #710)', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-08-16', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [
          { slot: 'shield', name: '\uFE0F ARMOR' },
          { slot: 'weapon', name: 'Iron Sword' },
        ],
        lootbox_equipment: [
          { slot: 'accessory', name: 'ACCESSORIES' },
        ],
      },
      {
        date: '2026-08-16', run: 'r2', character: 'C2', fights: [], errors: [],
        initial_equipment: [
          { slot: 'armor', name: '⚔️' },
        ],
      },
    ]
    const result = computeEquipmentAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.runs_with_data).toBe(1)
    expect(result!.unique_item_count).toBe(1)
    expect(result!.item_names).toEqual(['Iron Sword'])
  })

  it('returns null when every equipment name is corrupted', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-08-16', run: 'r1', character: 'C1', fights: [], errors: [],
        initial_equipment: [{ slot: 'armor', name: '️ ARMOR' }],
      },
    ]
    expect(computeEquipmentAnalysis(runs)).toBeNull()
  })
})

describe('QA Bot Equipment Parse Contract (#710)', () => {
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

  it('parseEquippedItems suppresses the inventory overlay handler before opening inventory and re-arms on every exit (#710)', () => {
    const fn = requireAsyncFunction('parseEquippedItems')
    const setIdx = fn.indexOf('suppressInventoryHandler = true')
    expect(setIdx).toBeGreaterThan(-1)
    // The flag must be armed before any attempt to open/read the inventory.
    const clickIdx = fn.indexOf('invBtn.click()')
    expect(setIdx).toBeLessThan(clickIdx)
    const afterSet = fn.slice(setIdx)
    const returnsAfter = (afterSet.match(/return /g) || []).length
    const unsets = (afterSet.match(/suppressInventoryHandler = false/g) || []).length
    expect(returnsAfter).toBeGreaterThan(0)
    expect(unsets).toBe(returnsAfter)
  })

  it('parseEquippedItems skips the button click when the inventory overlay is already open (#710)', () => {
    const fn = requireAsyncFunction('parseEquippedItems')
    expect(fn).toContain("page.locator('.inventory-overlay').first().isVisible")
    expect(fn).toContain('alreadyOpen')
  })

  it('parseEquippedItems reads equipped names from .inv-loadout-item-name and .inv-loadout-slot.filled (current InventoryPanel DOM)', () => {
    const fn = requireAsyncFunction('parseEquippedItems')
    expect(fn).toContain("'.inv-loadout-slot.filled'")
    expect(fn).toContain("'.inv-loadout-item-name'")
    expect(fn).toContain("'.inv-loadout-slot-icon'")
  })

  it('parseStreak suppresses the inventory overlay handler before opening inventory and re-arms on every exit (#710)', () => {
    const fn = requireAsyncFunction('parseStreak')
    const setIdx = fn.indexOf('suppressInventoryHandler = true')
    expect(setIdx).toBeGreaterThan(-1)
    const clickIdx = fn.indexOf('invBtn.click()')
    expect(setIdx).toBeLessThan(clickIdx)
    const afterSet = fn.slice(setIdx)
    const returnsAfter = (afterSet.match(/return /g) || []).length
    const unsets = (afterSet.match(/suppressInventoryHandler = false/g) || []).length
    expect(returnsAfter).toBeGreaterThan(0)
    expect(unsets).toBe(returnsAfter)
  })

  it('parseEquippedItemsFromBody sanitizes names and rejects group labels before pushing items (#710)', () => {
    const fn = requireAsyncFunction('parseEquippedItemsFromBody')
    expect(fn).toContain('sanitizeItemName')
    expect(fn).toContain('isEquipmentGroupLabel')
    // The group-label set lives at module scope (before parseEquippedItems) and
    // the fallback must reject both the label words and their emoji-prefixed forms.
    const helpersStart = qaBotSource.indexOf('const EQUIPMENT_GROUP_LABELS')
    expect(helpersStart).toBeGreaterThan(-1)
    const helpersBlock = qaBotSource.slice(helpersStart, helpersStart + 400)
    expect(helpersBlock).toContain('WEAPONS')
    expect(helpersBlock).toContain('ARMOR')
    expect(helpersBlock).toContain('ACCESSORIES')
  })

  it('parseEquippedItemsFromBody logs the EQUIPPED section text when it yields nothing (#710)', () => {
    const fn = requireAsyncFunction('parseEquippedItemsFromBody')
    expect(fn).toContain('EQUIPPED section')
  })

  it('parseEquippedItemsFromBody peeks the next line for the item name when the icon line has no text (#710)', () => {
    const fn = requireAsyncFunction('parseEquippedItemsFromBody')
    expect(fn).toContain('next')
    expect(fn).toContain('lines[li')
  })

  it('analyze-qa-stats.ts filters corrupted equipment names before aggregating (#710)', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
    expect(source).toContain('isValidEquippedItemName')
    expect(source).toContain('EQUIPMENT_GROUP_LABELS')
    expect(source).toContain('filter')
  })
})

describe('QA Recent-Window Alert Analysis (#730)', () => {
  describe('computeRecentErrorCounts', () => {
    it('uses only the last 30 runs so stale all-time failures do not trigger alerts', () => {
      const runs: RunRecord[] = []
      for (let i = 0; i < 20; i++) {
        runs.push({ date: '2026-08-18', run: `old-${i}`, character: 'C', fights: [], errors: ['boom'] })
      }
      for (let i = 0; i < 30; i++) {
        runs.push({
          date: '2026-08-18', run: `new-${i}`, character: 'C',
          fights: [{ result: 'victory', xp: 90, fight_duration_ms: 1000 }],
          errors: [],
        })
      }
      const counts = computeRecentErrorCounts(runs)
      expect(counts.recent_runs).toBe(30)
      expect(counts.error_runs).toBe(0)
      expect(counts.halfway_runs).toBe(0)
    })

    it('flags errors when the recent window itself has a high failure rate', () => {
      const runs: RunRecord[] = []
      for (let i = 0; i < 12; i++) {
        runs.push({ date: '2026-08-18', run: `err-${i}`, character: 'C', fights: [], errors: ['timeout'] })
      }
      for (let i = 0; i < 18; i++) {
        runs.push({
          date: '2026-08-18', run: `ok-${i}`, character: 'C',
          fights: [{ result: 'victory', xp: 90, fight_duration_ms: 1000 }],
          errors: [],
        })
      }
      const counts = computeRecentErrorCounts(runs)
      expect(counts.recent_runs).toBe(30)
      expect(counts.error_runs).toBe(12)
      expect(counts.error_runs / counts.recent_runs).toBeGreaterThan(0.3)
    })

    it('counts halfway (partial) runs separately in the recent window', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-18', run: 'partial', character: 'C',
          fights: [{ result: 'victory', xp: 90, fight_duration_ms: 1000 }],
          errors: ['mid-run failure'],
        },
        {
          date: '2026-08-18', run: 'ok', character: 'C',
          fights: [{ result: 'victory', xp: 90, fight_duration_ms: 1000 }],
          errors: [],
        },
      ]
      const counts = computeRecentErrorCounts(runs)
      expect(counts.halfway_runs).toBe(1)
      expect(counts.error_runs).toBe(0)
    })

    it('returns zero counts when there are no runs at all', () => {
      const counts = computeRecentErrorCounts([])
      expect(counts.recent_runs).toBe(0)
      expect(counts.error_runs).toBe(0)
      expect(counts.halfway_runs).toBe(0)
    })
  })

  describe('computeRecentIdleWinRate', () => {
    it('computes the win rate over the last 15 runs that have idle data, ignoring older eras', () => {
      const runs: RunRecord[] = []
      for (let i = 0; i < 5; i++) {
        runs.push({
          date: '2026-08-18', run: `old-${i}`, character: 'C', fights: [], errors: [],
          idle_fights: [{ result: 'defeat', xp: 10, essence: 0 }],
        })
      }
      for (let i = 0; i < 10; i++) {
        runs.push({
          date: '2026-08-18', run: `new-w-${i}`, character: 'C', fights: [], errors: [],
          idle_fights: [{ result: 'victory', xp: 20, essence: 0 }],
        })
      }
      for (let i = 0; i < 5; i++) {
        runs.push({
          date: '2026-08-18', run: `new-l-${i}`, character: 'C', fights: [], errors: [],
          idle_fights: [{ result: 'defeat', xp: 10, essence: 0 }],
        })
      }
      const rate = computeRecentIdleWinRate(runs)
      expect(rate).not.toBeNull()
      expect(rate).toBeCloseTo(10 / 15, 5)
    })

    it('returns null when no recent idle data exists', () => {
      const runs: RunRecord[] = [
        { date: '2026-08-18', run: 'r1', character: 'C', fights: [], errors: [] },
      ]
      expect(computeRecentIdleWinRate(runs)).toBeNull()
    })

    it('falls back to legacy idle_runner xp_events when idle_fights is missing', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-18', run: 'legacy1', character: 'C', fights: [], errors: [],
          idle_runner: { xp_events: [{ result: 'VICTORY', xp: 25 }] },
        },
        {
          date: '2026-08-18', run: 'legacy2', character: 'C', fights: [], errors: [],
          idle_runner: { xp_events: [{ result: 'defeat', xp: 10 }] },
        },
      ]
      const rate = computeRecentIdleWinRate(runs)
      expect(rate).not.toBeNull()
      expect(rate).toBe(0.5)
    })
  })

  describe('isStatKey', () => {
    it('treats the six character stats as stat keys', () => {
      for (const key of ['str', 'vit', 'dex', 'luk', 'int', 'foc']) {
        expect(isStatKey(key)).toBe(true)
      }
    })

    it('excludes non-stat counters captured by the structured parse (fights)', () => {
      expect(isStatKey('fights')).toBe(false)
      expect(isStatKey('monster')).toBe(false)
    })
  })

  describe('analyze-qa-stats.ts source contract (#730)', () => {
    it('alerts on a recent error-rate window instead of the all-time cumulative rate', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('stats.slice(-RECENT_WINDOW_RUNS)')
      expect(source).toContain('recentRuns.filter(isErrorRun)')
      expect(source).toContain('recentRuns.filter(isHalfwayRun)')
    })

    it('gates the PvE XP ratio suggestion behind !pve_analysis.pve_shifted', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('pveAnalysis.total_fights >= 3 && !pveAnalysis.pve_shifted')
    })

    it('skips non-stat keys (fights) in the stats balance suggestions', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('STAT_KEYS.has(key)')
      expect(source).toContain("'str', 'vit', 'dex', 'luk', 'int', 'foc'")
    })

    it('uses a recent idle-data window for the idle win-rate suggestion', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('runsWithIdleData.slice(-RECENT_IDLE_RUNS)')
      expect(source).toContain('collectIdleFights(recentIdleRuns)')
    })

    it('annotates the XP win/loss ratio suggestion as a matchmaking symptom (#570/#725)', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('#570/#725')
    })
  })
})

describe('QA Persistent Character Classification (#731)', () => {
  // Mirrors analyze-qa-stats.ts: a persistent run uses the dedicated QA
  // character (character_type === 'persistent'); fresh runs calibrate the
  // first-session experience. Legacy runs have no character_type at all.
  function isPersistentRun(r: RunRecord): boolean {
    return r.character_type === 'persistent'
  }

  interface CharacterTypeBreakdown {
    fresh_runs: number
    persistent_runs: number
    unknown_runs: number
  }

  function computeCharacterTypeBreakdown(runs: RunRecord[]): CharacterTypeBreakdown {
    let fresh = 0
    let persistent = 0
    let unknown = 0
    for (const r of runs) {
      if (r.character_type === 'persistent') persistent++
      else if (r.character_type === 'fresh') fresh++
      else unknown++
    }
    return { fresh_runs: fresh, persistent_runs: persistent, unknown_runs: unknown }
  }

  function computePersistentLevelDistribution(runs: RunRecord[]): Record<string, number> {
    const dist: Record<string, number> = {}
    for (const r of runs) {
      if (r.character_type !== 'persistent') continue
      if (r.final_stats?.level !== null && r.final_stats?.level !== undefined) {
        const key = `lvl-${r.final_stats.level}`
        dist[key] = (dist[key] || 0) + 1
      }
    }
    return dist
  }

  describe('isPersistentRun', () => {
    it('classifies runs with character_type persistent', () => {
      const r: RunRecord = {
        date: '2026-08-18', run: 'r1', character: 'QA-PERSIST', fights: [], errors: [],
        character_type: 'persistent',
      }
      expect(isPersistentRun(r)).toBe(true)
    })

    it('does not classify fresh or legacy runs as persistent', () => {
      const fresh: RunRecord = {
        date: '2026-08-18', run: 'r2', character: 'FRESHWAVE', fights: [], errors: [],
        character_type: 'fresh',
      }
      const legacy: RunRecord = {
        date: '2026-08-18', run: 'r3', character: 'OLDTIMER', fights: [], errors: [],
      }
      expect(isPersistentRun(fresh)).toBe(false)
      expect(isPersistentRun(legacy)).toBe(false)
    })
  })

  describe('computeCharacterTypeBreakdown', () => {
    it('counts fresh, persistent and unknown runs separately', () => {
      const runs: RunRecord[] = [
        { date: '2026-08-18', run: 'p1', character: 'QA-PERSIST', fights: [], errors: [], character_type: 'persistent' },
        { date: '2026-08-18', run: 'p2', character: 'QA-PERSIST', fights: [], errors: [], character_type: 'persistent' },
        { date: '2026-08-18', run: 'f1', character: 'FRESHGUY', fights: [], errors: [], character_type: 'fresh' },
        { date: '2026-08-18', run: 'legacy', character: 'OLDTIMER', fights: [], errors: [] },
      ]
      const breakdown = computeCharacterTypeBreakdown(runs)
      expect(breakdown.persistent_runs).toBe(2)
      expect(breakdown.fresh_runs).toBe(1)
      expect(breakdown.unknown_runs).toBe(1)
    })

    it('returns zeros for empty input', () => {
      expect(computeCharacterTypeBreakdown([])).toEqual({
        fresh_runs: 0,
        persistent_runs: 0,
        unknown_runs: 0,
      })
    })
  })

  describe('computePersistentLevelDistribution', () => {
    it('only includes persistent runs so mid-game levels are visible (#712)', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-08-18', run: 'p1', character: 'QA-PERSIST', fights: [], errors: [],
          character_type: 'persistent', final_stats: { level: 15, xp: 0, wins: null, losses: null },
        },
        {
          date: '2026-08-18', run: 'p2', character: 'QA-PERSIST', fights: [], errors: [],
          character_type: 'persistent', final_stats: { level: 22, xp: 0, wins: null, losses: null },
        },
        {
          date: '2026-08-18', run: 'f1', character: 'FRESHGUY', fights: [], errors: [],
          character_type: 'fresh', final_stats: { level: 5, xp: 0, wins: null, losses: null },
        },
      ]
      expect(computePersistentLevelDistribution(runs)).toEqual({ 'lvl-15': 1, 'lvl-22': 1 })
    })

    it('returns an empty object when no persistent run has a final level', () => {
      const runs: RunRecord[] = [
        { date: '2026-08-18', run: 'f1', character: 'FRESHGUY', fights: [], errors: [], character_type: 'fresh', final_stats: { level: 5, xp: 0, wins: null, losses: null } },
      ]
      expect(computePersistentLevelDistribution(runs)).toEqual({})
    })
  })

  describe('analyze-qa-stats.ts source contract (#731)', () => {
    it('exposes character_type classification, breakdown and persistent level distribution', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('character_type')
      expect(source).toContain('isPersistentRun')
      expect(source).toContain('character_type_breakdown')
      expect(source).toContain('persistent_level_distribution')
    })
  })

  describe('qa-bot.mjs source contract (#731)', () => {
    const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

    it('implements conditional persistent-character creation with a fixed name', () => {
      expect(qaBotSource).toContain('loginOrCreatePersistentCharacter')
      expect(qaBotSource).toContain('createCharacterWithName')
    })

    it('records character_type on run records (persistent vs fresh)', () => {
      expect(qaBotSource).toContain('character_type')
      expect(qaBotSource).toContain("runRecord.character_type = 'persistent'")
      expect(qaBotSource).toContain("runRecord.character_type = 'fresh'")
    })

    it('skips character replacement when the persistent fighter is exhausted', () => {
      // The persistent character must never be swapped for a random fresh one
      // mid-run, otherwise its accumulated equipment/streak/essence is lost.
      expect(qaBotSource).toContain("runRecord.character_type === 'persistent'")
    })

    it('respects the weekly fresh-character day for first-session calibration', () => {
      expect(qaBotSource).toContain('getZonedWeekday')
      expect(qaBotSource).toContain('config.freshCharacterDay')
    })

    it('persists generation, created_at and the reset flag for controlled reset', () => {
      expect(qaBotSource).toContain('persistent_generation')
      expect(qaBotSource).toContain('persistent_created_at')
      expect(qaBotSource).toContain('persistent_reset_ready')
    })

    it('resets the persistent fighter once it reaches the configured max level', () => {
      expect(qaBotSource).toContain('config.persistentCharacterMaxLevel')
    })
  })
})

describe('QA Idle Essence Per-Fight (#773)', () => {
  interface IdleFightRecordWithEssence {
    result: 'victory' | 'defeat'
    xp: number | null
    essence: number | null
    monster?: string | null
  }

  interface IdleEssenceRun {
    date: string
    run: string
    character: string
    fights: FightRecord[]
    idle_fights?: IdleFightRecordWithEssence[]
    idle_runner?: { xp_events?: Array<{ result?: string; xp?: number; monster?: string; essence?: number | null }> }
    essence?: { flow?: { idle_gained?: number | null } }
    errors: string[]
  }

  function collectIdleFightsForTest(runs: IdleEssenceRun[]): IdleFightRecordWithEssence[] {
    const fights: IdleFightRecordWithEssence[] = []
    for (const r of runs) {
      if (r.idle_fights && r.idle_fights.length > 0) {
        fights.push(...r.idle_fights)
      } else if (r.idle_runner?.xp_events?.length) {
        for (const evt of r.idle_runner.xp_events) {
          fights.push({
            result: evt.result?.toUpperCase().includes('VICTORY') ? 'victory' : 'defeat',
            xp: evt.xp ?? null,
            essence: (evt as { essence?: number | null }).essence ?? null,
            monster: evt.monster ?? null,
          })
        }
      }
    }
    return fights
  }

  function computeIdleAnalysisForTest(runs: IdleEssenceRun[]): { avg_idle_essence_per_fight: number; total_idle_essence: number; runs_with_idle_data: number; total_idle_fights: number } | null {
    const runsWithIdleData = runs.filter(r =>
      (r.idle_fights && r.idle_fights.length > 0) ||
      (r.idle_runner?.xp_events && r.idle_runner.xp_events.length > 0)
    )
    const allIdleFights = collectIdleFightsForTest(runsWithIdleData)
    if (runsWithIdleData.length === 0 || allIdleFights.length === 0) return null
    const idleEssenceFights = allIdleFights.filter((f): f is IdleFightRecordWithEssence & { essence: number } => f.essence !== null)
    if (idleEssenceFights.length > 0) {
      const total = idleEssenceFights.reduce((s, f) => s + f.essence, 0)
      return {
        runs_with_idle_data: runsWithIdleData.length,
        total_idle_fights: allIdleFights.length,
        avg_idle_essence_per_fight: Math.round((total / idleEssenceFights.length) * 100) / 100,
        total_idle_essence: Math.round(total * 100) / 100,
      }
    }
    const flowTotals = runsWithIdleData
      .map(r => r.essence?.flow?.idle_gained)
      .filter((v): v is number => typeof v === 'number')
    const totalFromFlow = flowTotals.reduce((s, v) => s + v, 0)
    const avgFromFlow = allIdleFights.length > 0 ? Math.round((totalFromFlow / allIdleFights.length) * 100) / 100 : 0
    return {
      runs_with_idle_data: runsWithIdleData.length,
      total_idle_fights: allIdleFights.length,
      avg_idle_essence_per_fight: Number.isFinite(avgFromFlow) ? avgFromFlow : 0,
      total_idle_essence: Number.isFinite(totalFromFlow) ? Math.round(totalFromFlow * 100) / 100 : 0,
    }
  }

  it('computes avg and total from per-fight essence when available', () => {
    const runs: IdleEssenceRun[] = [
      {
        date: '2026-08-23', run: 'r1', character: 'A', fights: [], errors: [],
        idle_fights: [
          { result: 'victory', xp: 45, essence: 0.12, monster: 'wraith' },
          { result: 'victory', xp: 47, essence: 0.12, monster: 'slime' },
          { result: 'victory', xp: 44, essence: 0.04, monster: 'goblin' },
        ],
      },
    ]
    const result = computeIdleAnalysisForTest(runs)
    expect(result).not.toBeNull()
    expect(result!.total_idle_essence).toBeCloseTo(0.28, 2)
    expect(result!.avg_idle_essence_per_fight).toBeCloseTo(0.09, 2)
    expect(Number.isFinite(result!.avg_idle_essence_per_fight)).toBe(true)
  })

  it('falls back to flow.idle_gained when per-fight essence is null (avoids NaN)', () => {
    const runs: IdleEssenceRun[] = [
      {
        date: '2026-08-23', run: 'r1', character: 'A', fights: [], errors: [],
        idle_fights: [
          { result: 'victory', xp: 45, essence: null, monster: 'wraith' },
          { result: 'victory', xp: 47, essence: null, monster: 'slime' },
          { result: 'victory', xp: 44, essence: null, monster: 'goblin' },
        ],
        essence: { flow: { idle_gained: 0.24 } },
      },
    ]
    const result = computeIdleAnalysisForTest(runs)
    expect(result).not.toBeNull()
    expect(Number.isFinite(result!.avg_idle_essence_per_fight)).toBe(true)
    expect(Number.isNaN(result!.avg_idle_essence_per_fight)).toBe(false)
    expect(result!.total_idle_essence).toBeCloseTo(0.24, 2)
    expect(result!.avg_idle_essence_per_fight).toBeCloseTo(0.08, 2)
  })

  it('returns 0/0 not NaN/null when no per-fight and no flow data', () => {
    const runs: IdleEssenceRun[] = [
      {
        date: '2026-08-23', run: 'r1', character: 'A', fights: [], errors: [],
        idle_fights: [
          { result: 'victory', xp: 45, essence: null, monster: 'wraith' },
        ],
      },
    ]
    const result = computeIdleAnalysisForTest(runs)
    expect(result).not.toBeNull()
    expect(Number.isFinite(result!.avg_idle_essence_per_fight)).toBe(true)
    expect(Number.isFinite(result!.total_idle_essence)).toBe(true)
    expect(result!.avg_idle_essence_per_fight).toBe(0)
    expect(result!.total_idle_essence).toBe(0)
  })

  it('handles legacy idle_runner xp_events with essence', () => {
    const runs: IdleEssenceRun[] = [
      {
        date: '2026-08-23', run: 'r1', character: 'A', fights: [], errors: [],
        idle_runner: { xp_events: [{ result: 'VICTORY', xp: 45, monster: 'goblin', essence: 0.11 }] },
      },
    ]
    const result = computeIdleAnalysisForTest(runs)
    expect(result).not.toBeNull()
    expect(result!.total_idle_essence).toBeCloseTo(0.11, 2)
  })

  describe('analyze-qa-stats.ts source contract (#773)', () => {
    it('collectIdleFights preserves essence and idleAnalysis falls back to flow without NaN', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('idleEssenceFights')
      expect(source).toContain('flow.idle_gained')
      expect(source).toContain('Number.isFinite')
      expect(source).toContain('essence')
    })
  })

  describe('qa-bot.mjs source contract (#773)', () => {
    const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

    it('observeIdleCombat or run() captures essence per idle fight (not just xp)', () => {
      expect(qaBotSource).toContain('essence')
      expect(qaBotSource).toContain('idle_fights')
      const hasEssencePerFight = qaBotSource.includes('essence:') && qaBotSource.includes('idle_fights')
      expect(hasEssencePerFight).toBe(true)
    })

    it('distributes essence_before/after delta across idle_fights when per-fight ticker unavailable', () => {
      expect(qaBotSource).toContain('before_idle')
      expect(qaBotSource).toContain('after_idle')
      expect(qaBotSource).toContain('idle_gained')
    })

    it('run() assigns essence to each idle_fight entry (weighted by victory/defeat)', () => {
      expect(qaBotSource).toMatch(/idle_fights.*essence|essence.*idle_fights/s)
    })
  })
})

describe('QA Bot Skip Classification Contract (#812)', () => {
  const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  function extractFunction(source: string, name: string): string | null {
    const asyncStart = source.indexOf(`async function ${name}(`)
    const syncStart = source.indexOf(`function ${name}(`)
    const start =
      syncStart === -1 || (asyncStart !== -1 && asyncStart < syncStart) ? asyncStart : syncStart
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

  it('initializes a skipped_fights array on the run record (#812)', () => {
    expect(qaBotSource).toContain('skipped_fights: []')
  })

  it('defines a recordSkippedFight helper pushing {index, reason} without touching errors (#812)', () => {
    const fn = extractFunction(qaBotSource, 'recordSkippedFight')
    expect(fn).not.toBeNull()
    expect(fn).toContain('skipped_fights.push({ index, reason })')
    expect(fn).not.toContain('errors.push')
  })

  it('polls for the No opponents found matchmaking modal during result waiting (#812)', () => {
    const fn = extractFunction(qaBotSource, 'runFightSequence')
    expect(fn).not.toBeNull()
    expect(fn).toContain("text.includes('No opponents found')")
  })

  it('classifies the matchmaking modal as skipped/no_opponents BEFORE falling through to the timeout error (#812)', () => {
    const fn = extractFunction(qaBotSource, 'runFightSequence')
    const noOpponentsIdx = fn!.indexOf("'no_opponents'")
    expect(noOpponentsIdx).toBeGreaterThan(-1)
    const timeoutErrIdx = fn!.indexOf('errors.push(`Fight ${i + 1}: timeout waiting for result')
    expect(timeoutErrIdx).toBeGreaterThan(noOpponentsIdx)
  })

  it('closes the leftover matchmaking modal via dismissModals before continuing (#812)', () => {
    const fn = extractFunction(qaBotSource, 'runFightSequence')!
    const skipIdx = fn.indexOf("'no_opponents'")
    expect(skipIdx).toBeGreaterThan(-1)
    const dismissIdx = fn.indexOf('dismissModals(page)', skipIdx)
    expect(dismissIdx).toBeGreaterThan(-1)
  })

  it('classifies resting/exhausted fighters as skipped/exhausted before the FIGHT click (#812)', () => {
    const fn = extractFunction(qaBotSource, 'runFightSequence')!
    const exhaustedCount = (fn.match(/recordSkippedFight\(runRecord, i \+ 1, 'exhausted'\)/g) || []).length
    expect(exhaustedCount).toBeGreaterThanOrEqual(2)
  })

  it('keeps a diagnostic screenshot suffixed -skip for skipped fights (#812)', () => {
    const fn = extractFunction(qaBotSource, 'runFightSequence')!
    expect(fn).toMatch(/-fight-\$\{i \+ 1\}-skip\.png/)
  })

  it('still reports real timeouts as errors (retry/backoff untouched) (#812)', () => {
    const fn = extractFunction(qaBotSource, 'runFightSequence')!
    expect(fn).toContain(
      'errors.push(`Fight ${i + 1}: timeout waiting for result (${config.fightTimeout}ms, ${maxRetries} retries)`)'
    )
  })

  it('does not classify a run with only skipped fights as an error run (#812)', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-08-25', run: 'skip-only', character: 'A', fights: [], errors: [],
        skipped_fights: [{ index: 1, reason: 'no_opponents' }, { index: 2, reason: 'no_opponents' }],
      },
    ]
    expect(isErrorRun(runs[0])).toBe(false)
    expect(runs[0].errors).toHaveLength(0)
  })
})
