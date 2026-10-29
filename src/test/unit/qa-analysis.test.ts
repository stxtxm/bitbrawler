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
import {
  isAttackableArenaStatus,
  didFightStart,
  decideFightTypeForIndex,
  FIGHT_START_GRACE_MS,
  shouldSkipForEnergy,
  capFightAttempts,
  aggregateSkipReasons,
  formatSkipSummary,
  resolveShopCohort,
  isPurchaseWithinBudget,
  computeBossDataFreshness,
  buildBossDataStaleIssue,
  BOSS_DATA_STALE_DAYS,
} from '../../utils/qa-bot-helpers'

// ── Types matching RunRecord from analyze-qa-stats.ts ──

interface FightRecord {
  result: 'victory' | 'defeat' | 'draw'
  xp: number | null
  fight_duration_ms: number
  max_hp?: number | null
  fight_type?: 'pvp' | 'pve' | 'boss' | 'idle'
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
  cohort?: { name: string; essence_budget: number | null } | null
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
  shop?: {
    visited?: boolean | null
    offers_count?: number | null
    skipped?: boolean | null
    skip_reason?: string | null
    essence_before?: number | null
    essence_after?: number | null
    purchased?: boolean | null
    cost?: number | null
    item_rarity?: string | null
  }
  shop_data?: {
    offers?: Array<{ name: string; rarity?: string | null; price: number | null }>
    purchased_offer?: number | null
    essence_after_purchase?: number | null
    essence_budget?: number | null
    budget_limited?: boolean | null
    budget_blocked_price?: number | null
  }
  skipped_fights?: Array<{ index: number; reason: string }>
  skipped_summary?: Record<string, number>
  essence?: {
    shop_before?: number | null
    shop_after?: number | null
    flow?: {
      idle_gained: number | null
      forge_net: number | null
      shop_cost: number | null
      salvage_gained: number | null
      fusion_cost: number | null
      upgrade_cost: number | null
    } | null
  }
  errors: string[]
}

interface EquipmentAnalysis {
  runs_with_data: number
  item_names: string[]
  unique_item_count: number
}

type StreakCohort = 'persistent' | 'fresh' | 'unknown'

interface StreakCohortAnalysis {
  cohort: StreakCohort
  runs_with_data: number
  avg_initial_streak: number
  avg_final_streak: number
}

interface StreakAnalysis {
  avg_initial_streak: number
  avg_final_streak: number
  runs_with_data: number
  runs_excluded_by_character_replacement: number
  mixed_cohorts: boolean
  cohorts: StreakCohortAnalysis[]
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
  const pveFights = fights.filter(f => f.fight_type === 'pve' && !isBossFight(f))
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

const EQUIPMENT_SLOT_FALLBACK_LABELS = new Set(['WEAPON', 'ARMOR', 'ACCESSORY'])

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
    !isEquipmentGroupLabel(sanitized) &&
    !EQUIPMENT_SLOT_FALLBACK_LABELS.has(sanitized.toUpperCase())
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

interface StreakStats {
  avg_initial_streak: number
  avg_final_streak: number
  runs_with_data: number
}

function resolveStreakCohort(r: RunRecord): StreakCohort {
  if (r.character_type === 'persistent') return 'persistent'
  if (r.character_type === 'fresh') return 'fresh'
  return 'unknown'
}

function computeStreakStats(runs: RunRecord[]): StreakStats | null {
  const STREAK_MIN = 0
  const STREAK_MAX = 100
  const isValidStreak = (v: number) => v >= STREAK_MIN && v <= STREAK_MAX

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

  const filteredInit = runsWithInitStreak.filter(r => isValidStreak(r.initial_streak))
  const filteredFinalHard = runsWithFinalStreak.filter(r => isValidStreak(r.final_streak))
  const filteredLootbox = runsWithLootboxStreak.filter(r => isValidStreak(r.lootbox_streak))

  let finalForAvg = filteredFinalHard
  if (filteredFinalHard.length >= 30) {
    const vals = filteredFinalHard.map(r => r.final_streak)
    const m = vals.reduce((s, v) => s + v, 0) / vals.length
    const variance = vals.reduce((s, v) => s + (v - m) * (v - m), 0) / vals.length
    const std = Math.sqrt(variance)
    if (std > 0) {
      finalForAvg = filteredFinalHard.filter(r => Math.abs(r.final_streak - m) / std <= 3)
    }
  }

  let initForAvg = filteredInit
  if (filteredInit.length >= 30) {
    const vals = filteredInit.map(r => r.initial_streak)
    const m = vals.reduce((s, v) => s + v, 0) / vals.length
    const variance = vals.reduce((s, v) => s + (v - m) * (v - m), 0) / vals.length
    const std = Math.sqrt(variance)
    if (std > 0) {
      initForAvg = filteredInit.filter(r => Math.abs(r.initial_streak - m) / std <= 3)
    }
  }

  const avgInitial = initForAvg.length > 0
    ? initForAvg.reduce((s, r) => s + r.initial_streak, 0) / initForAvg.length
    : 0
  const avgFinal = finalForAvg.length > 0
    ? finalForAvg.reduce((s, r) => s + r.final_streak, 0) / finalForAvg.length
    : (filteredLootbox.length > 0
      ? filteredLootbox.reduce((s, r) => s + r.lootbox_streak, 0) / filteredLootbox.length
      : 0)

  let runsWithData: number
  if (finalForAvg.length > 0) runsWithData = finalForAvg.length
  else if (filteredLootbox.length > 0) runsWithData = filteredLootbox.length
  else runsWithData = initForAvg.length

  if (runsWithInitStreak.length > 0 && runsWithLootboxStreak.length === 0 && finalForAvg.length === 0) {
    runsWithData = initForAvg.length
  }

  return {
    avg_initial_streak: avgInitial,
    avg_final_streak: avgFinal,
    runs_with_data: runsWithData,
  }
}

function computeStreakAnalysis(runs: RunRecord[]): StreakAnalysis | null {
  const hasAnyStreakData = (r: RunRecord) =>
    typeof r.initial_streak === 'number' ||
    typeof r.final_streak === 'number' ||
    typeof r.lootbox_streak === 'number'

  const runsExcludedByReplacement = runs.filter(r => hasAnyStreakData(r) && isCharacterReplacedRun(r)).length
  const eligibleRuns = runs.filter(r => !isCharacterReplacedRun(r))
  const globalStats = computeStreakStats(eligibleRuns)

  const cohortGroups = new Map<StreakCohort, RunRecord[]>()
  for (const r of eligibleRuns) {
    const name = resolveStreakCohort(r)
    const group = cohortGroups.get(name)
    if (group) group.push(r)
    else cohortGroups.set(name, [r])
  }

  const cohortOrder: StreakCohort[] = ['persistent', 'fresh', 'unknown']
  const cohorts: StreakCohortAnalysis[] = cohortOrder.flatMap(name => {
    const group = cohortGroups.get(name)
    if (!group) return []
    const stats = computeStreakStats(group)
    if (!stats) return []
    return [{ cohort: name, ...stats }]
  })

  if (!globalStats && runsExcludedByReplacement === 0) return null

  return {
    avg_initial_streak: globalStats?.avg_initial_streak ?? 0,
    avg_final_streak: globalStats?.avg_final_streak ?? 0,
    runs_with_data: globalStats?.runs_with_data ?? 0,
    runs_excluded_by_character_replacement: runsExcludedByReplacement,
    mixed_cohorts: cohorts.length > 1,
    cohorts,
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

function isBossFight(f: FightRecord): boolean {
  return f.fight_type === 'boss' || (typeof f.monster_name === 'string' && f.monster_name.trim() === 'VOID TITAN')
}

function computeBossFightStats(fights: FightRecord[]): {
  boss_fights: number
  boss_win_rate: number | null
  boss_avg_xp_per_fight: number | null
  boss_avg_xp_per_loss: number | null
} {
  const bossFights = fights.filter(isBossFight)
  if (bossFights.length === 0) {
    return { boss_fights: 0, boss_win_rate: null, boss_avg_xp_per_fight: null, boss_avg_xp_per_loss: null }
  }
  const bossWins = bossFights.filter(f => f.result === 'victory')
  const bossXpCaptureFights = bossFights.filter(f => f.fight_type === 'boss')
  const bossWinXp = bossXpCaptureFights
    .filter(f => f.result === 'victory')
    .filter((f): f is FightRecord & { xp: number } => f.xp !== null)
  const bossLossXp = bossXpCaptureFights
    .filter(f => f.result === 'defeat')
    .filter((f): f is FightRecord & { xp: number } => f.xp !== null)
  return {
    boss_fights: bossFights.length,
    boss_win_rate: bossWins.length / bossFights.length,
    boss_avg_xp_per_fight: bossWinXp.length > 0
      ? bossWinXp.reduce((s, f) => s + f.xp, 0) / bossWinXp.length
      : null,
    boss_avg_xp_per_loss: bossLossXp.length > 0
      ? bossLossXp.reduce((s, f) => s + f.xp, 0) / bossLossXp.length
      : null,
  }
}

function computePvpFightsExcludingBoss(fights: FightRecord[]): FightRecord[] {
  return fights.filter(f => !isBossFight(f) && f.fight_type !== 'pve')
}

function computePveFightsExcludingBoss(fights: FightRecord[]): FightRecord[] {
  return fights.filter(f => f.fight_type === 'pve' && !isBossFight(f))
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

// ── Shop simulated affordability (mirror of analyze-qa-stats.ts #711/#1230) ──
// Real shop purchases are near-impossible for fresh/mid-game QA characters
// (prices 150/250/350 💎 vs avg ~14 💎), so avg_shop_spent stays null and the
// economic balance is blind. We simulate rational purchases from the observed
// offer pool + essence_before: a run "would purchase" when it can afford the
// cheapest offer WITHIN its cohort budget (#1230 — the shared rule lives in
// qa-bot-helpers so the bot and the analyzer can never drift apart).

interface ShopFunnel {
  shop_visits: number
  shop_locked_runs: number
  no_offer_runs: number
  unaffordable_runs: number
  affordable_runs: number
  purchasable_within_budget_runs: number
}

interface ShopSimulatedAnalysis extends ShopFunnel {
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
  budget_limited_runs: number
  funnel: ShopFunnel
}

function hasShopResult(r: RunRecord): boolean {
  return r.shop != null || r.shop_data != null
}

function computeShopFunnel(runs: RunRecord[]): ShopFunnel {
  const funnel: ShopFunnel = {
    shop_visits: 0,
    shop_locked_runs: 0,
    no_offer_runs: 0,
    unaffordable_runs: 0,
    affordable_runs: 0,
    purchasable_within_budget_runs: 0,
  }
  for (const r of runs) {
    if (!hasShopResult(r)) continue
    funnel.shop_visits++
    if (r.shop?.skipped === true) {
      funnel.shop_locked_runs++
      continue
    }
    const offers = r.shop_data?.offers ?? []
    if (r.shop?.visited === true && offers.length === 0) {
      funnel.no_offer_runs++
    }
    const prices = offers
      .map(o => o.price)
      .filter((p): p is number => typeof p === 'number')
    if (prices.length === 0) continue
    const essenceBefore = r.shop?.essence_before ?? r.essence?.shop_before
    if (typeof essenceBefore !== 'number') continue
    if (essenceBefore < Math.min(...prices)) {
      funnel.unaffordable_runs++
      continue
    }
    funnel.affordable_runs++
    const budget = r.cohort?.essence_budget ?? null
    if (prices.some(p => p <= essenceBefore && isPurchaseWithinBudget(p, budget))) {
      funnel.purchasable_within_budget_runs++
    }
  }
  return funnel
}

function computeShopSimulatedAnalysis(runs: RunRecord[]): ShopSimulatedAnalysis | null {
  const runsWithShopData = runs.filter(
    (r): r is RunRecord & { shop_data: { offers: Array<{ name: string; rarity?: string | null; price: number | null }> } } =>
      r.shop_data?.offers != null && r.shop_data.offers.length > 0
  )
  if (runsWithShopData.length === 0) return null

  const recentOfferPrices = runs
    .slice(-RECENT_WINDOW_RUNS_MIRROR)
    .flatMap(r => (r.shop_data?.offers ?? []).map(o => o.price))
    .filter((p): p is number => typeof p === 'number')
  const rarityDist: Record<string, number> = {}
  let affordableTotal = 0
  let wouldPurchaseRuns = 0
  let budgetLimitedRuns = 0
  let essenceSum = 0
  let essenceCount = 0

  for (const r of runsWithShopData) {
    const offers = r.shop_data.offers
    const prices = offers
      .map(o => o.price)
      .filter((p): p is number => typeof p === 'number')

    for (const o of offers) {
      if (o.rarity && typeof o.rarity === 'string' && o.rarity.trim() !== '') {
        const key = o.rarity.toLowerCase()
        rarityDist[key] = (rarityDist[key] || 0) + 1
      }
    }

    const essenceBefore = r.shop?.essence_before ?? r.essence?.shop_before
    const budget = r.cohort?.essence_budget ?? null
    if (typeof essenceBefore === 'number') {
      essenceSum += essenceBefore
      essenceCount++
      affordableTotal += prices.filter(p => p <= essenceBefore).length
      const purchasable = prices.filter(p => p <= essenceBefore && isPurchaseWithinBudget(p, budget))
      if (purchasable.length > 0) {
        wouldPurchaseRuns++
      } else if (typeof budget === 'number' && prices.some(p => p <= essenceBefore)) {
        budgetLimitedRuns++
      }
    }
  }

  const funnel = computeShopFunnel(runs.filter(hasShopResult))

  return {
    ...funnel,
    funnel,
    runs_with_shop_data: runsWithShopData.length,
    avg_essence_before: essenceCount > 0 ? Math.round((essenceSum / essenceCount) * 100) / 100 : null,
    avg_offer_price: recentOfferPrices.length > 0
      ? Math.round((recentOfferPrices.reduce((s, p) => s + p, 0) / recentOfferPrices.length) * 100) / 100
      : null,
    min_offer_price: recentOfferPrices.length > 0 ? Math.min(...recentOfferPrices) : null,
    max_offer_price: recentOfferPrices.length > 0 ? Math.max(...recentOfferPrices) : null,
    offer_rarity_distribution: rarityDist,
    affordable_offer_count: affordableTotal,
    avg_affordable_offer_count: essenceCount > 0
      ? Math.round((affordableTotal / essenceCount) * 100) / 100
      : null,
    would_purchase_runs: wouldPurchaseRuns,
    simulated_purchase_rate: Math.round((wouldPurchaseRuns / runsWithShopData.length) * 1000) / 1000,
    budget_limited_runs: budgetLimitedRuns,
  }
}

// ── Shop real purchase analysis (mirror of analyze-qa-stats.ts #1229/#1230) ──
// Runs already carry the real purchase outcome (shop.purchased, shop.cost,
// shop.item_rarity, shop_data.purchased_offer); the analyzer previously ignored
// them and drove pricing decisions from the simulated affordability proxy alone.
// #1230 adds the per-cohort breakdown: the single hoarding profile saturated the
// rate, so each QA cohort now reports its own rate and its budget-blocked runs.

interface ShopBudgetGeneration {
  essence_budget: number | null
  runs: number
}

interface ShopCohortAnalysis extends ShopFunnel {
  cohort: string
  essence_budget: number | null
  budget_generations: ShopBudgetGeneration[]
  runs_with_shop_data: number
  runs_with_purchase: number
  real_purchase_rate: number | null
  budget_limited_runs: number
  avg_essence_before: number | null
  min_offer_price: number | null
  funnel: ShopFunnel
}

interface ShopRealAnalysis extends ShopFunnel {
  runs_with_shop_data: number
  runs_with_purchase: number
  real_purchase_rate: number | null
  avg_purchase_cost: number | null
  purchase_rarity_distribution: Record<string, number>
  cheapest_offer_share: number | null
  budget_limited_runs: number
  cohorts: ShopCohortAnalysis[]
  funnel: ShopFunnel
}

const REAL_SHOP_MIN_RUNS = 10

function computeShopRealAnalysis(runs: RunRecord[]): ShopRealAnalysis | null {
  const runsWithShopData = runs.filter(
    (r): r is RunRecord & { shop_data: { offers: Array<{ name: string; rarity?: string | null; price: number | null }> } } =>
      r.shop_data?.offers != null && r.shop_data.offers.length > 0
  )
  if (runsWithShopData.length === 0) return null

  const purchasedRuns = runsWithShopData.filter(r => r.shop?.purchased === true)
  const costValues = purchasedRuns
    .map(r => r.shop?.cost)
    .filter((c): c is number => typeof c === 'number')

  const rarityDist: Record<string, number> = {}
  for (const r of purchasedRuns) {
    const rarity = r.shop?.item_rarity
    if (rarity && typeof rarity === 'string' && rarity.trim() !== '') {
      const key = rarity.toLowerCase()
      rarityDist[key] = (rarityDist[key] || 0) + 1
    }
  }

  const purchasesWithIndex = purchasedRuns.filter(r => typeof r.shop_data.purchased_offer === 'number')
  const cheapestPurchases = purchasesWithIndex.filter(r => r.shop_data.purchased_offer === 0)

  const budgetLimitedRuns = runsWithShopData.filter(r => r.shop_data?.budget_limited === true).length

  const shopResultRuns = runs.filter(hasShopResult)
  const recentRunSet = new Set(runs.slice(-RECENT_WINDOW_RUNS_MIRROR))
  const cohortGroups = new Map<string, RunRecord[]>()
  for (const r of shopResultRuns) {
    const name = r.cohort?.name ?? 'unsegmented'
    const group = cohortGroups.get(name)
    if (group) group.push(r)
    else cohortGroups.set(name, [r])
  }
  const cohorts: ShopCohortAnalysis[] = [...cohortGroups.entries()]
    .map(([name, group]) => {
      const groupWithOffers = group.filter(r => (r.shop_data?.offers?.length ?? 0) > 0)
      const purchased = groupWithOffers.filter(r => r.shop?.purchased === true).length
      const prices = groupWithOffers
        .filter(r => recentRunSet.has(r))
        .flatMap(r => (r.shop_data?.offers ?? []).map(o => o.price))
        .filter((p): p is number => typeof p === 'number')
      const essences = groupWithOffers
        .map(r => r.shop?.essence_before ?? r.essence?.shop_before)
        .filter((e): e is number => typeof e === 'number')
      const funnel = computeShopFunnel(group)
      const budgetGenerations = new Map<number | null, number>()
      for (const r of group) {
        const budget = r.cohort?.essence_budget ?? null
        budgetGenerations.set(budget, (budgetGenerations.get(budget) ?? 0) + 1)
      }
      const budget_generations: ShopBudgetGeneration[] = [...budgetGenerations.entries()]
        .map(([essence_budget, runs]) => ({ essence_budget, runs }))
      const lastRun = group[group.length - 1]
      return {
        cohort: name,
        essence_budget: lastRun?.cohort?.essence_budget ?? null,
        budget_generations,
        runs_with_shop_data: groupWithOffers.length,
        runs_with_purchase: purchased,
        real_purchase_rate: groupWithOffers.length > 0
          ? Math.round((purchased / groupWithOffers.length) * 1000) / 1000
          : null,
        budget_limited_runs: group.filter(r => r.shop_data?.budget_limited === true).length,
        avg_essence_before: essences.length > 0
          ? Math.round((essences.reduce((s, e) => s + e, 0) / essences.length) * 100) / 100
          : null,
        min_offer_price: prices.length > 0 ? Math.min(...prices) : null,
        ...funnel,
        funnel,
      }
    })
    .sort((a, b) => a.cohort.localeCompare(b.cohort))

  const funnel = computeShopFunnel(shopResultRuns)

  return {
    ...funnel,
    funnel,
    runs_with_shop_data: runsWithShopData.length,
    runs_with_purchase: purchasedRuns.length,
    real_purchase_rate: Math.round((purchasedRuns.length / runsWithShopData.length) * 1000) / 1000,
    avg_purchase_cost: costValues.length > 0
      ? Math.round((costValues.reduce((s, c) => s + c, 0) / costValues.length) * 100) / 100
      : null,
    purchase_rarity_distribution: rarityDist,
    cheapest_offer_share: purchasesWithIndex.length > 0
      ? Math.round((cheapestPurchases.length / purchasesWithIndex.length) * 1000) / 1000
      : null,
    budget_limited_runs: budgetLimitedRuns,
    cohorts,
  }
}

function shopRealSuggestions(real: ShopRealAnalysis | null): string[] {
  const out: string[] = []
  if (!real || real.runs_with_shop_data < REAL_SHOP_MIN_RUNS || real.real_purchase_rate === null) return out
  const unsegmentedRuns = real.cohorts.find(c => c.cohort === 'unsegmented')?.runs_with_shop_data ?? 0
  const segmentedRuns = real.runs_with_shop_data - unsegmentedRuns
  const measurementPending = unsegmentedRuns > real.runs_with_shop_data / 2 || segmentedRuns < REAL_SHOP_MIN_RUNS
  const cheapestOnly = real.cheapest_offer_share !== null && real.cheapest_offer_share >= 0.95
  const ratePct = (real.real_purchase_rate * 100).toFixed(0)
  const cohortEssence = real.cohorts.filter(
    (c): c is ShopCohortAnalysis & { avg_essence_before: number } => c.avg_essence_before !== null
  )
  const cohortEssenceRuns = cohortEssence.reduce((s, c) => s + c.runs_with_shop_data, 0)
  const avgEssenceBefore = cohortEssenceRuns > 0
    ? cohortEssence.reduce((s, c) => s + c.avg_essence_before * c.runs_with_shop_data, 0) / cohortEssenceRuns
    : null
  const avgPurchaseCost = real.avg_purchase_cost
  const essenceCostRatio = avgEssenceBefore !== null && avgPurchaseCost !== null && avgPurchaseCost > 0
    ? Math.round(avgEssenceBefore / avgPurchaseCost)
    : null

  const freshCohort = real.cohorts.find(c => c.cohort === 'QA-FRESH')
  const freshFunnel = freshCohort?.funnel
  const freshOutOfReach = freshCohort !== undefined && freshFunnel !== undefined
    && freshCohort.runs_with_purchase === 0
    && (freshFunnel.unaffordable_runs > 0 || freshFunnel.shop_locked_runs > 0)

  if (freshOutOfReach && freshCohort !== undefined && freshFunnel !== undefined) {
    if (freshFunnel.unaffordable_runs > 0) {
      const lockedDetail = freshFunnel.shop_locked_runs > 0 ? `, ${freshFunnel.shop_locked_runs} locked` : ''
      out.push(`QA-FRESH funnel: shop hors de portée à ce stade (${freshFunnel.unaffordable_runs} runs sous le prix plancher) — ${freshFunnel.unaffordable_runs}/${freshFunnel.shop_visits} shop visit(s) below the cheapest offer${lockedDetail}; ${freshCohort.runs_with_purchase}/${freshCohort.runs_with_shop_data} purchase(s). The aggregate rate carries no price signal until this cohort can reach the cheapest offer.`)
    } else {
      out.push(`QA-FRESH funnel: ${freshFunnel.shop_locked_runs} run(s) locked by shopUnlockLevel (${freshFunnel.shop_visits} shop visit(s), ${freshCohort.runs_with_purchase}/${freshCohort.runs_with_shop_data} purchase(s)). Wait for fresh runs above the gate before reading a price signal.`)
    }
  } else if (real.real_purchase_rate < 0.1) {
    out.push(`Real shop purchase rate is ${ratePct}% (${real.runs_with_purchase}/${real.runs_with_shop_data} runs). Consider lowering SHOP_OFFERS prices.`)
  } else if (real.real_purchase_rate > 0.6 && measurementPending) {
    out.push(`Real shop purchase rate is ${ratePct}% (${real.runs_with_purchase}/${real.runs_with_shop_data} runs) — measurement pending: ${unsegmentedRuns} unsegmented run(s) vs ${segmentedRuns} segmented (below REAL_SHOP_MIN_RUNS=${REAL_SHOP_MIN_RUNS}). The rate is carried by the legacy hoarding character; no price action until fresh segmented runs exist.`)
  } else if (real.real_purchase_rate > 0.6 && !cheapestOnly) {
    out.push(`Real shop purchase rate is ${ratePct}% (${real.runs_with_purchase}/${real.runs_with_shop_data} runs) — offers are trivially affordable. Consider raising SHOP_OFFERS prices.`)
  }
  if (cheapestOnly) {
    out.push(`Real shop purchases target the cheapest offer (share ${(real.cheapest_offer_share! * 100).toFixed(0)}%) — available essence${avgEssenceBefore !== null ? ` (avg ${avgEssenceBefore.toFixed(0)} 💎)` : ''} is ${essenceCostRatio !== null ? `~${essenceCostRatio}× ` : ''}the purchased offer cost (avg ${avgPurchaseCost?.toFixed(0) ?? 'n/a'} 💎): hoarding / offer-structure, not a price signal. A uniform price increase will not change the behaviour; calibrate on cost relative to essence, not the raw purchase rate.`)
  }
  if (real.budget_limited_runs > 0) {
    out.push(`QA cohort budgets (#1230) blocked ${real.budget_limited_runs}/${real.runs_with_shop_data} shop runs — that is the price signal. Read the cohorts before acting on the raw rate.`)
  }
  return out
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

// ── Win-rate trend alert helpers (mirror of analyze-qa-stats.ts #1229) ──
// With fightsPerRun: 1, last_3 = 3 fights and last_5 = 5 fights: the run-count
// guards alone produced false-positive declining/swing alerts on tiny combat
// windows. Trend alerts now also require MIN_TREND_FIGHTS fights in the window.

const MIN_TREND_FIGHTS = 10

interface TrendWindowMirror {
  label: string
  count: number
  fights_count: number
  win_rate: number
}

function computeTrendWindowMirror(runs: RunRecord[], count: number, label: string): TrendWindowMirror | null {
  const window = runs.slice(-count)
  if (window.length === 0) return null
  const fights = window.flatMap(r => r.fights)
  const wins = fights.filter(f => f.result === 'victory')
  return {
    label,
    count: window.length,
    fights_count: fights.length,
    win_rate: fights.length > 0 ? wins.length / fights.length : 0,
  }
}

function computeWinRateTrendAlerts(runs: RunRecord[]): string[] {
  const alerts: string[] = []
  const allTime = computeTrendWindowMirror(runs, runs.length, 'all_time')
  const last5 = computeTrendWindowMirror(runs, 5, 'last_5')
  if (allTime && last5 && last5.count >= 3 && last5.fights_count >= MIN_TREND_FIGHTS) {
    if (last5.win_rate > allTime.win_rate + 0.15) alerts.push('improving')
    if (last5.win_rate < allTime.win_rate - 0.15) alerts.push('declining')
  }
  const last3 = computeTrendWindowMirror(runs, 3, 'last_3')
  if (allTime && last3 && last3.count >= 2 && last3.fights_count >= MIN_TREND_FIGHTS) {
    const swing = last3.win_rate - allTime.win_rate
    if (swing > 0.2) alerts.push('surged')
    else if (swing < -0.2) alerts.push('dropped')
  }
  return alerts
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
      expect(computeBossFightStats(fights)).toEqual({
        boss_fights: 0,
        boss_win_rate: null,
        boss_avg_xp_per_fight: null,
        boss_avg_xp_per_loss: null,
      })
    })

    it('aggregates boss wins and losses separately (#1312)', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 360, fight_duration_ms: 20000, fight_type: 'boss', monster_name: 'VOID TITAN' },
        { result: 'defeat', xp: 0, fight_duration_ms: 30000, fight_type: 'boss', monster_name: 'VOID TITAN' },
      ]
      const stats = computeBossFightStats(fights)
      expect(stats.boss_fights).toBe(2)
      expect(stats.boss_win_rate).toBeCloseTo(0.5, 5)
      expect(stats.boss_avg_xp_per_fight).toBe(360)
      expect(stats.boss_avg_xp_per_loss).toBe(0)
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

  describe('VOID TITAN classified as boss even with fight_type pve (#863)', () => {
    it('counts VOID TITAN pve fights as boss (OR) and excludes them from pve', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'defeat', xp: 895, fight_duration_ms: 30000, fight_type: 'pve', monster_name: 'VOID TITAN' },
        { result: 'defeat', xp: null, fight_duration_ms: 30000, fight_type: 'pve', monster_name: 'VOID TITAN' },
      ]
      expect(computeBossFightStats(fights).boss_fights).toBe(2)
      expect(computePveFightsExcludingBoss(fights)).toHaveLength(3)
      expect(computePveMonsters(fights)).toEqual({ Goblin: 3 })
      expect(computePvpFightsExcludingBoss(fights)).toHaveLength(0)
    })

    it('5 consecutive VOID TITAN defeats → boss 5 with 0% WR, pve filté', () => {
      const fights: FightRecord[] = Array.from({ length: 5 }, () => ({
        result: 'defeat' as const,
        xp: 894,
        fight_duration_ms: 30000,
        fight_type: 'pve' as const,
        monster_name: 'VOID TITAN' as const,
      }))
      const allFights: FightRecord[] = [
        ...Array.from({ length: 19 }, () => ({
          result: 'victory' as const,
          xp: 100,
          fight_duration_ms: 5000,
          fight_type: 'pve' as const,
          monster_name: 'Goblin' as const,
        })),
        ...fights,
      ]
      expect(computeBossFightStats(allFights).boss_fights).toBe(5)
      expect(computeBossFightStats(allFights).boss_win_rate).toBe(0)
      expect(computePveFightsExcludingBoss(allFights)).toHaveLength(19)
    })

    it('serie sans VOID TITAN inchangée', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Goblin' },
        { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'Ogre' },
      ]
      expect(computeBossFightStats(fights).boss_fights).toBe(0)
      expect(computePveFightsExcludingBoss(fights)).toHaveLength(2)
    })

    it('fight_type boss sans VOID TITAN still counted as boss', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 360, fight_duration_ms: 20000, fight_type: 'boss', monster_name: 'VOID TITAN' },
        { result: 'defeat', xp: 0, fight_duration_ms: 30000, fight_type: 'boss', monster_name: 'VOID TITAN' },
      ]
      expect(computeBossFightStats(fights).boss_fights).toBe(2)
    })
  })
})

describe('QA Boss Data Freshness (#1323)', () => {
  const NOW = new Date('2026-10-26T12:00:00Z')

  function collectBossRunDates(runs: RunRecord[]): string[] {
    return runs
      .filter(r => r.fights.some(isBossFight))
      .map(r => r.date)
  }

  it('flags boss metrics frozen when the last boss fight is 20 days old', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-10-06T10:00:00Z', run: 'r1', character: 'QA-PERSIST', errors: [],
        fights: [
          { result: 'defeat', xp: 100, fight_duration_ms: 30000, fight_type: 'boss', monster_name: 'VOID TITAN' },
        ],
      },
      {
        date: '2026-10-25T10:00:00Z', run: 'r2', character: 'QA-PERSIST', errors: [],
        fights: [
          { result: 'victory', xp: 100, fight_duration_ms: 5000, fight_type: 'pvp' },
        ],
      },
    ]
    const freshness = computeBossDataFreshness(collectBossRunDates(runs), NOW)
    expect(freshness.boss_last_fight_at).toBe('2026-10-06T10:00:00.000Z')
    expect(freshness.boss_data_stale).toBe(true)
    expect(buildBossDataStaleIssue(freshness, NOW)).toBe(
      'Boss metrics frozen since 2026-10-06 (20 days) — do not use for balance'
    )
  })

  it('does not flag recent boss data', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-10-21T12:00:00Z', run: 'r1', character: 'QA-PERSIST', errors: [],
        fights: [
          { result: 'defeat', xp: 100, fight_duration_ms: 30000, fight_type: 'boss', monster_name: 'VOID TITAN' },
        ],
      },
    ]
    const freshness = computeBossDataFreshness(collectBossRunDates(runs), NOW)
    expect(freshness.boss_data_stale).toBe(false)
    expect(buildBossDataStaleIssue(freshness, NOW)).toBeNull()
  })

  it('keeps data live up to the exclusive staleness threshold', () => {
    const atThreshold = new Date(NOW.getTime() - BOSS_DATA_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const freshness = computeBossDataFreshness([atThreshold], NOW)
    expect(BOSS_DATA_STALE_DAYS).toBe(14)
    expect(freshness.boss_data_stale).toBe(false)
  })

  it('returns null and false when no boss fight was ever recorded', () => {
    expect(computeBossDataFreshness([], NOW)).toEqual({
      boss_last_fight_at: null,
      boss_data_stale: false,
    })
    expect(buildBossDataStaleIssue({ boss_last_fight_at: null, boss_data_stale: false }, NOW)).toBeNull()
  })

  it('ignores unparseable run dates instead of throwing', () => {
    const freshness = computeBossDataFreshness(['not-a-date'], NOW)
    expect(freshness.boss_last_fight_at).toBeNull()
    expect(freshness.boss_data_stale).toBe(false)
  })

  it('exposes the freshness fields and the stale warning in the analyzer', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
    expect(source).toContain('boss_last_fight_at')
    expect(source).toContain('boss_data_stale')
    expect(source).toContain('buildBossDataStaleIssue')
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

  it('segments streaks by cohort instead of averaging fresh and persistent together (#1319)', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'QA-FRESH', fights: [], errors: [],
        initial_streak: 0, final_streak: 0, character_type: 'fresh',
      },
      {
        date: '2026-01-02', run: 'r2', character: 'QA-PERSI', fights: [], errors: [],
        initial_streak: 5, final_streak: 5, character_type: 'persistent',
      },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_initial_streak).toBe(2.5)
    expect(result!.mixed_cohorts).toBe(true)
    const fresh = result!.cohorts.find(c => c.cohort === 'fresh')
    const persistent = result!.cohorts.find(c => c.cohort === 'persistent')
    expect(fresh!.runs_with_data).toBe(1)
    expect(fresh!.avg_initial_streak).toBe(0)
    expect(persistent!.runs_with_data).toBe(1)
    expect(persistent!.avg_initial_streak).toBe(5)
  })

  it('excludes created-after-* replaced-character runs from streak analysis (#1319)', () => {
    const runs: RunRecord[] = [
      {
        date: '2026-01-01', run: 'r1', character: 'QA-PERSI', fights: [], errors: [],
        initial_streak: 2, final_streak: 3, character_type: 'persistent',
      },
      {
        date: '2026-01-02', run: 'r2', character: 'QA-PERSI', fights: [], errors: [],
        initial_streak: 0, final_streak: 4,
        character_action: 'created-after-exhausted-energy', replaced_character: 'QA-PERSI-4',
      },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.runs_excluded_by_character_replacement).toBe(1)
    expect(result!.runs_with_data).toBe(1)
    expect(result!.avg_initial_streak).toBe(2)
    expect(result!.cohorts.find(c => c.cohort === 'persistent')!.runs_with_data).toBe(1)
  })
})

describe('QA Streak Outlier Filtering (#924)', () => {
  it('excludes final_streak >100 hard cap (1509) from avg_final', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 0, final_streak: 0 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 1, final_streak: 1 },
      { date: '2026-01-03', run: 'r3', character: 'C3', fights: [], errors: [], initial_streak: 1, final_streak: 1509 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_final_streak).toBeCloseTo(0.5, 5)
    expect(result!.runs_with_data).toBe(2)
  })

  it('excludes final_streak <0 from avg_final', () => {
    const runs: RunRecord[] = [
      { date: '2026-01-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 0, final_streak: 0 },
      { date: '2026-01-02', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 1, final_streak: 1 },
      { date: '2026-01-03', run: 'r3', character: 'C3', fights: [], errors: [], initial_streak: 1, final_streak: -5 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_final_streak).toBeCloseTo(0.5, 5)
    expect(result!.runs_with_data).toBe(2)
  })

  it('replicates 06/09 audit: 104 runs with 73 and 1509 outliers → avg ~0.64 after filter', () => {
    const runs: RunRecord[] = [
      ...Array.from({ length: 49 }, (_, i) => ({ date: '2026-08-30', run: `r${i}`, character: 'QA-PERSI-4', fights: [], errors: [] as string[], initial_streak: 0, final_streak: 0 })),
      ...Array.from({ length: 49 }, (_, i) => ({ date: '2026-08-30', run: `r${49 + i}`, character: 'QA-PERSI-4', fights: [], errors: [] as string[], initial_streak: 1, final_streak: 1 })),
      { date: '2026-08-30', run: 'r98', character: 'QA-PERSI-4', fights: [], errors: [], initial_streak: 1, final_streak: 2 },
      { date: '2026-08-30', run: 'r99', character: 'QA-PERSI-4', fights: [], errors: [], initial_streak: 1, final_streak: 3 },
      { date: '2026-08-30', run: 'r100', character: 'QA-PERSI-4', fights: [], errors: [], initial_streak: 1, final_streak: 4 },
      { date: '2026-08-30', run: 'r101', character: 'QA-PERSI-4', fights: [], errors: [], initial_streak: 1, final_streak: 8 },
      { date: '2026-08-30', run: 'r102', character: 'QA-PERSI-4', fights: [], errors: [], initial_streak: 1, final_streak: 73 },
      { date: '2026-08-30', run: 'r103', character: 'QA-PERSI-4', fights: [], errors: [], initial_streak: 1, final_streak: 1509 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_final_streak).toBeCloseTo(0.64, 1)
    expect(result!.runs_with_data).toBe(102)
  })

  it('sigma filter excludes |z|>3 when N>=30 (73 outlier)', () => {
    const runs: RunRecord[] = [
      ...Array.from({ length: 30 }, (_, i) => ({ date: '2026-09-01', run: `r${i}`, character: 'QA-PERSI-6', fights: [], errors: [] as string[], initial_streak: 0, final_streak: i % 2 })),
      { date: '2026-08-30', run: 'r30', character: 'QA-PERSI-4', fights: [], errors: [], initial_streak: 1, final_streak: 73 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_final_streak).toBeLessThan(2)
    expect(result!.runs_with_data).toBe(30)
  })

  it('does not sigma-filter when N<30 (73 kept)', () => {
    const runs: RunRecord[] = [
      { date: '2026-09-01', run: 'r1', character: 'C1', fights: [], errors: [], initial_streak: 0, final_streak: 0 },
      { date: '2026-09-01', run: 'r2', character: 'C2', fights: [], errors: [], initial_streak: 0, final_streak: 0 },
      { date: '2026-09-01', run: 'r3', character: 'C3', fights: [], errors: [], initial_streak: 0, final_streak: 0 },
      { date: '2026-09-01', run: 'r4', character: 'C4', fights: [], errors: [], initial_streak: 0, final_streak: 0 },
      { date: '2026-08-30', run: 'r5', character: 'QA-PERSI-4', fights: [], errors: [], initial_streak: 1, final_streak: 73 },
    ]
    const result = computeStreakAnalysis(runs)
    expect(result).not.toBeNull()
    expect(result!.avg_final_streak).toBeCloseTo(14.6, 1)
    expect(result!.runs_with_data).toBe(5)
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

  it('handleDailyLootbox dismisses a leftover inventory overlay before suppressing the handler and clicking Inventory (#1276)', () => {
    const fn = requireAsyncFunction('handleDailyLootbox')
    const overlayCheckIdx = fn.indexOf(".inventory-overlay")
    const setIdx = fn.indexOf('suppressInventoryHandler = true')
    const clickIdx = fn.indexOf('inventoryBtn.click()')
    expect(overlayCheckIdx).toBeGreaterThan(-1)
    expect(setIdx).toBeGreaterThan(-1)
    expect(clickIdx).toBeGreaterThan(-1)
    expect(overlayCheckIdx).toBeLessThan(setIdx)

    const guarded = fn.slice(overlayCheckIdx, setIdx)
    expect(guarded).toContain('isVisible')
    expect(guarded).toContain('alreadyOpen')
    expect(guarded).toContain('dismissModals(page)')
    expect(guarded).toContain("state: 'detached'")

    const beforeClick = fn.slice(overlayCheckIdx, clickIdx)
    expect(beforeClick).toContain("state: 'detached'")
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
    expect(source).toContain('VOID TITAN')
    expect(source).toContain('isBossFight')
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

describe('QA Shop Real Purchase Analysis (#1229)', () => {
  let shopRunSeq = 0

  function shopRun(
    purchased: boolean,
    cost: number | null,
    rarity: string | null,
    offerIndex: number | null,
    cohort: { name: string; essence_budget: number | null } | null = null,
    essenceBefore = 435,
  ): RunRecord {
    shopRunSeq++
    return {
      date: '2026-10-18', run: `s-${shopRunSeq}`, character: 'QA-PERSI', fights: [], errors: [],
      shop: { essence_before: essenceBefore, purchased, cost, item_rarity: rarity },
      shop_data: {
        offers: [
          { name: 'Marchandise', rarity: 'common', price: 24 },
          { name: 'Pièce rare', rarity: 'rare', price: 48 },
          { name: 'Coffre mystère', rarity: null, price: 41 },
        ],
        purchased_offer: offerIndex,
      },
      cohort,
    }
  }

  describe('computeShopRealAnalysis', () => {
    it('returns null when no run has shop_data with offers', () => {
      const runs: RunRecord[] = [
        { date: '2026-10-18', run: 'r1', character: 'A', fights: [], errors: [], shop_data: { offers: [] } },
        { date: '2026-10-18', run: 'r2', character: 'B', fights: [], errors: [] },
      ]
      expect(computeShopRealAnalysis(runs)).toBeNull()
    })

    it('computes real_purchase_rate from shop.purchased over runs with offers', () => {
      const runs: RunRecord[] = Array.from({ length: 12 }, (_, i) => shopRun(i < 9, i < 9 ? 24 : null, i < 9 ? 'UNCOMMON' : null, i < 9 ? 0 : null))
      const result = computeShopRealAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.runs_with_shop_data).toBe(12)
      expect(result!.runs_with_purchase).toBe(9)
      expect(result!.real_purchase_rate).toBe(0.75)
    })

    it('aggregates avg purchase cost, rarity distribution and cheapest-offer share', () => {
      const runs: RunRecord[] = [
        shopRun(true, 24, 'UNCOMMON', 0),
        shopRun(true, 30, 'RARE', 0),
        shopRun(true, 60, 'EPIC', 1),
        shopRun(false, null, null, null),
      ]
      const result = computeShopRealAnalysis(runs)
      expect(result).not.toBeNull()
      expect(result!.runs_with_purchase).toBe(3)
      expect(result!.real_purchase_rate).toBe(0.75)
      expect(result!.avg_purchase_cost).toBe(38)
      expect(result!.purchase_rarity_distribution).toEqual({ uncommon: 1, rare: 1, epic: 1 })
      expect(result!.cheapest_offer_share).toBe(0.667)
    })

    it('reports cheapest_offer_share 1 when every purchase targets offer index 0', () => {
      const runs: RunRecord[] = Array.from({ length: 12 }, () => shopRun(true, 24, 'UNCOMMON', 0))
      const result = computeShopRealAnalysis(runs)
      expect(result!.real_purchase_rate).toBe(1)
      expect(result!.cheapest_offer_share).toBe(1)
    })

    it('leaves cheapest_offer_share null when no purchased_offer index was captured', () => {
      const runs: RunRecord[] = Array.from({ length: 12 }, () => shopRun(true, 24, 'UNCOMMON', null))
      const result = computeShopRealAnalysis(runs)
      expect(result!.cheapest_offer_share).toBeNull()
    })
  })

  describe('shopRealSuggestions', () => {
    const MID_COHORT = { name: 'QA-MID', essence_budget: 150 }

    it('drives the price suggestion from the real rate once >= 10 segmented runs with offers', () => {
      const runs: RunRecord[] = Array.from({ length: 12 }, (_, i) =>
        shopRun(true, 24, 'UNCOMMON', i % 2, MID_COHORT))
      const suggestions = shopRealSuggestions(computeShopRealAnalysis(runs))
      expect(suggestions.some(s => s.includes('Real shop purchase rate') && s.includes('raising SHOP_OFFERS prices'))).toBe(true)
      expect(suggestions.some(s => s.includes('cheapest offer'))).toBe(false)
    })

    it('suggests lowering prices on a near-zero real purchase rate', () => {
      const runs: RunRecord[] = Array.from({ length: 12 }, (_, i) => shopRun(i === 0, i === 0 ? 24 : null, i === 0 ? 'UNCOMMON' : null, i === 0 ? 0 : null))
      const suggestions = shopRealSuggestions(computeShopRealAnalysis(runs))
      expect(suggestions.some(s => s.includes('lowering SHOP_OFFERS prices'))).toBe(true)
    })

    it('stays silent below REAL_SHOP_MIN_RUNS so the caller can fall back to the simulation', () => {
      const runs: RunRecord[] = Array.from({ length: 9 }, () => shopRun(true, 24, 'UNCOMMON', 0))
      expect(shopRealSuggestions(computeShopRealAnalysis(runs))).toEqual([])
    })

    it('ne recommande pas de hausse quand tous les achats visent l\'offre la moins chère', () => {
      const runs: RunRecord[] = Array.from({ length: 12 }, () => shopRun(true, 24, 'UNCOMMON', 0, MID_COHORT))
      const suggestions = shopRealSuggestions(computeShopRealAnalysis(runs))
      expect(suggestions.some(s => s.includes('raising SHOP_OFFERS prices'))).toBe(false)
      expect(suggestions.some(s => s.includes('hoarding / offer-structure'))).toBe(true)
    })

    it('fixture #1277 : taux 0,72 + cheapest 1.0 + 58 unsegmented → aucune suggestion de hausse', () => {
      const fresh = { name: 'QA-FRESH', essence_budget: 50 }
      const mid = { name: 'QA-MID', essence_budget: 150 }
      const runs: RunRecord[] = [
        ...Array.from({ length: 58 }, (_, i) =>
          shopRun(i < 44, i < 44 ? 21 : null, i < 44 ? 'UNCOMMON' : null, i < 44 ? 0 : null)),
        shopRun(false, null, null, null, fresh),
        shopRun(false, null, null, null, fresh),
        shopRun(false, null, null, null, mid),
      ]
      const analysis = computeShopRealAnalysis(runs)
      expect(analysis?.runs_with_shop_data).toBe(61)
      expect(analysis?.runs_with_purchase).toBe(44)
      expect(analysis?.real_purchase_rate).toBe(0.721)
      expect(analysis?.cheapest_offer_share).toBe(1)

      const suggestions = shopRealSuggestions(analysis)
      expect(suggestions.some(s => s.includes('raising SHOP_OFFERS prices'))).toBe(false)
      expect(suggestions.some(s => s.includes('measurement pending'))).toBe(true)
    })

    it('fixture #1277 : taux 0,72 + cheapest 0.5 + 10 runs segmentés → la hausse reste possible', () => {
      const runs: RunRecord[] = Array.from({ length: 25 }, (_, i) =>
        shopRun(i < 18, i < 18 ? 21 : null, i < 18 ? 'UNCOMMON' : null, i < 18 ? i % 2 : null, MID_COHORT))
      const analysis = computeShopRealAnalysis(runs)
      expect(analysis?.real_purchase_rate).toBe(0.72)
      expect(analysis?.cheapest_offer_share).toBe(0.5)

      const suggestions = shopRealSuggestions(analysis)
      expect(suggestions.some(s => s.includes('raising SHOP_OFFERS prices'))).toBe(true)
      expect(suggestions.some(s => s.includes('measurement pending'))).toBe(false)
    })
  })

  describe('analyze-qa-stats.ts source contract (#1229)', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')

    it('exposes the real purchase metrics alongside the simulated proxy', () => {
      expect(source).toContain('computeShopRealAnalysis')
      expect(source).toContain('runs_with_purchase')
      expect(source).toContain('real_purchase_rate')
      expect(source).toContain('avg_purchase_cost')
      expect(source).toContain('purchase_rarity_distribution')
      expect(source).toContain('cheapest_offer_share')
      expect(source).toContain('real: shopReal')
    })

    it('switches the price suggestion to the real rate above REAL_SHOP_MIN_RUNS and keeps the simulated fallback', () => {
      expect(source).toContain('REAL_SHOP_MIN_RUNS')
      expect(source).toContain('Real shop purchase rate')
      expect(source).toContain('Simulated shop purchase rate')
      expect(source).toContain('calibrate on cost relative to essence')
    })
  })
})

describe('QA Shop Full Corpus & Budget Generations (#1322)', () => {
  function corpusRun(opts: {
    run: string
    fights?: number
    purchased?: boolean
    cohort?: { name: string; essence_budget: number | null } | null
  }): RunRecord {
    return {
      date: '2026-10-26',
      run: opts.run,
      character: 'QA-MID',
      fights: Array.from({ length: opts.fights ?? 0 }, () => ({
        result: 'victory' as const,
        xp: 100,
        fight_duration_ms: 5000,
      })),
      errors: [],
      cohort: opts.cohort ?? null,
      shop: {
        visited: true,
        essence_before: 60,
        purchased: opts.purchased ?? false,
        cost: opts.purchased ? 24 : null,
        item_rarity: opts.purchased ? 'UNCOMMON' : null,
      },
      shop_data: {
        offers: [{ name: 'Marchandise', rarity: 'common', price: 24 }],
        purchased_offer: opts.purchased ? 0 : null,
      },
    }
  }

  it('compte un run sans combat avec achat dans runs_with_purchase', () => {
    const runs: RunRecord[] = [
      corpusRun({ run: 'no-fight-buy', fights: 0, purchased: true }),
      corpusRun({ run: 'fight-buy', fights: 1, purchased: true }),
    ]

    const analysis = computeShopRealAnalysis(runs)

    expect(analysis).not.toBeNull()
    expect(analysis?.runs_with_shop_data).toBe(2)
    expect(analysis?.runs_with_purchase).toBe(2)
    expect(analysis?.real_purchase_rate).toBe(1)
  })

  it('garde une seule ligne QA-MID avec le budget du dernier run et ses générations', () => {
    const runs: RunRecord[] = [
      corpusRun({ run: 'mid-150', cohort: { name: 'QA-MID', essence_budget: 150 } }),
      corpusRun({ run: 'mid-40', cohort: { name: 'QA-MID', essence_budget: 40 } }),
    ]

    const analysis = computeShopRealAnalysis(runs)

    expect(analysis?.cohorts).toHaveLength(1)
    const mid = analysis?.cohorts[0]
    expect(mid?.cohort).toBe('QA-MID')
    expect(mid?.essence_budget).toBe(40)
    expect(mid?.budget_generations).toEqual([
      { essence_budget: 150, runs: 1 },
      { essence_budget: 40, runs: 1 },
    ])
  })

  it('le source analyse le corpus complet et expose les générations de budget', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
    expect(source).toContain('computeShopRealAnalysis(stats)')
    expect(source).toContain('computeShopSimulatedAnalysis(stats)')
    expect(source).toContain('budget_generations')
    expect(source).not.toContain('computeShopRealAnalysis(validRuns)')
    expect(source).not.toContain('computeShopSimulatedAnalysis(validRuns)')
    expect(source).not.toContain('essence_budget: group[0]?.cohort?.essence_budget')
  })
})

describe('QA Shop Funnel (#1300)', () => {
  const FRESH = { name: 'QA-FRESH', essence_budget: 50 }
  let funnelRunSeq = 0

  function funnelRun(opts: {
    cohort?: { name: string; essence_budget: number | null } | null
    locked?: boolean
    essenceBefore?: number | null
    prices?: number[]
    purchased?: boolean
  }): RunRecord {
    funnelRunSeq++
    const cohort = opts.cohort === undefined ? FRESH : opts.cohort
    return {
      date: '2026-10-19', run: `funnel-${funnelRunSeq}`, character: 'QA-FRESH', fights: [], errors: [],
      cohort,
      shop: {
        visited: opts.locked !== true,
        offers_count: opts.prices?.length ?? 0,
        skipped: opts.locked === true,
        skip_reason: opts.locked === true ? 'shop requires LVL 5' : null,
        essence_before: opts.essenceBefore ?? null,
        essence_after: opts.essenceBefore ?? null,
        purchased: opts.purchased ?? false,
        cost: null,
        item_rarity: null,
      },
      shop_data: {
        offers: (opts.prices ?? []).map((price, index) => ({ name: `offer-${index}`, rarity: 'rare', price })),
        purchased_offer: opts.purchased ? 0 : null,
        essence_after_purchase: null,
        essence_budget: cohort?.essence_budget ?? null,
        budget_limited: false,
        budget_blocked_price: null,
      },
    }
  }

  function lockedFreshRuns(count: number): RunRecord[] {
    return Array.from({ length: count }, () => funnelRun({ locked: true }))
  }

  function unaffordableFreshRuns(): RunRecord[] {
    return [
      funnelRun({ essenceBefore: 3.44, prices: [30, 88, 50] }),
      funnelRun({ essenceBefore: 6.29, prices: [30, 88, 50] }),
    ]
  }

  it('expose les runs verrouillés et inabordables au lieu de les ignorer', () => {
    const analysis = computeShopRealAnalysis([...lockedFreshRuns(10), ...unaffordableFreshRuns()])

    expect(analysis).not.toBeNull()
    expect(analysis?.runs_with_shop_data).toBe(2)
    expect(analysis?.runs_with_purchase).toBe(0)
    expect(analysis?.real_purchase_rate).toBe(0)
    expect(analysis?.funnel).toMatchObject({
      shop_visits: 12,
      shop_locked_runs: 10,
      no_offer_runs: 0,
      unaffordable_runs: 2,
      affordable_runs: 0,
      purchasable_within_budget_runs: 0,
    })
    expect(analysis).toMatchObject({
      shop_visits: 12,
      shop_locked_runs: 10,
      unaffordable_runs: 2,
    })

    const fresh = analysis?.cohorts.find(c => c.cohort === 'QA-FRESH')
    expect(fresh).toMatchObject({
      runs_with_shop_data: 2,
      runs_with_purchase: 0,
      real_purchase_rate: 0,
    })
    expect(fresh?.funnel).toMatchObject({
      shop_visits: 12,
      shop_locked_runs: 10,
      unaffordable_runs: 2,
      affordable_runs: 0,
    })
    expect(fresh).toMatchObject({
      shop_visits: 12,
      shop_locked_runs: 10,
      unaffordable_runs: 2,
      affordable_runs: 0,
    })
  })

  it('la suggestion lit le funnel FRESH au lieu de conclure à une mesure manquante', () => {
    const unsegmented = Array.from({ length: 8 }, () =>
      funnelRun({ cohort: null, essenceBefore: 435, prices: [30, 88, 50], purchased: true }))
    const analysis = computeShopRealAnalysis([...unsegmented, ...lockedFreshRuns(10), ...unaffordableFreshRuns()])

    expect(analysis?.runs_with_shop_data).toBe(10)
    const suggestions = shopRealSuggestions(analysis)
    expect(suggestions.some(s => s.includes('shop hors de portée à ce stade (2 runs sous le prix plancher)'))).toBe(true)
    expect(suggestions.some(s => s.includes('measurement pending'))).toBe(false)
  })

  it('expose aussi le funnel dans l\'analyse simulée', () => {
    const analysis = computeShopSimulatedAnalysis([
      ...lockedFreshRuns(10),
      funnelRun({ essenceBefore: 3.44, prices: [30, 88, 50] }),
    ])

    expect(analysis).not.toBeNull()
    expect(analysis?.funnel).toMatchObject({
      shop_visits: 11,
      shop_locked_runs: 10,
      unaffordable_runs: 1,
      affordable_runs: 0,
    })
    expect(analysis?.funnel.purchasable_within_budget_runs).toBe(analysis?.would_purchase_runs)
  })

  it('le source expose ShopFunnel sur les analyses réelle, simulée et par cohorte', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
    expect(source).toContain('interface ShopFunnel')
    expect(source).toContain('computeShopFunnel(shopResultRuns)')
    expect(source).toContain('computeShopFunnel(group)')
    expect(source).toContain('funnel: ShopFunnel')
    expect(source).toContain('shop_locked_runs')
    expect(source).toContain('unaffordable_runs')
    expect(source).toContain('shop hors de portée à ce stade')
  })
})

describe('QA Win-Rate Trend Alert Min Fights (#1229)', () => {
  function makeRun(id: string, result: 'victory' | 'defeat', fightsPerRun = 1): RunRecord {
    return {
      date: `2026-10-18-${id}`, run: id, character: 'QA-PERSI',
      fights: Array.from({ length: fightsPerRun }, () => ({ result, xp: 100, fight_duration_ms: 5000 })),
      errors: [],
    }
  }

  it('aucune alerte de tendance win-rate sur 3 runs x 1 combat perdant', () => {
    const runs = [makeRun('r1', 'defeat'), makeRun('r2', 'defeat'), makeRun('r3', 'defeat')]
    expect(computeWinRateTrendAlerts(runs)).toEqual([])
  })

  it('ignore la chute 48% → 0% (last 5) quand la fenêtre ne porte que 5 combats', () => {
    const runs: RunRecord[] = [
      ...Array.from({ length: 10 }, (_, i) => makeRun(`w${i}`, 'victory')),
      ...Array.from({ length: 5 }, (_, i) => makeRun(`l${i}`, 'defeat')),
    ]
    expect(computeWinRateTrendAlerts(runs)).toEqual([])
  })

  it('declenche l alerte declining quand la fenetre last_5 porte au moins 10 combats', () => {
    const runs: RunRecord[] = [
      ...Array.from({ length: 5 }, (_, i) => makeRun(`w${i}`, 'victory', 2)),
      ...Array.from({ length: 5 }, (_, i) => makeRun(`l${i}`, 'defeat', 2)),
    ]
    expect(computeWinRateTrendAlerts(runs)).toContain('declining')
  })

  it('expose fights_count sur la fenetre de tendance', () => {
    const runs = [makeRun('r1', 'victory', 3)]
    expect(computeTrendWindowMirror(runs, 1, 'last_1')!.fights_count).toBe(3)
  })

  it('analyze-qa-stats.ts source contract (#1229): exige MIN_TREND_FIGHTS avant les alertes de tendance', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
    expect(source).toContain('MIN_TREND_FIGHTS')
    expect(source).toContain('fights_count')
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

  it('rejects singular slot fallback labels captured next to the equipped icon (#1283)', () => {
    expect(isValidEquippedItemName('WEAPON')).toBe(false)
    expect(isValidEquippedItemName('ACCESSORY')).toBe(false)
    expect(isValidEquippedItemName('ARMOR')).toBe(false)
    expect(isValidEquippedItemName('⚔️ WEAPON')).toBe(false)
    expect(isValidEquippedItemName('💍 ACCESSORY')).toBe(false)
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

  it('qa-bot rejects singular slot fallback labels and skips them when peeking the next line (#1283)', () => {
    expect(qaBotSource).toContain('EQUIPMENT_SLOT_FALLBACK_LABELS')
    expect(qaBotSource).toContain('isSlotFallbackLabel')
    const fallbackStart = qaBotSource.indexOf('const EQUIPMENT_SLOT_FALLBACK_LABELS')
    expect(fallbackStart).toBeGreaterThan(-1)
    const fallbackBlock = qaBotSource.slice(fallbackStart, fallbackStart + 200)
    expect(fallbackBlock).toContain('WEAPON')
    expect(fallbackBlock).toContain('ACCESSORY')

    const isValidFnStart = qaBotSource.indexOf('function isValidItemName(')
    expect(isValidFnStart).toBeGreaterThan(-1)
    const isValidFn = qaBotSource.slice(isValidFnStart, qaBotSource.indexOf('}', isValidFnStart) + 1)
    expect(isValidFn).toContain('isSlotFallbackLabel')

    const bodyFn = requireAsyncFunction('parseEquippedItemsFromBody')
    expect(bodyFn).toContain('isSlotFallbackLabel')
  })

  it('analyze-qa-stats.ts excludes singular slot fallback labels from equipment_analysis (#1283)', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
    expect(source).toContain('EQUIPMENT_SLOT_FALLBACK_LABELS')
    expect(source).toContain('WEAPON')
    expect(source).toContain('ACCESSORY')
  })
})

describe('QA Bot Progression Curve Capture (#1283)', () => {
  const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  it('declares progression_curve in the run record', () => {
    expect(qaBotSource).toContain('progression_curve: null')
  })

  it('reads the ExperienceBar XP text and stores the captured curve', () => {
    expect(qaBotSource).toContain('.xp-text')
    expect(qaBotSource).toContain('parseProgressionCurve')
    expect(qaBotSource).toMatch(/runRecord\.progression_curve\s*=/)
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

    it('reuses the same-day fresh fighter instead of recreating it on every run (#1241)', () => {
      expect(qaBotSource).toContain('resolveReusableDailyCharacter(state, runKey)')
      expect(qaBotSource).toContain('savedDailyCharacterName')
      expect(qaBotSource).toContain('character_type: runRecord.character_type')
    })

    it('keeps the fresh fighter when its energy is exhausted (#1241)', () => {
      expect(qaBotSource).toContain('shouldReplaceExhaustedCharacter(runRecord.character_type)')
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

describe('QA Freshness-Gated Idle Suggestion (#858)', () => {
  function isErrorRunLocal(r: RunRecord): boolean {
    return !!r.errors && r.errors.length > 0 && (!r.fights || r.fights.length === 0)
  }

  function computeTrailingErrorRuns(runs: RunRecord[]): number {
    let trailing = 0
    for (let i = runs.length - 1; i >= 0; i--) {
      if (isErrorRunLocal(runs[i])) trailing++
      else break
    }
    return trailing
  }

  interface DataFreshnessLocal {
    last_valid_run_at: string | null
    trailing_error_runs: number
    stale: boolean
  }

  function computeDataFreshnessLocal(runs: RunRecord[]): DataFreshnessLocal {
    const trailing = computeTrailingErrorRuns(runs)
    const lastValid = [...runs].reverse().find(r => !isErrorRunLocal(r))
    return {
      last_valid_run_at: lastValid?.date ?? null,
      trailing_error_runs: trailing,
      stale: trailing >= 10,
    }
  }

  function collectIdleFightsLocal(runs: RunRecord[]): IdleFightRecord[] {
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

  function computeIdleSuggestionsGated(
    runsWithIdleData: RunRecord[],
    allIdleWinRate: number,
    trailingErrorRuns: number,
  ): string[] {
    const suggestions: string[] = []
    const recentIdleRuns = runsWithIdleData.slice(-15)
    const recentIdleFights = collectIdleFightsLocal(recentIdleRuns)
    const recentIdleWinRate = recentIdleFights.length > 0
      ? recentIdleFights.filter(f => f.result === 'victory').length / recentIdleFights.length
      : null
    const isStale = trailingErrorRuns >= 10
    if (recentIdleWinRate !== null) {
      if (recentIdleWinRate > 0.9) {
        if (isStale) {
          if (allIdleWinRate < 0.5) {
            return suggestions
          }
          suggestions.push(`[STALE] High idle win rate (${(recentIdleWinRate * 100).toFixed(0)}% over the last ${recentIdleRuns.length} idle runs). Idle monsters may be too weak.`)
        } else {
          suggestions.push(`High idle win rate (${(recentIdleWinRate * 100).toFixed(0)}% over the last ${recentIdleRuns.length} idle runs). Idle monsters may be too weak.`)
        }
      }
      if (recentIdleWinRate < 0.4 && !isStale) {
        suggestions.push(`Low idle win rate (${(recentIdleWinRate * 100).toFixed(0)}% over the last ${recentIdleRuns.length} idle runs). Idle monsters may be too strong.`)
      }
    }
    return suggestions
  }

  function makeIdleRun(id: string, result: 'victory' | 'defeat'): RunRecord {
    return {
      date: `2026-08-18T00:00:00Z-${id}`,
      run: id,
      character: 'C',
      fights: [{ result: 'victory', xp: 90, fight_duration_ms: 1000 }],
      idle_fights: [{ result, xp: 20, essence: 0.1 }],
      errors: [],
    }
  }

  function makeErrorRun(id: string): RunRecord {
    return {
      date: `2026-08-29T00:00:00Z-${id}`,
      run: id,
      character: 'C',
      fights: [],
      errors: ['timeout'],
    }
  }

  describe('computeTrailingErrorRuns', () => {
    it('counts consecutive error runs at the end of the series', () => {
      const runs: RunRecord[] = [
        makeIdleRun('r1', 'victory'),
        makeIdleRun('r2', 'victory'),
        makeErrorRun('e1'),
        makeErrorRun('e2'),
        makeErrorRun('e3'),
      ]
      expect(computeTrailingErrorRuns(runs)).toBe(3)
    })

    it('returns 0 when the last run is valid', () => {
      const runs: RunRecord[] = [
        makeErrorRun('e1'),
        makeIdleRun('r1', 'victory'),
      ]
      expect(computeTrailingErrorRuns(runs)).toBe(0)
    })

    it('returns full length when all runs are errors', () => {
      const runs: RunRecord[] = [makeErrorRun('e1'), makeErrorRun('e2')]
      expect(computeTrailingErrorRuns(runs)).toBe(2)
    })
  })

  describe('computeDataFreshness', () => {
    it('marks stale when trailing_error_runs >=10', () => {
      const runs: RunRecord[] = []
      for (let i = 0; i < 5; i++) runs.push(makeIdleRun(`fresh-${i}`, 'defeat'))
      for (let i = 0; i < 30; i++) runs.push(makeErrorRun(`err-${i}`))
      const freshness = computeDataFreshnessLocal(runs)
      expect(freshness.trailing_error_runs).toBe(30)
      expect(freshness.stale).toBe(true)
      expect(freshness.last_valid_run_at).not.toBeNull()
    })

    it('is not stale when trailing errors are below threshold', () => {
      const runs: RunRecord[] = []
      for (let i = 0; i < 5; i++) runs.push(makeIdleRun(`fresh-${i}`, 'defeat'))
      for (let i = 0; i < 9; i++) runs.push(makeErrorRun(`err-${i}`))
      const freshness = computeDataFreshnessLocal(runs)
      expect(freshness.trailing_error_runs).toBe(9)
      expect(freshness.stale).toBe(false)
    })
  })

  describe('idle suggestion gating', () => {
    it('gates High idle win rate when trailing_error_runs >=10 and fresh WR <50% (suppression)', () => {
      const idleRuns: RunRecord[] = []
      for (let i = 0; i < 15; i++) idleRuns.push(makeIdleRun(`old-win-${i}`, 'victory'))
      const allIdleWinRate = 0.389
      const trailing = 30
      const suggestions = computeIdleSuggestionsGated(idleRuns, allIdleWinRate, trailing)
      expect(suggestions.some(s => s.includes('High idle win rate') && !s.includes('[STALE]'))).toBe(false)
      expect(suggestions.length).toBe(0)
    })

    it('prefixes [STALE] when trailing stale but fresh WR is high (>=50%)', () => {
      const idleRuns: RunRecord[] = []
      for (let i = 0; i < 15; i++) idleRuns.push(makeIdleRun(`old-win-${i}`, 'victory'))
      const allIdleWinRate = 0.65
      const trailing = 15
      const suggestions = computeIdleSuggestionsGated(idleRuns, allIdleWinRate, trailing)
      expect(suggestions.some(s => s.includes('[STALE]') && s.includes('High idle win rate'))).toBe(true)
    })

    it('emits normal High idle win rate when not stale', () => {
      const idleRuns: RunRecord[] = []
      for (let i = 0; i < 15; i++) idleRuns.push(makeIdleRun(`win-${i}`, 'victory'))
      const allIdleWinRate = 0.65
      const trailing = 2
      const suggestions = computeIdleSuggestionsGated(idleRuns, allIdleWinRate, trailing)
      expect(suggestions).toEqual(
        expect.arrayContaining([expect.stringContaining('High idle win rate')]),
      )
      expect(suggestions.some(s => s.includes('[STALE]'))).toBe(false)
    })

    it('does not emit Low idle win rate when stale (gated)', () => {
      const idleRuns: RunRecord[] = []
      for (let i = 0; i < 15; i++) idleRuns.push(makeIdleRun(`loss-${i}`, 'defeat'))
      const allIdleWinRate = 0.3
      const trailing = 12
      const suggestions = computeIdleSuggestionsGated(idleRuns, allIdleWinRate, trailing)
      expect(suggestions.some(s => s.includes('Low idle win rate'))).toBe(false)
    })
  })

  describe('analyze-qa-stats.ts source contract (#858)', () => {
    it('exposes data_freshness with trailing_error_runs and stale flag and gates idle High win rate', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('trailing_error_runs')
      expect(source).toContain('data_freshness')
      expect(source).toContain('stale')
      expect(source).toContain('[STALE]')
      expect(source).toContain('trailing_error_runs + trailing_empty_runs >= FRESHNESS_STALE_RUNS')
      expect(source).toContain('High idle win rate')
    })

    it('bases idle suggestion on freshness-gated window, not all-time cumul', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('runsWithIdleData.slice(-RECENT_IDLE_RUNS)')
      expect(source).toContain('collectIdleFights(recentIdleRuns)')
      expect(source).toContain('idle_win_rate')
      expect(source).toContain('trailing_error_runs')
    })
  })
})

describe('QA Empty-Run Validity & Window Coverage (#1186)', () => {
  function isEmptyRunLocal(r: RunRecord): boolean {
    return (!r.fights || r.fights.length === 0) && (!r.errors || r.errors.length === 0)
  }

  interface DataFreshnessEmpty {
    last_valid_run_at: string | null
    trailing_error_runs: number
    trailing_empty_runs: number
    stale: boolean
  }

  function computeDataFreshnessWithEmpty(runs: RunRecord[]): DataFreshnessEmpty {
    let trailing_error_runs = 0
    let trailing_empty_runs = 0
    let lastValid: RunRecord | undefined
    for (let i = runs.length - 1; i >= 0; i--) {
      const r = runs[i]
      const bad = isErrorRun(r)
      const empty = isEmptyRunLocal(r)
      if (!bad && !empty) {
        lastValid = r
        break
      }
      if (bad) trailing_error_runs++
      else trailing_empty_runs++
    }
    return {
      last_valid_run_at: lastValid?.date ?? null,
      trailing_error_runs,
      trailing_empty_runs,
      stale: trailing_error_runs + trailing_empty_runs >= 10,
    }
  }

  function computeRecentFightCoverage(runs: RunRecord[], windowSize = 30): number {
    return runs.slice(-windowSize).reduce((s, r) => s + (r.fights?.length ?? 0), 0)
  }

  const MIN_RECENT_FIGHTS = 10

  function starveIssues(runs: RunRecord[]): string[] {
    const issues: string[] = []
    const recent = runs.slice(-30)
    const coverage = computeRecentFightCoverage(runs, recent.length)
    if (coverage < MIN_RECENT_FIGHTS) {
      issues.push(`QA window starved: only ${coverage} fights over last ${recent.length} runs — balance signals unreliable`)
    }
    return issues
  }

  function makeFightRun(id: string, fightCount = 5): RunRecord {
    return {
      date: `2026-10-17T14:40:40.472Z-${id}`,
      run: id,
      character: 'QA-PERSI-8',
      fights: Array.from({ length: fightCount }, () => ({ result: 'victory' as const, xp: 100, fight_duration_ms: 5000 })),
      errors: [],
      character_type: 'persistent' as const,
    }
  }

  function makeEmptyRun(id: string): RunRecord {
    return {
      date: `2026-10-17T21:02:42.387Z-${id}`,
      run: id,
      character: 'QA-PERSI-8',
      fights: [],
      skipped_fights: [{ index: 1, reason: 'no_start' }],
      errors: [],
      character_type: 'persistent' as const,
    }
  }

  function makeErrorRunLocal(id: string): RunRecord {
    return {
      date: `2026-10-17T19:01:29.346Z-${id}`,
      run: id,
      character: 'QA-PERSI-8',
      fights: [],
      errors: ['PLAYWRIGHT_TIMEOUT: waiting for combat result'],
      character_type: 'persistent' as const,
    }
  }

  describe('isEmptyRun', () => {
    it('détecte un run 0 combat / 0 erreur comme vide (#1186 run 872 no_start)', () => {
      expect(isEmptyRunLocal(makeEmptyRun('no-start'))).toBe(true)
    })

    it('ne classe ni un run avec combats ni un run 0 combat avec erreurs comme vides', () => {
      expect(isEmptyRunLocal(makeFightRun('r'))).toBe(false)
      expect(isEmptyRunLocal(makeErrorRunLocal('r'))).toBe(false)
    })

    it('accepte un run sans tableau fights du tout (undefined)', () => {
      const r: RunRecord = { date: '2026-10-17', run: 'r', character: 'C', fights: undefined as unknown as [], errors: [] }
      expect(isEmptyRunLocal(r)).toBe(true)
    })
  })

  describe('computeDataFreshness (empty-aware)', () => {
    it('ne traite plus un run vide comme valide : last_valid_run_at vise le dernier run avec combats', () => {
      const runs: RunRecord[] = [
        ...Array.from({ length: 6 }, (_, i) => makeEmptyRun(`empty-${i}`)),
        makeFightRun('f1'),
        makeEmptyRun('tail-empty'),
      ]
      const freshness = computeDataFreshnessWithEmpty(runs)
      expect(freshness.last_valid_run_at).toBe('2026-10-17T14:40:40.472Z-f1')
      expect(freshness.trailing_error_runs).toBe(0)
      expect(freshness.trailing_empty_runs).toBe(1)
      expect(freshness.stale).toBe(false)
    })

    it('marque stale quand le segment chargé d erreurs est suivi d empties (somme >= 10)', () => {
      const runs: RunRecord[] = [
        makeFightRun('f1'),
        ...Array.from({ length: 4 }, (_, i) => makeErrorRunLocal(`err-${i}`)),
        ...Array.from({ length: 6 }, (_, i) => makeEmptyRun(`empty-${i}`)),
      ]
      const freshness = computeDataFreshnessWithEmpty(runs)
      expect(freshness.trailing_error_runs).toBe(4)
      expect(freshness.trailing_empty_runs).toBe(6)
      expect(freshness.stale).toBe(true)
      expect(freshness.last_valid_run_at).toBe('2026-10-17T14:40:40.472Z-f1')
    })

    it('compte errors et empties en zigzag sans les mélanger', () => {
      const runs: RunRecord[] = [
        makeFightRun('f1'),
        makeEmptyRun('e1'),
        makeErrorRunLocal('x1'),
        makeEmptyRun('e2'),
        makeEmptyRun('e3'),
      ]
      const freshness = computeDataFreshnessWithEmpty(runs)
      expect(freshness.trailing_error_runs).toBe(1)
      expect(freshness.trailing_empty_runs).toBe(3)
      expect(freshness.stale).toBe(false)
      expect(freshness.last_valid_run_at).toBe('2026-10-17T14:40:40.472Z-f1')
    })

    it('retourne last_valid_run_at null quand tous les runs sont vides ou en erreur', () => {
      const runs: RunRecord[] = [
        makeErrorRunLocal('x'),
        ...Array.from({ length: 9 }, (_, i) => makeEmptyRun(`empty-${i}`)),
      ]
      const freshness = computeDataFreshnessWithEmpty(runs)
      expect(freshness.last_valid_run_at).toBeNull()
      expect(freshness.trailing_empty_runs).toBe(9)
      expect(freshness.trailing_error_runs).toBe(1)
      expect(freshness.stale).toBe(true)
    })

    it('reste non-stale quand seulement 9 runs de queue sont invalides', () => {
      const runs: RunRecord[] = [
        makeFightRun('f1'),
        makeFightRun('f2'),
        ...Array.from({ length: 8 }, (_, i) => makeEmptyRun(`empty-${i}`)),
        makeErrorRunLocal('x'),
      ]
      const freshness = computeDataFreshnessWithEmpty(runs)
      expect(freshness.trailing_error_runs).toBe(1)
      expect(freshness.trailing_empty_runs).toBe(8)
      expect(freshness.stale).toBe(false)
    })
  })

  describe('recent_fight_coverage', () => {
    it('cumule les combats sur la fenêtre de 30 runs (1 run à 5 combats → 5)', () => {
      const runs: RunRecord[] = [
        ...Array.from({ length: 25 }, (_, i) => makeEmptyRun(`empty-${i}`)),
        makeFightRun('f1', 5),
        ...Array.from({ length: 4 }, (_, i) => makeEmptyRun(`tail-${i}`)),
      ]
      expect(computeRecentFightCoverage(runs)).toBe(5)
    })

    it('retourne 0 quand tous les runs récents sont vides', () => {
      const runs: RunRecord[] = Array.from({ length: 8 }, (_, i) => makeEmptyRun(`empty-${i}`))
      expect(computeRecentFightCoverage(runs)).toBe(0)
    })

    it('couvre toute la série quand il y a moins de 30 runs', () => {
      const runs: RunRecord[] = [makeFightRun('f1', 3)]
      expect(computeRecentFightCoverage(runs)).toBe(3)
    })
  })

  describe('alerte window starved', () => {
    it('pousse l alerte quand la couverture réelle est insuffisante (5 combats / 30 runs)', () => {
      const runs: RunRecord[] = [
        ...Array.from({ length: 29 }, (_, i) => makeEmptyRun(`empty-${i}`)),
        makeFightRun('f1', 5),
      ]
      const issues = starveIssues(runs)
      expect(issues).toHaveLength(1)
      expect(issues[0]).toContain('QA window starved: only 5 fights over last 30 runs — balance signals unreliable')
    })

    it('ne déclenche pas l alerte sur une fenêtre couverte', () => {
      const runs: RunRecord[] = Array.from({ length: 12 }, (_, i) => makeFightRun(`r${i}`, 5))
      expect(starveIssues(runs)).toHaveLength(0)
    })

    it('utilise la taille récente quand la série est plus courte que la fenêtre', () => {
      const runs: RunRecord[] = [
        ...Array.from({ length: 4 }, (_, i) => makeEmptyRun(`empty-${i}`)),
        makeFightRun('f1', 2),
      ]
      const issues = starveIssues(runs)
      expect(issues[0]).toContain('over last 5 runs')
    })
  })

  describe('categorisation empty_runs separée de successful_runs', () => {
    function categorize(runs: RunRecord[]): { successful: number; halfway: number; error: number; empty: number } {
      const valid = runs.filter(r => r.fights && r.fights.length > 0)
      const error = runs.filter(isErrorRun)
      const empty = runs.filter(isEmptyRunLocal)
      const halfway = valid.filter(r => r.errors.length > 0)
      const successful = valid.filter(r => r.errors.length === 0)
      return { successful: successful.length, halfway: halfway.length, error: error.length, empty: empty.length }
    }

    it('compte les runs vides à part : successful + halfway + error + empty == total', () => {
      const runs: RunRecord[] = [
        makeFightRun('ok1'),
        makeFightRun('ok2'),
        { ...makeFightRun('half', 2), errors: ['mid-run failure'] },
        makeErrorRunLocal('err'),
        makeEmptyRun('empty'),
      ]
      const counts = categorize(runs)
      expect(counts.successful).toBe(2)
      expect(counts.halfway).toBe(1)
      expect(counts.error).toBe(1)
      expect(counts.empty).toBe(1)
      expect(counts.successful + counts.halfway + counts.error + counts.empty).toBe(runs.length)
    })

    it('un run 0 combat / 0 erreur n est plus ni successful ni error (catégorie dédiée)', () => {
      const counts = categorize([makeEmptyRun('only')])
      expect(counts.empty).toBe(1)
      expect(counts.successful).toBe(0)
      expect(counts.error).toBe(0)
    })
  })

  describe('analyze-qa-stats.ts source contract (#1186)', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')

    it('expose isEmptyRun et la fraicheur combinée errors + empty', () => {
      expect(source).toContain('function isEmptyRun(')
      expect(source).toContain('trailing_empty_runs')
      expect(source).toContain('!isErrorRun(r) && !isEmptyRun(r)')
      expect(source).toContain('trailing_error_runs + trailing_empty_runs >= FRESHNESS_STALE_RUNS')
    })

    it('expose la couverture récente et l alerte de précision (#1329)', () => {
      expect(source).toContain('recent_fight_coverage')
      expect(source).toContain('QA window imprecise')
      expect(source).toContain('MIN_RECENT_FIGHTS')
    })

    it('sépare empty_runs de successful_runs dans le rapport et le CLI', () => {
      expect(source).toContain('empty_runs: emptyRuns.length')
      expect(source).toContain('${report.empty_runs} empty')
      expect(source).toContain('trailing empty run(s)')
    })
  })
})

describe('QA Combat Yield & Win-Rate Precision (#1329)', () => {
  const WINDOW = 30

  interface CombatYield {
    runs: number
    attempted: number
    executed: number
    skipped: number
    yield_rate: number
    fights_per_run: number
    skip_reasons: Record<string, number>
  }

  function computeCombatYield(runs: RunRecord[]): CombatYield {
    const executed = runs.reduce((s, r) => s + (r.fights?.length ?? 0), 0)
    const skip_reasons: Record<string, number> = {}
    let skipped = 0
    for (const r of runs) {
      if (!r.skipped_summary) continue
      for (const [reason, count] of Object.entries(r.skipped_summary)) {
        if (typeof count !== 'number' || count <= 0) continue
        skip_reasons[reason] = (skip_reasons[reason] ?? 0) + count
        skipped += count
      }
    }
    const attempted = executed + skipped
    return {
      runs: runs.length,
      attempted,
      executed,
      skipped,
      yield_rate: attempted > 0 ? Math.round((executed / attempted) * 1000) / 1000 : 1,
      fights_per_run: runs.length > 0 ? Math.round((executed / runs.length) * 100) / 100 : 0,
      skip_reasons,
    }
  }

  function computeWinRateCi95(fights: FightRecord[]): number | null {
    const n = fights.filter(f => typeof f.result === 'string' && f.result.length > 0).length
    if (n === 0) return null
    return Math.round(196 * Math.sqrt(0.25 / n))
  }

  function precisionIssues(runs: RunRecord[]): string[] {
    const issues: string[] = []
    const recent = runs.slice(-WINDOW)
    const yieldStats = computeCombatYield(recent)
    const resultFights = recent
      .flatMap(r => r.fights ?? [])
      .filter(f => typeof f.result === 'string' && f.result.length > 0)
    const ci = computeWinRateCi95(resultFights)
    if (ci !== null && ci > 15) {
      issues.push(`QA window imprecise: ${resultFights.length} fights over last ${recent.length} runs (95% CI ±${ci} pts) — balance signals unreliable`)
    }
    if (yieldStats.yield_rate < 0.75) {
      const dominant = Object.entries(yieldStats.skip_reasons).sort((a, b) => b[1] - a[1])[0]
      const reason = dominant ? dominant[0] : 'unknown'
      issues.push(`QA combat yield ${Math.round(yieldStats.yield_rate * 100)}%: ${yieldStats.skipped}/${yieldStats.attempted} attempts skipped (${reason}) — daily quota exhausted before the run`)
    }
    return issues
  }

  function makeRun(id: string, fights: number, skipped?: Record<string, number>): RunRecord {
    return {
      date: `2026-10-27T12:00:00.000Z-${id}`,
      run: id,
      character: 'QA-PERSI-9',
      fights: Array.from({ length: fights }, () => ({
        result: 'victory' as const,
        xp: 100,
        fight_duration_ms: 5000,
        fight_type: 'pvp' as const,
      })),
      skipped_summary: skipped,
      errors: [],
      character_type: 'persistent',
    }
  }

  it('30 runs / 15 combats / 15 no_energy → yield 0.5, CI 25 et 2 issues', () => {
    const runs: RunRecord[] = [
      ...Array.from({ length: 15 }, (_, i) => makeRun(`fight-${i}`, 1)),
      ...Array.from({ length: 15 }, (_, i) => makeRun(`skip-${i}`, 0, { no_energy: 1 })),
    ]
    const yieldStats = computeCombatYield(runs)
    expect(yieldStats.executed).toBe(15)
    expect(yieldStats.attempted).toBe(30)
    expect(yieldStats.skipped).toBe(15)
    expect(yieldStats.yield_rate).toBe(0.5)
    expect(yieldStats.fights_per_run).toBe(0.5)
    expect(yieldStats.skip_reasons).toEqual({ no_energy: 15 })
    expect(computeWinRateCi95(runs.flatMap(r => r.fights))).toBe(25)

    const issues = precisionIssues(runs)
    expect(issues).toHaveLength(2)
    expect(issues[0]).toBe('QA window imprecise: 15 fights over last 30 runs (95% CI ±25 pts) — balance signals unreliable')
    expect(issues[1]).toBe('QA combat yield 50%: 15/30 attempts skipped (no_energy) — daily quota exhausted before the run')
  })

  it('100 combats sans skip → CI 10 et aucune issue', () => {
    const runs: RunRecord[] = Array.from({ length: 20 }, (_, i) => makeRun(`r${i}`, 5))
    const fights = runs.flatMap(r => r.fights)
    expect(fights).toHaveLength(100)
    expect(computeWinRateCi95(fights)).toBe(10)
    expect(computeCombatYield(runs).yield_rate).toBe(1)
    expect(precisionIssues(runs)).toHaveLength(0)
  })

  it('skipped_summary absent → attempted === executed, yield 1, pas de crash', () => {
    const runs: RunRecord[] = Array.from({ length: 5 }, (_, i) => makeRun(`r${i}`, 2))
    const yieldStats = computeCombatYield(runs)
    expect(yieldStats.executed).toBe(10)
    expect(yieldStats.attempted).toBe(10)
    expect(yieldStats.skipped).toBe(0)
    expect(yieldStats.yield_rate).toBe(1)
    expect(yieldStats.skip_reasons).toEqual({})
  })

  it('fights sans result → n = 0 → CI null sans division par zéro', () => {
    const fightsWithoutResult = [
      { xp: 100, fight_duration_ms: 5000 },
      { xp: 25, fight_duration_ms: 3000 },
    ] as unknown as FightRecord[]
    expect(computeWinRateCi95(fightsWithoutResult)).toBeNull()
    expect(computeWinRateCi95([])).toBeNull()
  })

  it('expose combat_yield, skipped_summary et win_rate_ci95 dans l analyseur', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
    expect(source).toContain('combat_yield')
    expect(source).toContain('skipped_summary?: Record<string, number>')
    expect(source).toContain('win_rate_ci95')
    expect(source).toContain('QA window imprecise')
    expect(source).toContain('QA combat yield')
  })
})

describe('QA Bot Combat Overlay Intercept Contract (#864)', () => {
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

  it('waits for .combat-overlay hidden before Inventory click after fights', () => {
    expect(qaBotSource).toContain("waitForSelector('.combat-overlay'")
    expect(qaBotSource).toContain("state: 'hidden'")
    const waitIdx = qaBotSource.indexOf("waitForSelector('.combat-overlay'")
    expect(waitIdx).toBeGreaterThan(-1)
    const inventoryIdx = qaBotSource.indexOf('button[aria-label="Inventory"]', waitIdx)
    expect(inventoryIdx).toBeGreaterThan(waitIdx)
    const hiddenSnippet = qaBotSource.slice(waitIdx, waitIdx + 200)
    expect(hiddenSnippet).toContain("state: 'hidden'")
    expect(qaBotSource).toContain("document.querySelector('.combat-overlay')")
  })

  it('overlay branch captures screenshot with -overlay-blocked suffix and marks skipped_inventory without pushing to errors', () => {
    expect(qaBotSource).toContain('-overlay-blocked')
    expect(qaBotSource).toContain('skipped_inventory')
    expect(qaBotSource).toMatch(/skipped_inventory.*overlay/)
    const runFn = extractAsyncFunction(qaBotSource, 'run')
    expect(runFn).not.toBeNull()
    if (runFn) {
      const overlayIdx = runFn.indexOf("waitForSelector('.combat-overlay'")
      expect(overlayIdx).toBeGreaterThan(-1)
      const block = runFn.slice(overlayIdx, overlayIdx + 2000)
      expect(block).toContain('-overlay-blocked')
      expect(block).toContain('skipped_inventory')
      expect(block).not.toContain('errors.push')
    }
  })

  it('run() initializes skipped_inventory and handles overlay as SKIP not error (4 fights valid → no errors)', () => {
    expect(qaBotSource).toContain('skipped_inventory')
    const runFn = extractAsyncFunction(qaBotSource, 'run')
    expect(runFn).not.toBeNull()
    if (runFn) {
      expect(runFn).toContain("waitForSelector('.combat-overlay'")
      expect(runFn).toContain('skipped_inventory')
      const overlaySection = runFn.slice(runFn.indexOf("waitForSelector('.combat-overlay'"))
      const snippet = overlaySection.slice(0, 1500)
      expect(snippet).not.toContain('errors.push')
    }
    const mockRun = { fights: [{ result: 'victory', xp: 250, fight_duration_ms: 3000 } as const, { result: 'victory', xp: 300, fight_duration_ms: 3200 } as const, { result: 'defeat', xp: 50, fight_duration_ms: 2800 } as const, { result: 'victory', xp: 170, fight_duration_ms: 3100 } as const], errors: [] as string[], skipped_inventory: 'overlay' as string }
    const isErrorRun = mockRun.errors.length > 0 && mockRun.fights.length === 0
    const isHalfwayRun = mockRun.fights.length > 0 && mockRun.errors.length > 0
    expect(isErrorRun).toBe(false)
    expect(isHalfwayRun).toBe(false)
    expect(mockRun.skipped_inventory).toBe('overlay')
    expect(mockRun.errors.length).toBe(0)
  })
})

describe('QA Bot No Opponents Skip Contract (#812)', () => {
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

  it('detects "No opponents found" in runFightSequence and classifies it as SKIP not timeout', () => {
    expect(qaBotSource).toContain('No opponents found')
    const fn = requireAsyncFunction('runFightSequence')
    expect(fn).toContain('No opponents found')
    expect(fn).toContain("includes('No opponents found')")
  })

  it('runRecord initializes skipped_fights as an array', () => {
    expect(qaBotSource).toContain('skipped_fights: []')
    expect(qaBotSource).toMatch(/skipped_fights:\s*\[\]/)
  })

  it('runFightSequence pushes exhausted and no_opponents into skipped_fights', () => {
    const fn = requireAsyncFunction('runFightSequence')
    expect(fn).toContain("reason: 'exhausted'")
    expect(fn).toContain("reason: 'no_opponents'")
    expect(fn).toContain('skipped_fights.push')
    expect(fn).toContain("skipped_fights.push({ index: i + 1, reason: 'exhausted' }")
    expect(fn).toContain("skipped_fights.push({ index: i + 1, reason: 'no_opponents' }")
  })

  it('no_opponents skip branch captures screenshot with -skip suffix and does NOT push to errors', () => {
    const fn = requireAsyncFunction('runFightSequence')
    const noOppIdx = fn.indexOf("reason: 'no_opponents'")
    expect(noOppIdx).toBeGreaterThan(-1)
    const branchStart = fn.indexOf('if (isNoOpponents)')
    expect(branchStart).toBeGreaterThan(-1)
    const branchEnd = fn.indexOf('if (!resultDetected)', branchStart)
    expect(branchEnd).toBeGreaterThan(branchStart)
    const block = fn.slice(branchStart, branchEnd)
    expect(block).toContain('-skip.png')
    expect(block).toContain('No opponents found')
    expect(block).not.toContain('errors.push')
  })

  it('exhausted skip branch captures screenshot with -skip suffix and does NOT push to errors', () => {
    const fn = requireAsyncFunction('runFightSequence')
    const exIdx = fn.indexOf("reason: 'exhausted'")
    expect(exIdx).toBeGreaterThan(-1)
    const block = fn.slice(exIdx, exIdx + 800)
    expect(block).toContain('-skip.png')
    expect(block).not.toContain('errors.push')
  })

  it('no_opponents skip closes the modal (OK/CLOSE or dismissModals) and continues without counting error', () => {
    const fn = requireAsyncFunction('runFightSequence')
    const branchStart = fn.indexOf('if (isNoOpponents)')
    expect(branchStart).toBeGreaterThan(-1)
    const branchEnd = fn.indexOf('if (!resultDetected)', branchStart)
    expect(branchEnd).toBeGreaterThan(branchStart)
    const block = fn.slice(branchStart, branchEnd)
    expect(block).toContain('dismissModals')
    expect(block).toContain('continue')
    expect(block).not.toContain('errors.push')
  })

  it('skipped_fights with exhaust/no_opponents do not inflate error rate (fights + skipped = total attempts)', () => {
    const mockRun = {
      fights: [
        { result: 'victory', xp: 100, fight_duration_ms: 3000 } as const,
        { result: 'victory', xp: 120, fight_duration_ms: 3100 } as const,
      ],
      skipped_fights: [
        { index: 3, reason: 'no_opponents' as const },
        { index: 4, reason: 'exhausted' as const },
      ],
      errors: [] as string[],
    }
    expect(mockRun.skipped_fights).toHaveLength(2)
    expect(mockRun.errors).toHaveLength(0)
    expect(mockRun.fights.length + mockRun.skipped_fights.length).toBe(4)
    const isErrorRun = mockRun.errors.length > 0 && mockRun.fights.length === 0
    expect(isErrorRun).toBe(false)
  })
})

describe('QA Stall Detector per fight_type (#1112)', () => {
  type StallFight = {
    result: 'victory' | 'defeat' | 'draw'
    xp: number | null
    fight_duration_ms: number
    fight_type?: 'pvp' | 'pve' | 'idle' | 'boss'
    monster_name?: string | null
  }

  function median(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  function isBossFight(f: StallFight): boolean {
    return (
      f.fight_type === 'boss' ||
      (typeof f.monster_name === 'string' && f.monster_name.trim() === 'VOID TITAN')
    )
  }

  function stallSuggestionsByType(fights: StallFight[]): string[] {
    const suggestions: string[] = []
    const groups: Array<{ label: string; durations: number[]; minMs: number }> = [
      {
        label: 'pvp',
        durations: fights
          .filter(f => !isBossFight(f) && f.fight_type !== 'pve' && f.fight_type !== 'idle')
          .map(f => f.fight_duration_ms),
        minMs: 60000,
      },
      {
        label: 'pve',
        durations: fights
          .filter(f => f.fight_type === 'pve' && !isBossFight(f))
          .map(f => f.fight_duration_ms),
        minMs: 60000,
      },
      {
        label: 'idle',
        durations: fights
          .filter(f => f.fight_type === 'idle')
          .map(f => f.fight_duration_ms),
        minMs: 60000,
      },
      {
        label: 'boss',
        durations: fights.filter(isBossFight).map(f => f.fight_duration_ms),
        minMs: 120000,
      },
    ]
    for (const group of groups) {
      if (group.durations.length === 0) continue
      const groupMedian = median(group.durations)
      const groupMax = Math.max(...group.durations)
      if (groupMax > group.minMs && groupMax > groupMedian * 3) {
        suggestions.push(group.label)
      }
    }
    return suggestions
  }

  function pvpFight(duration: number): StallFight {
    return { result: 'victory', xp: 100, fight_duration_ms: duration, fight_type: 'pvp' }
  }

  function bossFight(duration: number): StallFight {
    return { result: 'defeat', xp: 100, fight_duration_ms: duration, fight_type: 'boss', monster_name: 'VOID TITAN' }
  }

  it('ne suggere rien quand seul un boss long (95s watchdog) depasse le max global', () => {
    const fights: StallFight[] = [
      ...Array.from({ length: 10 }, () => pvpFight(15000)),
      bossFight(94805),
    ]
    expect(stallSuggestionsByType(fights)).toEqual([])
  })

  it('suggere un stall pvp quand le max pvp depasse 3x sa mediane et 60s', () => {
    const fights: StallFight[] = [
      ...Array.from({ length: 10 }, () => pvpFight(15000)),
      pvpFight(95000),
    ]
    expect(stallSuggestionsByType(fights)).toEqual(['pvp'])
  })

  it('ignore un outlier sous 60s meme avec un ratio eleve', () => {
    const fights: StallFight[] = [
      ...Array.from({ length: 10 }, () => pvpFight(10000)),
      pvpFight(50000),
    ]
    expect(stallSuggestionsByType(fights)).toEqual([])
  })

  it('applique un seuil dedie de 120s aux boss fights longs par design', () => {
    const bossAtWatchdog = [
      ...Array.from({ length: 5 }, () => bossFight(30000)),
      bossFight(95000),
    ]
    expect(stallSuggestionsByType(bossAtWatchdog)).toEqual([])
    const bossStall = [
      ...Array.from({ length: 5 }, () => bossFight(30000)),
      bossFight(130000),
    ]
    expect(stallSuggestionsByType(bossStall)).toEqual(['boss'])
  })

  it('detecte un stall pve contre la mediane pve, pas la moyenne globale', () => {
    const fights: StallFight[] = [
      ...Array.from({ length: 10 }, () => pvpFight(15000)),
      ...Array.from({ length: 5 }, () => ({ result: 'victory', xp: 100, fight_duration_ms: 10000, fight_type: 'pve', monster_name: 'Goblin' }) as StallFight),
      { result: 'victory', xp: 100, fight_duration_ms: 70000, fight_type: 'pve', monster_name: 'Goblin' } as StallFight,
    ]
    expect(stallSuggestionsByType(fights)).toEqual(['pve'])
  })

  it('ignore les outliers antiques quand seule la fenetre recente est analysee', () => {
    const allTimeFights: StallFight[] = [
      ...Array.from({ length: 10 }, () => pvpFight(15000)),
      pvpFight(82613),
    ]
    expect(stallSuggestionsByType(allTimeFights)).toEqual(['pvp'])
    const recentFights: StallFight[] = [
      ...Array.from({ length: 10 }, () => pvpFight(10201)),
      pvpFight(23520),
    ]
    expect(stallSuggestionsByType(recentFights)).toEqual([])
  })

  describe('analyze-qa-stats.ts source contract (#1112)', () => {
    it('calcule le stall-check par fight_type contre la mediane du type', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('stallGroups')
      expect(source).toContain('groupMedian')
      expect(source).toContain('BOSS_STALL_MIN_MS')
      expect(source).toContain('120000')
    })

    it('exclut les boss fights du check global et supprime le faux positif moyenne-globale', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('nonBossFights')
      expect(source).not.toContain('maxDuration > avgDuration * 3')
    })

    it('analyse la fenetre recente pour que les eres pre-fix ne declenchent plus le stall', () => {
      const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')
      expect(source).toContain('recentRuns.flatMap')
      expect(source).toContain('recentFights')
    })
  })
})

describe('QA Bot Fight Mode & Start Guards (#1178)', () => {
  describe('isAttackableArenaStatus', () => {
    it('rejette l\'arène dont le boss est verrouillé (isPveLocked) — on ne doit jamais armer un combat', () => {
      expect(isAttackableArenaStatus({
        fightButtonVisible: true,
        fightButtonEnabled: false,
        fightButtonLabel: 'LOCKED LVL 30',
        isPveLocked: true,
        bossLockedLevel: 30,
      })).toBe(false)
    })

    it('accepte un CTA FIGHT! normal, visible et actif', () => {
      expect(isAttackableArenaStatus({
        fightButtonVisible: true,
        fightButtonEnabled: true,
        fightButtonLabel: 'FIGHT!',
        isPveLocked: false,
      })).toBe(true)
    })

    it('accepte un CTA ATTACK BOSS (boss déverrouillé en PvE)', () => {
      expect(isAttackableArenaStatus({
        fightButtonVisible: true,
        fightButtonEnabled: true,
        fightButtonLabel: 'ATTACK BOSS',
        isPveLocked: false,
      })).toBe(true)
    })

    it('rejette les états non-attaquables (null, absent, disabled, resting, searching, resolving, auto/offline)', () => {
      expect(isAttackableArenaStatus(null)).toBe(false)
      expect(isAttackableArenaStatus(undefined)).toBe(false)
      expect(isAttackableArenaStatus({
        fightButtonVisible: false,
        fightButtonEnabled: true,
        fightButtonLabel: 'FIGHT!',
        isPveLocked: false,
      })).toBe(false)
      expect(isAttackableArenaStatus({
        fightButtonVisible: true,
        fightButtonEnabled: false,
        fightButtonLabel: 'FIGHT!',
        isPveLocked: false,
      })).toBe(false)
      expect(isAttackableArenaStatus({
        fightButtonVisible: true,
        fightButtonEnabled: true,
        fightButtonLabel: 'REST NOW',
        isPveLocked: false,
      })).toBe(false)
      expect(isAttackableArenaStatus({
        fightButtonVisible: true,
        fightButtonEnabled: true,
        fightButtonLabel: 'SEARCHING...',
        isPveLocked: false,
        isSearching: true,
      })).toBe(false)
      expect(isAttackableArenaStatus({
        fightButtonVisible: true,
        fightButtonEnabled: true,
        fightButtonLabel: 'RESOLVING...',
        isPveLocked: false,
        isResolving: true,
      })).toBe(false)
      expect(isAttackableArenaStatus({
        fightButtonVisible: true,
        fightButtonEnabled: true,
        fightButtonLabel: 'AUTO MODE',
        isPveLocked: false,
      })).toBe(false)
    })
  })

  describe('didFightStart', () => {
    it('détecte que la vue de combat a remplacé le CTA de l\'arène', () => {
      expect(didFightStart({ fightButtonVisible: false, fightButtonLabel: '', bodyText: '' })).toBe(true)
    })

    it('détecte un résultat déjà affiché ou une résolution en cours', () => {
      expect(didFightStart({ fightButtonVisible: true, fightButtonLabel: 'FIGHT!', bodyText: 'VICTORY' })).toBe(true)
      expect(didFightStart({ fightButtonVisible: true, fightButtonLabel: 'FIGHT!', bodyText: 'DEFEAT' })).toBe(true)
      expect(didFightStart({ fightButtonVisible: true, fightButtonLabel: 'FIGHT!', bodyText: 'No opponents found' })).toBe(true)
      expect(didFightStart({ fightButtonVisible: true, fightButtonLabel: 'RESOLVING...', bodyText: '' })).toBe(true)
    })

    it('renvoie false quand le CTA est inchangé (clic sans démarrage, #1178)', () => {
      expect(didFightStart({ fightButtonVisible: true, fightButtonLabel: 'LOCKED LVL 30', bodyText: '' })).toBe(false)
      expect(didFightStart({ fightButtonVisible: true, fightButtonEnabled: true, fightButtonLabel: 'FIGHT!', bodyText: '' })).toBe(false)
      expect(didFightStart(null)).toBe(false)
      expect(didFightStart(undefined)).toBe(false)
    })

    it('detecte un label RESOLVING présent dans le body même avec un label absent (defaut)', () => {
      expect(didFightStart({ fightButtonVisible: true, fightButtonLabel: '', bodyText: 'RESOLVING' })).toBe(true)
    })
  })

  describe('decideFightTypeForIndex', () => {
    it('force PvP pour un index marqué verrouillé, même si pveOnly ou ratio dit PvE (#1178 anti-oscillation)', () => {
      const forced = decideFightTypeForIndex({
        forcedPvp: true,
        pvpSinceLastPve: 0,
        pveRatio: 0.33,
        pveOnly: false,
        characterLevel: 5,
        pvpUnlockLevel: 0,
      })
      expect(forced.type).toBe('pvp')
      expect(forced.pvpSinceLastPve).toBe(1)

      const forcedDespitePveOnly = decideFightTypeForIndex({
        forcedPvp: true,
        pvpSinceLastPve: 2,
        pveRatio: 0.33,
        pveOnly: true,
        characterLevel: 5,
        pvpUnlockLevel: 0,
      })
      expect(forcedDespitePveOnly.type).toBe('pvp')
      expect(forcedDespitePveOnly.pvpSinceLastPve).toBe(3)
    })

    it('délègue à determineNextFightType quand l\'index n\'est pas forcé', () => {
      expect(decideFightTypeForIndex({
        forcedPvp: false,
        pvpSinceLastPve: 0,
        pveRatio: 0,
        pveOnly: false,
        characterLevel: 5,
        pvpUnlockLevel: 0,
      }).type).toBe('pvp')

      expect(decideFightTypeForIndex({
        forcedPvp: false,
        pvpSinceLastPve: 0,
        pveRatio: 0.33,
        pveOnly: true,
        characterLevel: 5,
        pvpUnlockLevel: 0,
      }).type).toBe('pve')
    })

    it('garde le comportement déterministe de la planification standard', () => {
      expect(decideFightTypeForIndex({
        forcedPvp: false,
        pvpSinceLastPve: 99,
        pveRatio: 0.33,
        pveOnly: false,
        characterLevel: null,
        pvpUnlockLevel: 1,
      }).type).toBe('pve')
    })
  })

  it('expose un budget de test de démarrage borné (fail fast, plus de 90s x 3)', () => {
    expect(FIGHT_START_GRACE_MS).toBe(3000)
  })

  describe('runFightSequence source contract (#1178)', () => {
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

    it('ne peut pas armer un combat quand isPveLocked est vrai (garde anti-armement avant le clic)', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const guardIdx = fn.indexOf('!isAttackableArenaStatus(arenaStatus)')
      expect(guardIdx).toBeGreaterThan(-1)
      const clickIdx = fn.indexOf('fightBtn.click(', guardIdx)
      expect(clickIdx).toBeGreaterThan(guardIdx)
    })

    it('relit l\'arène après la bascule PvP et abandonne l\'index si le verrou persiste (#1178)', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const lockIdx = fn.indexOf('isPveLocked')
      expect(lockIdx).toBeGreaterThan(-1)
      const toggleIdx = fn.indexOf('togglePveMode(page, false)', lockIdx)
      expect(toggleIdx).toBeGreaterThan(lockIdx)
      const recheckIdx = fn.indexOf('readArenaStatus(page)', toggleIdx)
      expect(recheckIdx).toBeGreaterThan(toggleIdx)
      const skipIdx = fn.indexOf("reason: 'pve_locked'", recheckIdx)
      expect(skipIdx).toBeGreaterThan(recheckIdx)
    })

    it('marque la décision PvP pour l\'index verrouillé au lieu de re-décider en PvE (fin de l\'oscillation PVP→PVE→PVP)', () => {
      const fn = requireAsyncFunction('runFightSequence')
      expect(fn).toContain('forcedPvpIndexes')
      expect(fn).toContain('forcedPvpIndexes.add(i)')
      expect(fn).toContain('forcedPvpIndexes.has(i)')
    })

    it('bascule en PvP au plus une fois par index verrouillé', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const guardIdx = fn.indexOf('forcedPvpIndexes.has(i)')
      const fallbackIdx = fn.indexOf('forcedPvpIndexes.add(i)')
      expect(guardIdx).toBeGreaterThan(-1)
      expect(fallbackIdx).toBeGreaterThan(-1)
      expect(guardIdx).toBeLessThan(fallbackIdx)
    })

    it('enregistre skipped_fights reason pve_locked sans erreur timeout waiting for result', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const skipIdx = fn.indexOf("reason: 'pve_locked'")
      expect(skipIdx).toBeGreaterThan(-1)
      const block = fn.slice(fn.indexOf("reason: 'pve_locked'"), fn.indexOf("reason: 'pve_locked'") + 700)
      expect(block).not.toContain('errors.push')
      expect(block).toContain('pve-locked.png')
    })

    it('plafonne l\'attente post-clic via didFightStart + FIGHT_START_GRACE_MS avant le long polling', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const graceIdx = fn.indexOf('didFightStart(')
      expect(graceIdx).toBeGreaterThan(-1)
      expect(fn).toContain('FIGHT_START_GRACE_MS')
    })

    it('saute un démarrage avorté en no_start sans erreur timeout et sans errors.push', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const branchStart = fn.indexOf('if (!fightStarted)')
      expect(branchStart).toBeGreaterThan(-1)
      const skipIdx = fn.indexOf("reason: 'no_start'", branchStart)
      expect(skipIdx).toBeGreaterThan(branchStart)
      const branchEnd = fn.indexOf('if (isNoOpponents)', branchStart)
      expect(branchEnd).toBeGreaterThan(skipIdx)
      const block = fn.slice(branchStart, branchEnd)
      expect(block).not.toContain('errors.push')
      expect(block).toContain('no-start.png')
    })

    it('préserve le contrat existant exhausted / no_opponents (#812)', () => {
      const fn = requireAsyncFunction('runFightSequence')
      expect(fn).toContain("skipped_fights.push({ index: i + 1, reason: 'exhausted' }")
      expect(fn).toContain("skipped_fights.push({ index: i + 1, reason: 'no_opponents' }")
    })

    it('runFightSequence est entièrement piloté par decideFightTypeForIndex avec forcedPvp', () => {
      const fn = requireAsyncFunction('runFightSequence')
      expect(fn).toContain('decideFightTypeForIndex')
      expect(fn).not.toContain('determineNextFightType(')
    })
  })

  describe('determineNextFightType déplacé dans qa-bot-helpers', () => {
    it('qa-bot.mjs importe la décision de type depuis le module helpers', () => {
      const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')
      const helperSource = readFileSync(join(process.cwd(), 'src', 'utils', 'qa-bot-helpers.js'), 'utf-8')
      expect(helperSource).toContain('export function determineNextFightType(')
      expect(qaBotSource).toContain('decideFightTypeForIndex')
      expect(qaBotSource).not.toMatch(/^function determineNextFightType\(/m)
    })
  })
})

describe('QA Bot Energy Skip Contract (#1197)', () => {
  describe('shouldSkipForEnergy', () => {
    it('skip quand l energie lue est 0', () => {
      expect(shouldSkipForEnergy(0)).toBe(true)
    })

    it('tente le combat quand l energie est positive', () => {
      expect(shouldSkipForEnergy(1)).toBe(false)
      expect(shouldSkipForEnergy(2)).toBe(false)
      expect(shouldSkipForEnergy(5)).toBe(false)
    })

    it('tente le combat quand la lecture est impossible (null/undefined)', () => {
      expect(shouldSkipForEnergy(null)).toBe(false)
      expect(shouldSkipForEnergy(undefined)).toBe(false)
    })

    it('rejette une lecture douteuse NaN — repli: on tente', () => {
      expect(shouldSkipForEnergy(Number.NaN)).toBe(false)
    })

    it('skip sur une energie negative invalide', () => {
      expect(shouldSkipForEnergy(-1)).toBe(true)
    })
  })

  describe('capFightAttempts', () => {
    it('plafonne les tentatives a l energie disponible (min(fightsPerRun, energy))', () => {
      expect(capFightAttempts(5, 2)).toBe(2)
      expect(capFightAttempts(5, 0)).toBe(0)
      expect(capFightAttempts(3, 2)).toBe(2)
    })

    it('garde le budget plein quand l energie depasse le budget du run', () => {
      expect(capFightAttempts(5, 8)).toBe(5)
      expect(capFightAttempts(5, 5)).toBe(5)
    })

    it('repli sur le budget plein quand la lecture est impossible (null/undefined)', () => {
      expect(capFightAttempts(5, null)).toBe(5)
      expect(capFightAttempts(5, undefined)).toBe(5)
    })
  })

  describe('aggregateSkipReasons', () => {
    it('agrege les motifs de skip en compteurs par motif', () => {
      expect(aggregateSkipReasons([
        { index: 1, reason: 'no_energy' },
        { index: 2, reason: 'no_energy' },
        { index: 3, reason: 'no_energy' },
        { index: 4, reason: 'pve_locked' },
      ])).toEqual({ no_energy: 3, pve_locked: 1 })
    })

    it('retourne un objet vide sans skip', () => {
      expect(aggregateSkipReasons([])).toEqual({})
      expect(aggregateSkipReasons(null)).toEqual({})
      expect(aggregateSkipReasons(undefined)).toEqual({})
    })

    it('classe les entrees sans raison comme unknown sans casser les autres motifs', () => {
      expect(aggregateSkipReasons([{ index: 1 } as { index: number; reason?: string }]))
        .toEqual({ unknown: 1 })
    })
  })

  describe('formatSkipSummary', () => {
    it('rend le format lisible par le tech-lead « skipped: 5 no_energy »', () => {
      expect(formatSkipSummary({ no_energy: 5 })).toBe('skipped: 5 no_energy')
    })

    it('chaine plusieurs motifs', () => {
      expect(formatSkipSummary({ no_energy: 5, no_start: 2 })).toBe('skipped: 5 no_energy, 2 no_start')
    })

    it('retourne une chaine vide quand rien n est skip', () => {
      expect(formatSkipSummary({})).toBe('')
      expect(formatSkipSummary(null)).toBe('')
    })
  })

  describe('runFightSequence source contract (#1197)', () => {
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

    it('lit l energie avant de cliquer (pas de clic inconditionnel)', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const energyIdx = fn.indexOf('shouldSkipForEnergy(')
      expect(energyIdx).toBeGreaterThan(-1)
      const clickIdx = fn.indexOf('fightBtn.click(')
      expect(clickIdx).toBeGreaterThan(energyIdx)
    })

    it('energie a 0 → skip no_energy sans clic ni capture', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const energyIdx = fn.indexOf('shouldSkipForEnergy(')
      const searchingIdx = fn.indexOf('isSearching', energyIdx)
      expect(searchingIdx).toBeGreaterThan(energyIdx)
      const block = fn.slice(energyIdx, searchingIdx)
      expect(block).toContain("reason: 'no_energy'")
      expect(block).toContain('break')
      expect(block).not.toContain('screenshot')
      expect(block).not.toContain('.png')
    })

    it('pve_locked continue de primer sur no_energy (skip d energie evite si isPveLocked)', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const energyIdx = fn.indexOf('shouldSkipForEnergy(')
      const condition = fn.slice(energyIdx, energyIdx + 160)
      expect(condition).toContain('!arenaStatus.isPveLocked')
    })

    it('plafonne les tentatives a l energie disponible via capFightAttempts, budget plein en repli null', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const budgetIdx = fn.indexOf('let attemptBudget = config.fightsPerRun')
      expect(budgetIdx).toBeGreaterThan(-1)
      const loopIdx = fn.indexOf('i < attemptBudget')
      expect(loopIdx).toBeGreaterThan(budgetIdx)
      const energyIdx = fn.indexOf('const fightsAvailable = arenaStatus.fightsAvailable', budgetIdx)
      expect(energyIdx).toBeGreaterThan(-1)
      const capIdx = fn.indexOf('capFightAttempts(config.fightsPerRun, fightsAvailable)', energyIdx)
      expect(capIdx).toBeGreaterThan(energyIdx)
    })

    it('replace le budget apres une creation de personnage (energie fraiche)', () => {
      const fn = requireAsyncFunction('runFightSequence')
      const replaceIdx = fn.indexOf("maybeReplaceExhaustedCharacter(page, runKey, runRecord, 'exhausted-energy')")
      expect(replaceIdx).toBeGreaterThan(-1)
      const budgetResetIdx = fn.indexOf('attemptBudget = config.fightsPerRun', replaceIdx)
      expect(budgetResetIdx).toBeGreaterThan(replaceIdx)
    })

    it('expose skipped_summary agrege dans le run (motif agrégé, en plus du detail par index)', () => {
      const fn = requireAsyncFunction('runFightSequence')
      expect(fn).toContain('runRecord.skipped_summary = aggregateSkipReasons(')
      expect(fn).toContain('formatSkipSummary(')
    })

    it('les motifs pve_locked et not_attackable restent distincts et enregistres', () => {
      const fn = requireAsyncFunction('runFightSequence')
      expect(fn).toContain("reason: 'pve_locked'")
      expect(fn).toContain("'not_attackable'")
    })
  })
})

describe('QA Cohort v2 (#1230) — le taux shop redevient sensible au prix', () => {
  // Avant : un seul profil persistant thésaurisait 435 💎 pour une offre min à
  // 24 💎 → real_purchase_rate saturé (83,8 %, 100 % sur les 20 derniers runs) et
  // cinq cycles de hausse des prix +10 % (#1033→#1182) sans effet mesurable.
  // Maintenant : chaque profil plafonne la dépense d'UNE offre à son budget ;
  // un run « budget limited » (abordable mais hors budget) est le signal prix.
  const COHORTS = [
    { name: 'QA-FRESH', minLevel: 1, maxLevel: 5, essenceBudget: 50 },
    { name: 'QA-MID', minLevel: 6, maxLevel: 21, essenceBudget: 150 },
    { name: 'QA-END', minLevel: 22, essenceBudget: 400 },
  ]

  function shopRun(opts: {
    cohort?: { name: string; essence_budget: number | null } | null
    prices: number[]
    essenceBefore: number
    purchased?: boolean
    budgetLimited?: boolean
  }): RunRecord {
    return {
      date: '2026-10-19',
      run: 'qa',
      character: 'QA-PERSIST',
      fights: [],
      errors: [],
      shop: {
        essence_before: opts.essenceBefore,
        essence_after: opts.essenceBefore,
        purchased: opts.purchased ?? false,
        cost: null,
        item_rarity: null,
      },
      shop_data: {
        offers: opts.prices.map((price, index) => ({ name: `offer-${index}`, rarity: 'rare', price })),
        purchased_offer: opts.purchased ? 0 : null,
        essence_after_purchase: null,
        essence_budget: opts.cohort?.essence_budget ?? null,
        budget_limited: opts.budgetLimited ?? false,
      },
      cohort: opts.cohort ?? null,
    }
  }

  describe('resolveShopCohort', () => {
    it('résout le profil depuis le niveau du personnage au début du run', () => {
      expect(resolveShopCohort(COHORTS, 3)?.name).toBe('QA-FRESH')
      expect(resolveShopCohort(COHORTS, 5)?.name).toBe('QA-FRESH')
      expect(resolveShopCohort(COHORTS, 6)?.name).toBe('QA-MID')
      expect(resolveShopCohort(COHORTS, 21)?.name).toBe('QA-MID')
      expect(resolveShopCohort(COHORTS, 22)?.name).toBe('QA-END')
      expect(resolveShopCohort(COHORTS, 30)?.name).toBe('QA-END')
    })

    it('QA_COHORT force un profil, un nom inconnu rend le run legacy', () => {
      expect(resolveShopCohort(COHORTS, 30, 'QA-FRESH')?.name).toBe('QA-FRESH')
      expect(resolveShopCohort(COHORTS, 3, 'NOPE')).toBeNull()
    })

    it('reste silencieux sans niveau lisible ou sans cohortes configurées', () => {
      expect(resolveShopCohort(COHORTS, null)).toBeNull()
      expect(resolveShopCohort(COHORTS, NaN)).toBeNull()
      expect(resolveShopCohort([], 10)).toBeNull()
      expect(resolveShopCohort(undefined, 10)).toBeNull()
    })
  })

  describe('isPurchaseWithinBudget (la règle partagée bot/analyse)', () => {
    it('plafonne la dépense d\'une seule offre', () => {
      expect(isPurchaseWithinBudget(27, 50)).toBe(true)
      expect(isPurchaseWithinBudget(50, 50)).toBe(true)
      expect(isPurchaseWithinBudget(80, 50)).toBe(false)
    })

    it('sans budget, garde la règle d\'affordabilité d\'avant (runs historiques)', () => {
      expect(isPurchaseWithinBudget(27, null)).toBe(true)
      expect(isPurchaseWithinBudget(27, undefined)).toBe(true)
      expect(isPurchaseWithinBudget(27, 0)).toBe(true)
    })

    it('refuse une offre sans prix connu', () => {
      expect(isPurchaseWithinBudget(null, 50)).toBe(false)
      expect(isPurchaseWithinBudget(undefined, 50)).toBe(false)
    })
  })

  describe('computeShopSimulatedAnalysis', () => {
    it('ne compte plus un run bridé par le budget comme un achat', () => {
      const runs = [
        shopRun({ cohort: { name: 'QA-FRESH', essence_budget: 20 }, prices: [27, 53], essenceBefore: 435 }),
        shopRun({ cohort: { name: 'QA-FRESH', essence_budget: 50 }, prices: [27, 53], essenceBefore: 435, purchased: true }),
      ]

      const analysis = computeShopSimulatedAnalysis(runs)

      expect(analysis?.runs_with_shop_data).toBe(2)
      expect(analysis?.would_purchase_runs).toBe(1)
      expect(analysis?.simulated_purchase_rate).toBe(0.5)
      expect(analysis?.budget_limited_runs).toBe(1)
    })

    it('sans cohorte (runs d\'avant #1230), l\'affordabilité seule décide', () => {
      const runs = [shopRun({ prices: [27, 53], essenceBefore: 435 })]

      const analysis = computeShopSimulatedAnalysis(runs)

      expect(analysis?.would_purchase_runs).toBe(1)
      expect(analysis?.budget_limited_runs).toBe(0)
    })
  })

  describe('computeShopRealAnalysis — ventilation par cohorte', () => {
    it('expose taux, budget et runs bridés pour chaque profil', () => {
      const runs = [
        shopRun({ cohort: { name: 'QA-FRESH', essence_budget: 50 }, prices: [27, 53], essenceBefore: 60, purchased: true }),
        shopRun({ cohort: { name: 'QA-FRESH', essence_budget: 50 }, prices: [27, 53], essenceBefore: 90 }),
        shopRun({ cohort: { name: 'QA-END', essence_budget: 400 }, prices: [27, 53], essenceBefore: 435, budgetLimited: true }),
      ]

      const analysis = computeShopRealAnalysis(runs)

      expect(analysis?.budget_limited_runs).toBe(1)
      expect(analysis?.cohorts.map(c => c.cohort)).toEqual(['QA-END', 'QA-FRESH'])

      const fresh = analysis?.cohorts.find(c => c.cohort === 'QA-FRESH')
      expect(fresh).toMatchObject({
        essence_budget: 50,
        runs_with_shop_data: 2,
        runs_with_purchase: 1,
        real_purchase_rate: 0.5,
        budget_limited_runs: 0,
        min_offer_price: 27,
      })

      const end = analysis?.cohorts.find(c => c.cohort === 'QA-END')
      expect(end).toMatchObject({
        essence_budget: 400,
        runs_with_shop_data: 1,
        runs_with_purchase: 0,
        real_purchase_rate: 0,
        budget_limited_runs: 1,
      })
    })

    it('regroupe les runs sans cohorte sous unsegmented (rétrocompatibilité)', () => {
      const runs = [shopRun({ prices: [27], essenceBefore: 300, purchased: true })]

      const analysis = computeShopRealAnalysis(runs)

      expect(analysis?.cohorts).toHaveLength(1)
      expect(analysis?.cohorts[0]).toMatchObject({
        cohort: 'unsegmented',
        essence_budget: null,
        runs_with_purchase: 1,
        real_purchase_rate: 1,
      })
    })
  })

  describe('suggestions de prix', () => {
    it('signale un taux porté par des runs bridés par l\'instrument', () => {
      const runs = Array.from({ length: 10 }, () =>
        shopRun({
          cohort: { name: 'QA-FRESH', essence_budget: 20 },
          prices: [27, 53],
          essenceBefore: 435,
          budgetLimited: true,
        }),
      )

      const analysis = computeShopRealAnalysis(runs)
      const suggestions = shopRealSuggestions(analysis)

      expect(suggestions.some(s => s.includes('consider lowering') || s.includes('Consider lowering'))).toBe(true)
      expect(suggestions.some(s => s.includes('#1230') && s.includes('price signal'))).toBe(true)
    })
  })
})

describe('QA Bot Cohort v2 Contract (#1230)', () => {
  // Le miroir ci-dessus couvre la logique d'analyse ; ce contrat verrouille le
  // câblage réel dans le bot : profil résolu une fois au début du run, budget
  // appliqué à la décision d'achat, cohorte transmise au test shop et
  // enregistrée dans le run record (sans quoi la ventilation par cohorte
  // resterait vide et le taux shop retomberait sur la thésaurisation).
  const qaBotSource = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  it('résout le profil au début du run et l\'enregistre dans le run record', () => {
    expect(qaBotSource).toContain('resolveShopCohort(config.cohorts, runRecord.initial_level, config.cohort)')
    expect(qaBotSource).toContain('runRecord.cohort = { name: cohort.name, essence_budget: cohort.essenceBudget }')
  })

  it('applique le budget de cohorte à chaque offre avant d\'acheter', () => {
    expect(qaBotSource).toContain('isPurchaseWithinBudget(price, essenceBudget)')
    expect(qaBotSource).toContain('shopResult.shop_data.budget_limited = true')
    expect(qaBotSource).toContain('shopResult.shop_data.budget_blocked_price = budgetBlockedPrice')
  })

  it('transmet la cohorte au test shop et documente le refus d\'achat', () => {
    expect(qaBotSource).toContain('testShopSystem(page, runKey, shopLevel, runRecord.cohort)')
    expect(qaBotSource).toContain('async function testShopSystem(page, runKey, characterLevel = null, cohort = null)')
  })
})

// ── XP win/loss by fight type (#1303) ──
// The global XP win/loss ratio mixes PvP (100/25), idle, boss (~478 XP) and
// PvE economies. Boss defeats alone drag the loss average up and make the
// matchmaking signal unreadable, so the report must expose a per-type
// breakdown and only flag matchmaking on the PvP bucket.

type XpFightType = 'pvp' | 'idle' | 'boss' | 'pve'

interface XpTypeBreakdownMirror {
  win_avg: number
  loss_avg: number
  ratio: number
  n_win: number
  n_loss: number
}

function isBossFightMirror(f: FightRecord): boolean {
  return f.fight_type === 'boss' || (typeof f.monster_name === 'string' && f.monster_name.trim() === 'VOID TITAN')
}

function fightTypeOfMirror(f: FightRecord): XpFightType {
  if (isBossFightMirror(f)) return 'boss'
  if (f.fight_type === 'pve') return 'pve'
  if (f.fight_type === 'idle') return 'idle'
  return 'pvp'
}

function computeXpTypeBreakdownMirror(fights: FightRecord[]): XpTypeBreakdownMirror {
  const winXp = fights
    .filter((f): f is FightRecord & { xp: number } => f.result === 'victory' && typeof f.xp === 'number')
    .map(f => f.xp)
  const lossXp = fights
    .filter((f): f is FightRecord & { xp: number } => f.result === 'defeat' && typeof f.xp === 'number')
    .map(f => f.xp)
  const winAvg = winXp.length > 0 ? winXp.reduce((s, v) => s + v, 0) / winXp.length : 0
  const lossAvg = lossXp.length > 0 ? lossXp.reduce((s, v) => s + v, 0) / lossXp.length : 0
  const ratio = winAvg > 0 && lossAvg > 0 ? winAvg / lossAvg : 0
  return {
    win_avg: Math.round(winAvg * 100) / 100,
    loss_avg: Math.round(lossAvg * 100) / 100,
    ratio: Math.round(ratio * 100) / 100,
    n_win: winXp.length,
    n_loss: lossXp.length,
  }
}

function computeXpByFightTypeMirror(
  fights: FightRecord[],
  idleFights: IdleFightRecord[],
): Record<XpFightType, XpTypeBreakdownMirror> {
  const idleFromFights = fights.filter(f => fightTypeOfMirror(f) === 'idle')
  const idleAsFights = idleFights.map(f => ({
    result: f.result,
    xp: f.xp,
    fight_duration_ms: 0,
    fight_type: 'idle' as const,
  }))
  return {
    pvp: computeXpTypeBreakdownMirror(fights.filter(f => fightTypeOfMirror(f) === 'pvp')),
    idle: computeXpTypeBreakdownMirror([...idleFromFights, ...idleAsFights]),
    boss: computeXpTypeBreakdownMirror(fights.filter(f => f.fight_type === 'boss')),
    pve: computeXpTypeBreakdownMirror(fights.filter(f => fightTypeOfMirror(f) === 'pve')),
  }
}

const MIN_PVP_XP_FIGHTS = 20

function xpRatioSuggestions(
  xpByFightType: Record<XpFightType, XpTypeBreakdownMirror>,
  recentPvpCoverage: number,
): string[] {
  const out: string[] = []
  const pvp = xpByFightType.pvp
  if (recentPvpCoverage < MIN_PVP_XP_FIGHTS) return out
  if (pvp.n_win === 0 || pvp.n_loss === 0) return out
  if (pvp.ratio < 2) out.push('matchmaking')
  if (pvp.ratio > 8) out.push('punishing')
  return out
}

describe('QA XP Win/Loss By Fight Type (#1303)', () => {
  function pvp(result: 'victory' | 'defeat', xp: number): FightRecord {
    return { result, xp, fight_duration_ms: 5000, fight_type: 'pvp' }
  }
  function boss(result: 'victory' | 'defeat', xp: number): FightRecord {
    return { result, xp, fight_duration_ms: 30000, fight_type: 'boss', monster_name: 'VOID TITAN' }
  }
  function pve(result: 'victory' | 'defeat', xp: number): FightRecord {
    return { result, xp, fight_duration_ms: 5000, fight_type: 'pve', monster_name: 'GOBLIN' }
  }
  function idleRecord(result: 'victory' | 'defeat', xp: number): IdleFightRecord {
    return { result, xp, essence: 0.1, monster: 'GOBLIN' }
  }

  function pollutedFights(): { fights: FightRecord[]; idle: IdleFightRecord[] } {
    const fights: FightRecord[] = [
      ...Array.from({ length: 25 }, () => pvp('victory', 100)),
      ...Array.from({ length: 5 }, () => pvp('defeat', 25)),
      ...Array.from({ length: 2 }, () => boss('victory', 500)),
      ...Array.from({ length: 24 }, () => boss('defeat', 478)),
      ...Array.from({ length: 4 }, () => pve('victory', 87)),
      ...Array.from({ length: 1 }, () => pve('defeat', 25)),
    ]
    const idle: IdleFightRecord[] = [
      ...Array.from({ length: 7 }, () => idleRecord('victory', 51)),
      ...Array.from({ length: 3 }, () => idleRecord('defeat', 51)),
    ]
    return { fights, idle }
  }

  it('isole le ratio PvP de l’économie boss/idle/PvE', () => {
    const { fights, idle } = pollutedFights()
    const breakdown = computeXpByFightTypeMirror(fights, idle)

    expect(breakdown.pvp).toMatchObject({ win_avg: 100, loss_avg: 25, ratio: 4, n_win: 25, n_loss: 5 })
    expect(breakdown.boss).toMatchObject({ win_avg: 500, loss_avg: 478, n_win: 2, n_loss: 24 })
    expect(breakdown.pve).toMatchObject({ win_avg: 87, loss_avg: 25, ratio: 3.48, n_win: 4, n_loss: 1 })
    expect(breakdown.idle.n_win).toBe(7)
    expect(breakdown.idle.n_loss).toBe(3)
    expect(breakdown.idle.win_avg).toBe(51)
  })

  it('le ratio global est pollué alors que le PvP pur est à la cible', () => {
    const { fights } = pollutedFights()
    const wins = fights.filter(f => f.result === 'victory' && f.xp !== null)
    const losses = fights.filter(f => f.result === 'defeat' && f.xp !== null)
    const globalRatio =
      (wins.reduce((s, f) => s + (f.xp ?? 0), 0) / wins.length) /
      (losses.reduce((s, f) => s + (f.xp ?? 0), 0) / losses.length)

    const breakdown = computeXpByFightTypeMirror(fights, [])
    expect(globalRatio).toBeLessThan(1.5)
    expect(breakdown.pvp.ratio).toBe(4)
  })

  it('ne déclenche aucune suggestion matchmaking sous 20 combats PvP récents', () => {
    const { fights, idle } = pollutedFights()
    const breakdown = computeXpByFightTypeMirror(fights, idle)
    expect(xpRatioSuggestions(breakdown, 19)).toEqual([])
  })

  it('déclenche la suggestion matchmaking PvP quand la couverture récente est suffisante', () => {
    const { fights, idle } = pollutedFights()
    const breakdown = computeXpByFightTypeMirror(fights, idle)
    breakdown.pvp.ratio = 1.7
    expect(xpRatioSuggestions(breakdown, 20)).toEqual(['matchmaking'])
  })

  it('ignore un ratio global bas si le PvP ne porte pas assez de combats', () => {
    const breakdown = computeXpByFightTypeMirror([], [])
    expect(xpRatioSuggestions(breakdown, 0)).toEqual([])
  })

  describe('analyze-qa-stats.ts source contract (#1303)', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')

    it('expose xp_by_fight_type avec les quatre économies', () => {
      expect(source).toContain('xp_by_fight_type')
      expect(source).toContain('computeXpTypeBreakdown')
      expect(source).toContain('n_win')
      expect(source).toContain('n_loss')
    })

    it('conserve les métriques globales pour la rétrocompatibilité du tech-lead', () => {
      expect(source).toContain('avg_xp_per_fight:')
      expect(source).toContain('xp_win_loss_ratio:')
    })

    it('gate la suggestion matchmaking sur le ratio PvP et la couverture récente', () => {
      expect(source).toContain('MIN_PVP_XP_FIGHTS')
      expect(source).toContain('recentPvpCoverage')
      expect(source).toContain('xpByFightType.pvp')
      expect(source).toContain('#570/#725')
    })
  })
})

// ── XP boss bucket bounded to fight_type boss (#1342) ──
// VOID TITAN emitted as 'pve' is still a boss fight for the count/win rate,
// but its XP must not feed the boss economy: those legacy records carry
// ~574 XP per defeat and made xp_by_fight_type.boss unreadable. #1340 removed
// them from pve_analysis; the per-type breakdown needs the same bound.
describe('QA XP boss bucket bounded to fight_type boss (#1342)', () => {
  function pveVoidTitanDefeat(xp: number | null): FightRecord {
    return { result: 'defeat', xp, fight_duration_ms: 30000, fight_type: 'pve', monster_name: 'VOID TITAN' }
  }
  function bossCapture(result: 'victory' | 'defeat', xp: number): FightRecord {
    return { result, xp, fight_duration_ms: 30000, fight_type: 'boss', monster_name: 'VOID TITAN' }
  }

  it("n'attribue pas l'XP des défaites VOID TITAN émises en pve au bucket boss", () => {
    const fights: FightRecord[] = [
      ...Array.from({ length: 14 }, () => pveVoidTitanDefeat(574.36)),
      bossCapture('defeat', 0),
    ]
    const breakdown = computeXpByFightTypeMirror(fights, [])
    expect(breakdown.boss.n_loss).toBe(1)
    expect(breakdown.boss.loss_avg).toBe(0)
  })

  it('laisse le bucket boss vide quand seuls des records pve VOID TITAN portent de XP', () => {
    const fights: FightRecord[] = [pveVoidTitanDefeat(574), pveVoidTitanDefeat(null)]
    const breakdown = computeXpByFightTypeMirror(fights, [])
    expect(breakdown.boss).toMatchObject({ win_avg: 0, loss_avg: 0, ratio: 0, n_win: 0, n_loss: 0 })
  })

  it('conserve les victoires et défaites du chemin captureBossFight', () => {
    const fights: FightRecord[] = [
      bossCapture('victory', 500),
      bossCapture('defeat', 478),
      pveVoidTitanDefeat(574),
    ]
    const breakdown = computeXpByFightTypeMirror(fights, [])
    expect(breakdown.boss).toMatchObject({ win_avg: 500, loss_avg: 478, ratio: 1.05, n_win: 1, n_loss: 1 })
  })

  describe('analyze-qa-stats.ts source contract (#1342)', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')

    it('alimente xp_by_fight_type.boss avec les seuls records fight_type boss', () => {
      expect(source).toContain('computeXpTypeBreakdown(bossXpCaptureFights)')
    })
  })
})

const RECENT_WINDOW_RUNS_MIRROR = 30

type EssenceFlow = NonNullable<NonNullable<RunRecord['essence']>['flow']>

interface EssenceFlowSampleSizes {
  idle_gained: number
  forge_net: number
  shop_spent: number
  salvage_gained: number
  fusion_cost: number
  upgrade_cost: number
}

function computeEssenceFlowSampleSizes(runs: RunRecord[]): EssenceFlowSampleSizes {
  const flows = runs
    .map(r => r.essence?.flow)
    .filter((f): f is EssenceFlow => f !== null && f !== undefined)
  const count = (key: keyof EssenceFlow): number => flows.filter(f => typeof f[key] === 'number').length
  return {
    idle_gained: count('idle_gained'),
    forge_net: count('forge_net'),
    shop_spent: count('shop_cost'),
    salvage_gained: count('salvage_gained'),
    fusion_cost: count('fusion_cost'),
    upgrade_cost: count('upgrade_cost'),
  }
}

describe('QA Recent-Window Aggregates (#1340)', () => {
  describe('computeShopSimulatedAnalysis — prix bornés à la fenêtre récente', () => {
    function shopRun(date: string, prices: number[], essenceBefore = 200): RunRecord {
      return {
        date, run: date, character: 'QA', fights: [], errors: [],
        shop: { essence_before: essenceBefore },
        shop_data: { offers: prices.map((price, i) => ({ name: `Offer ${i}`, rarity: 'common', price })) },
      }
    }

    it('ignore les prix pré-#1265 (18/350) portés par les runs hors fenêtre', () => {
      const legacy = shopRun('2026-08-25T05:00:00.000Z', [18, 350])
      const recent = Array.from({ length: RECENT_WINDOW_RUNS_MIRROR }, (_, i) =>
        shopRun(`2026-10-${String((i % 28) + 1).padStart(2, '0')}T05:00:00.000Z`, [30, 58, 50, 88])
      )
      const result = computeShopSimulatedAnalysis([legacy, ...recent])
      expect(result).not.toBeNull()
      expect(result!.min_offer_price).toBe(30)
      expect(result!.max_offer_price).toBe(88)
      expect(result!.avg_offer_price).toBe(56.5)
    })

    it('garde les prix de la fenêtre courante quand aucun run historique ne subsiste', () => {
      const runs = [shopRun('2026-10-29T05:00:00.000Z', [30, 58, 50])]
      const result = computeShopSimulatedAnalysis(runs)
      expect(result!.min_offer_price).toBe(30)
      expect(result!.max_offer_price).toBe(58)
    })

    it('conserve les compteurs de runs et le funnel sur le corpus complet', () => {
      const legacy = shopRun('2026-08-25T05:00:00.000Z', [18, 350])
      const recent = Array.from({ length: RECENT_WINDOW_RUNS_MIRROR }, (_, i) =>
        shopRun(`2026-10-${String((i % 28) + 1).padStart(2, '0')}T05:00:00.000Z`, [30, 58, 50, 88])
      )
      const result = computeShopSimulatedAnalysis([legacy, ...recent])
      expect(result!.runs_with_shop_data).toBe(31)
    })
  })

  describe('computeShopRealAnalysis — min_offer_price borné à la fenêtre récente', () => {
    function cohortRun(date: string, prices: number[], cohort: { name: string; essence_budget: number | null } | null): RunRecord {
      return {
        date, run: date, character: 'QA', fights: [], errors: [],
        shop: { essence_before: 300 },
        shop_data: { offers: prices.map((price, i) => ({ name: `Offer ${i}`, rarity: 'common', price })) },
        cohort,
      }
    }

    it("n'hérite plus du plancher pré-#726 (18) pour la cohorte unsegmented", () => {
      const legacy = cohortRun('2026-08-25T05:00:00.000Z', [18, 350], null)
      const recent = Array.from({ length: RECENT_WINDOW_RUNS_MIRROR }, (_, i) =>
        cohortRun(`2026-10-${String((i % 28) + 1).padStart(2, '0')}T05:00:00.000Z`, [30, 88], { name: 'QA-END', essence_budget: 60 })
      )
      const analysis = computeShopRealAnalysis([legacy, ...recent])
      expect(analysis).not.toBeNull()
      const unsegmented = analysis!.cohorts.find(c => c.cohort === 'unsegmented')
      expect(unsegmented).toBeDefined()
      expect(unsegmented!.min_offer_price).toBeNull()
      const end = analysis!.cohorts.find(c => c.cohort === 'QA-END')
      expect(end!.min_offer_price).toBe(30)
    })

    it('garde le min de la cohorte quand tous ses runs sont dans la fenêtre', () => {
      const runs = [cohortRun('2026-10-29T05:00:00.000Z', [30, 58], { name: 'QA-MID', essence_budget: 40 })]
      const analysis = computeShopRealAnalysis(runs)
      expect(analysis!.cohorts[0].min_offer_price).toBe(30)
    })
  })

  describe('computeBossFightStats — XP limitée au chemin captureBossFight', () => {
    it("n'attribue pas l'XP PvE des défaites VOID TITAN à boss_avg_xp_per_loss", () => {
      const fights: FightRecord[] = [
        { result: 'defeat', xp: 574, fight_duration_ms: 30000, fight_type: 'pve', monster_name: 'VOID TITAN' },
        { result: 'defeat', xp: 894, fight_duration_ms: 30000, fight_type: 'pve', monster_name: 'VOID TITAN' },
        { result: 'defeat', xp: 0, fight_duration_ms: 30000, fight_type: 'boss', monster_name: 'VOID TITAN' },
      ]
      const stats = computeBossFightStats(fights)
      expect(stats.boss_fights).toBe(3)
      expect(stats.boss_win_rate).toBe(0)
      expect(stats.boss_avg_xp_per_loss).toBe(0)
    })

    it('retourne null quand seuls des records pve classés boss portent de l XP', () => {
      const fights: FightRecord[] = [
        { result: 'defeat', xp: 574, fight_duration_ms: 30000, fight_type: 'pve', monster_name: 'VOID TITAN' },
        { result: 'defeat', xp: null, fight_duration_ms: 30000, fight_type: 'pve', monster_name: 'VOID TITAN' },
      ]
      const stats = computeBossFightStats(fights)
      expect(stats.boss_fights).toBe(2)
      expect(stats.boss_win_rate).toBe(0)
      expect(stats.boss_avg_xp_per_loss).toBeNull()
      expect(stats.boss_avg_xp_per_fight).toBeNull()
    })

    it('garde boss_fights et le win rate sur la classification isBossFight', () => {
      const fights: FightRecord[] = [
        { result: 'victory', xp: 360, fight_duration_ms: 20000, fight_type: 'boss', monster_name: 'VOID TITAN' },
        { result: 'defeat', xp: 700, fight_duration_ms: 30000, fight_type: 'pve', monster_name: 'VOID TITAN' },
      ]
      const stats = computeBossFightStats(fights)
      expect(stats.boss_fights).toBe(2)
      expect(stats.boss_win_rate).toBe(0.5)
      expect(stats.boss_avg_xp_per_fight).toBe(360)
      expect(stats.boss_avg_xp_per_loss).toBeNull()
    })
  })

  describe('essence flow sample sizes', () => {
    it('expose un n par moyenne, sur des dénominateurs distincts', () => {
      const runs: RunRecord[] = [
        {
          date: '2026-10-29', run: 'r1', character: 'QA', fights: [], errors: [],
          essence: { flow: { idle_gained: 12, forge_net: null, shop_cost: null, salvage_gained: null, fusion_cost: null, upgrade_cost: null } },
        },
        {
          date: '2026-10-29', run: 'r2', character: 'QA', fights: [], errors: [],
          essence: { flow: { idle_gained: null, forge_net: null, shop_cost: 50, salvage_gained: 8, fusion_cost: null, upgrade_cost: null } },
        },
        {
          date: '2026-10-29', run: 'r3', character: 'QA', fights: [], errors: [],
          essence: { flow: { idle_gained: null, forge_net: -4, shop_cost: null, salvage_gained: null, fusion_cost: 20, upgrade_cost: 15 } },
        },
      ]
      expect(computeEssenceFlowSampleSizes(runs)).toEqual({
        idle_gained: 1,
        forge_net: 1,
        shop_spent: 1,
        salvage_gained: 1,
        fusion_cost: 1,
        upgrade_cost: 1,
      })
    })

    it('compte zéro quand aucun run ne porte de flow', () => {
      expect(computeEssenceFlowSampleSizes([])).toEqual({
        idle_gained: 0,
        forge_net: 0,
        shop_spent: 0,
        salvage_gained: 0,
        fusion_cost: 0,
        upgrade_cost: 0,
      })
    })
  })

  describe('analyze-qa-stats.ts source contract (#1340)', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'analyze-qa-stats.ts'), 'utf-8')

    it('borne les prix shop à la fenêtre récente', () => {
      expect(source).toContain('computeRecentOfferPriceStats')
      expect(source).toContain('RECENT_WINDOW_RUNS')
    })

    it('limite les métriques XP boss aux records fight_type boss', () => {
      expect(source).toContain('bossXpCaptureFights')
    })

    it('expose un n par moyenne du flow essence', () => {
      expect(source).toContain('flow_sample_sizes')
    })
  })
})
