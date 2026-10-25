/**
 * QA Stats Analyzer
 *
 * Reads qa/stats.json to produce a structured balance report.
 * Run: npx tsx scripts/analyze-qa-stats.ts
 *
 * Output:
 *   - stdout: human-readable balance report
 *   - qa/analysis-latest.json: machine-readable metrics for the tech-lead agent
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { isPurchaseWithinBudget } from '../src/utils/qa-bot-helpers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const STATS_FILE = join(ROOT, 'qa', 'stats.json')
const ANALYSIS_OUTPUT = join(ROOT, 'qa', 'analysis-latest.json')

interface FightRecord {
  result: 'victory' | 'defeat' | 'draw'
  xp: number | null
  fight_duration_ms: number
  max_hp?: number | null
  fight_type?: 'pvp' | 'pve' | 'idle' | 'boss'   // track PvP vs PvE vs idle vs boss fights
  monster_name?: string | null  // PvE monster name if applicable
  xp_before_modifier?: number | null  // PvE XP before 2.5x modifier (displayed value)
  xp_after_modifier?: number | null   // PvE XP after 2.5x modifier (actual saved value)
  boss_hp_left?: number | null  // boss HP remaining after a boss fight (persistent pool)
  boss_max_hp?: number | null   // boss max HP pool
}

interface LevelUpEvent {
  fight_number: number
  levels_gained: number
  points_to_allocate: number
  previous_level: number
  new_level: number
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

interface EssenceFlow {
  idle_gained: number | null
  fights_change: number | null
  salvage_gained: number | null
  fusion_cost: number | null
  upgrade_cost: number | null
  forge_net: number | null
  shop_cost: number | null
  net_change: number | null
}

interface ForgeResult {
  essence_before: number | null
  essence_after_salvage: number | null
  essence_after_fusion: number | null
  essence_after_upgrade: number | null
  salvage_essence_gained: number | null
  fusion_cost: number | null
  upgrade_cost: number | null
  essence_after: number | null
}

interface ShopOffer {
  name: string
  rarity?: string | null
  price: number | null
}

interface EssenceData {
  before_idle: number | null
  after_idle: number | null
  per_fight: (number | null)[]
  forge_before: number | null
  forge_after_salvage: number | null
  forge_after_fusion: number | null
  forge_after_upgrade: number | null
  forge_after: number | null
  shop_before: number | null
  shop_after: number | null
  final: number | null
  flow: EssenceFlow
}

interface RunRecord {
  date: string
  run: string
  character: string
  character_action?: string | null
  replaced_character?: string | null
  character_type?: 'fresh' | 'persistent' | null  // #731: persistent QA character vs fresh first-session runs
  /** Cohorte QA du run (#1230) : profil de dépense résolu au début du run. */
  cohort?: { name: string; essence_budget: number | null } | null
  fights: FightRecord[]
  idle_fights?: IdleFightRecord[]
  idle_runner?: {
    xp_events?: Array<{ result?: string; xp?: number; monster?: string; essence?: number | null }>
    cycles_observed?: number
    victories?: number
    xp_total?: number
    monsters_faced?: string[]
  }
  lootbox?: LootboxResult | null
  auto_mode_enabled?: boolean
  auto_mode_sync_ok?: boolean
  arena_status?: {
    fightButtonLabel: string
    fightButtonVisible: boolean
    fightButtonEnabled: boolean
    fightsAvailable: number | null
    isResting: boolean
    hasFightCta: boolean
    isSearching: boolean
    isPveLocked: boolean
  } | null
  initial_stats?: Record<string, number> | null
  initial_level?: number | null
  initial_xp?: { current: number; max: number } | null
  initial_max_hp?: number | null
  initial_equipment?: Array<{ slot: string; name: string; rarity?: string }> | null
  initial_streak?: number | null
  initial_essence?: number | null
  final_stats?: { level: number | null; xp: number | null; wins: number | null; losses: number | null } | null
  final_character_stats?: Record<string, number> | null
  final_max_hp?: number | null
  final_equipment?: Array<{ slot: string; name: string; rarity?: string }> | null
  final_streak?: number | null
  final_essence?: number | null
  lootbox_equipment?: Array<{ slot: string; name: string; rarity?: string }> | null
  lootbox_streak?: number | null
  pve_data?: {
    fights: number
    wins: number
    xp_total: number
    monsters_faced: string[]
    pve_shifted?: boolean
    boss_fights?: number
    boss_wins?: number
    boss_name?: string | null
    boss_locked_level?: number | null
    boss_level?: number | null
    boss_hp?: number | null
    boss_max_hp?: number | null
  }
  level_up_events?: LevelUpEvent[]
  progression_curve?: { level: number; total_xp: number; xp_for_next: number; percent: number }
  essence?: EssenceData
  forge?: ForgeResult | null
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
    offers?: Array<ShopOffer>
    purchased_offer?: number | null
    essence_after_purchase?: number | null
    /** #1230 : budget de la cohorte pour une offre, et issue de la décision. */
    essence_budget?: number | null
    budget_limited?: boolean | null
    budget_blocked_price?: number | null
  }
  errors: string[]
  load_times_ms?: Record<string, number>
}

interface TrendWindow {
  label: string
  count: number
  fights_count: number
  win_rate: number
  avg_fights: number
  avg_level: number | null
  avg_xp_per_fight: number
  avg_duration_ms: number
}

interface PveAnalysis {
  total_fights: number
  win_rate: number
  avg_xp_per_fight: number
  avg_duration_ms: number
  monsters_faced: Record<string, number>  // monster name → encounter count
  avg_xp_before_modifier: number | null   // average PvE XP before 2.5x modifier (displayed value)
  avg_xp_after_modifier: number | null    // average PvE XP after 2.5x modifier (actual saved value)
  pve_xp_ratio: number | null             // ratio of PvE avg_xp_after_modifier to PvP avg_xp_per_win
  pve_shifted: boolean                    // PvE mode = raid boss fight (LOCKED LVL 30); monster PvE is stale (#705)
  boss_observations: number               // runs that detected the locked boss (PvE-observation)
  boss_fights: number                     // actual boss fights (fight_type === 'boss')
  boss_win_rate: number | null            // boss fight win rate
  boss_avg_xp_per_fight: number | null    // average XP per won boss fight (losses never grant XP)
  boss_avg_xp_per_loss: number | null     // average XP per lost boss fight (expected 0)
  boss_avg_hp_left: number | null         // average boss HP remaining after boss fights (pool progress)
}

interface EquipmentAnalysis {
  runs_with_data: number
  item_names: string[]
  unique_item_count: number
}

// #731: the QA bot reuses a dedicated persistent character between runs to build
// longitudinal data (equipment, streak, essence, shop, mid-game levels). Fresh
// runs (weekly calibration + legacy) must be distinguished from persistent runs.
interface CharacterTypeBreakdown {
  fresh_runs: number
  persistent_runs: number
  unknown_runs: number
}

type StreakCohort = 'persistent' | 'fresh' | 'unknown'

interface StreakCohortAnalysis {
  cohort: StreakCohort
  runs_with_data: number
  avg_initial_streak: number
  avg_final_streak: number
}

interface StreakStats {
  avg_initial_streak: number
  avg_final_streak: number
  runs_with_data: number
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
  avg_initial_max_hp: number       // average max HP at run start
  avg_final_max_hp: number         // average max HP at run end
  avg_hp_growth_per_run: number    // average increase in max HP per run
  runs_with_hp_data: number
  runs_excluded_by_character_replacement: number
}

interface LootRarityDistribution {
  common: number
  uncommon: number
  rare: number
  epic: number
  legendary: number
  unknown: number
}

interface EssenceAnalysis {
  runs_with_essence_data: number
  avg_essence_gained_per_run: number
  avg_initial_essence: number
  avg_final_essence: number
  avg_idle_essence_gained: number | null
  avg_forge_net: number | null
  avg_shop_spent: number | null
  avg_salvage_gained: number | null
  avg_fusion_cost: number | null
  avg_upgrade_cost: number | null
  runs_with_flow_data: number
  runs_excluded_by_character_replacement: number
}

/** #1300 : funnel shop complet, y compris les runs sans offre (shop verrouillé). */
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
  /** #1230 : runs abordables mais bloqués par le budget de la cohorte. */
  budget_limited_runs: number
  /** #1300 : funnel imbriqué, en plus des champs aplatis ci-dessus. */
  funnel: ShopFunnel
}

/** Ventilation par cohorte QA (#1230) : quel profil produit quelle métrique. */
interface ShopCohortAnalysis extends ShopFunnel {
  cohort: string
  essence_budget: number | null
  runs_with_shop_data: number
  runs_with_purchase: number
  real_purchase_rate: number | null
  budget_limited_runs: number
  avg_essence_before: number | null
  min_offer_price: number | null
  /** #1300 : funnel imbriqué, en plus des champs aplatis ci-dessus. */
  funnel: ShopFunnel
}

interface ShopRealAnalysis extends ShopFunnel {
  runs_with_shop_data: number
  runs_with_purchase: number
  real_purchase_rate: number | null
  avg_purchase_cost: number | null
  purchase_rarity_distribution: Record<string, number>
  cheapest_offer_share: number | null
  /** #1230 : runs où l'offre était abordable mais hors budget de cohorte. */
  budget_limited_runs: number
  cohorts: ShopCohortAnalysis[]
  /** #1300 : funnel imbriqué, en plus des champs aplatis ci-dessus. */
  funnel: ShopFunnel
}

interface IdleAnalysis {
  runs_with_idle_data: number
  total_idle_fights: number
  idle_win_rate: number
  avg_idle_xp_per_fight: number
  avg_idle_essence_per_fight: number
  total_idle_essence: number
}

interface DataFreshness {
  last_valid_run_at: string | null
  trailing_error_runs: number
  trailing_empty_runs: number
  stale: boolean
}

interface ProgressionCurveSummary {
  runs_with_data: number
  avg_level: number
  avg_xp_progress_percent: number
  avg_xp_for_next: number
}

interface XpTypeBreakdown {
  win_avg: number
  loss_avg: number
  ratio: number
  n_win: number
  n_loss: number
}

interface XpByFightType {
  pvp: XpTypeBreakdown
  idle: XpTypeBreakdown
  boss: XpTypeBreakdown
  pve: XpTypeBreakdown
}

interface AnalysisReport {
  generated_at: string
  total_runs: number
  total_fights: number
  successful_runs: number
  halfway_runs: number
  error_runs: number
  empty_runs: number
  data_freshness: DataFreshness
  recent_fight_coverage: number
  character_type_breakdown: CharacterTypeBreakdown
  persistent_level_distribution: Record<string, number>
  win_rate: number
  loss_rate: number
  draw_rate: number
  avg_fights_per_run: number
  avg_xp_per_fight: number
  avg_xp_per_win: number
  avg_xp_per_loss: number
  xp_win_loss_ratio: number
  xp_by_fight_type: XpByFightType
  avg_fight_duration_ms: number
  min_fight_duration_ms: number
  max_fight_duration_ms: number
  median_fight_duration_ms: number
  level_distribution: Record<string, number>
  avg_level_gained_per_run: number
  avg_initial_stats: Record<string, number> | null
  avg_final_stats: Record<string, number> | null
  hp_analysis: HpAnalysis | null
  essence_analysis: EssenceAnalysis | null
  idle_analysis: IdleAnalysis | null
  progression_curve: ProgressionCurveSummary | null
  shop: {
    simulated: ShopSimulatedAnalysis | null
    real: ShopRealAnalysis | null
  }
  lootbox: {
    runs_with_lootbox: number
    lootboxes_opened: number
    acquire_rate: number
    rarity_distribution: LootRarityDistribution
  }
  trends: TrendWindow[]
  pve_analysis: PveAnalysis | null
  equipment_analysis: EquipmentAnalysis | null
  streak_analysis: StreakAnalysis | null
  fight_type_breakdown: {
    pvp_fights: number
    pve_fights: number
    idle_fights: number
    boss_fights: number
    pvp_win_rate: number
    pve_win_rate: number
    idle_win_rate: number
    boss_win_rate: number | null
  }
  issues: string[]
  suggestions: string[]
}

function loadStats(): RunRecord[] {
  if (!existsSync(STATS_FILE)) {
    console.error(`Stats file not found: ${STATS_FILE}`)
    return []
  }
  return JSON.parse(readFileSync(STATS_FILE, 'utf-8'))
}

function computeXpTypeBreakdown(fights: FightRecord[]): XpTypeBreakdown {
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

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Alert windows: issues/suggestions use a recent window so stale all-time
// cumulative data (e.g. pre-fix eras) does not keep triggering alerts (#730).
const RECENT_WINDOW_RUNS = 30
const RECENT_IDLE_RUNS = 15

// Real character stat keys (short labels parsed from the arena panel). The
// structured parse can also capture non-stat counters (e.g. 'fights' from the
// PvE panel) which must not be compared against STATS.MIN_VALUE/MAX_VALUE (#730).
const STAT_KEYS = new Set(['str', 'vit', 'dex', 'luk', 'int', 'foc'])

// A run "failed completely" when it recorded errors but no fights. Partial runs
// (halfway) have fights but also recorded errors. Shared by the all-time report
// categorization and the recent-window error-rate alerts (#730).
function isErrorRun(r: RunRecord): boolean {
  return !!r.errors && r.errors.length > 0 && (!r.fights || r.fights.length === 0)
}

// A run carrying NO combat data and NO error — e.g. every attempt skipped with
// no_start/exhausted (#1186). Such runs were previously counted as "valid" by
// computeDataFreshness, keeping data_freshness green while the QA window held
// nothing but these silent zeros.
function isEmptyRun(r: RunRecord): boolean {
  return (!r.fights || r.fights.length === 0) && (!r.errors || r.errors.length === 0)
}

// Freshness staleness threshold: the number of consecutive trailing error runs
// plus empty runs after which aggregates must be considered stale (#730, #1186).
const FRESHNESS_STALE_RUNS = 10

// Minimum total fights the recent alert window must carry for balance signals
// (win rate, idle, shop, progression, streak) to be actionable (#1186).
const MIN_RECENT_FIGHTS = 10

// Minimum fights a trend window must carry before a win-rate trend alert fires.
// With fightsPerRun: 1, last_3/last_5 hold 3/5 fights: run-count guards alone
// produced false-positive declining/swing alerts on tiny combat windows (#1229).
const MIN_TREND_FIGHTS = 10

// Minimum PvP fights in the recent window before the XP win/loss ratio drives
// a matchmaking suggestion. The global ratio mixes PvP (100/25), idle, boss
// (~478 XP) and PvE economies; only a PvP-only window can be read as a
// matchmaking symptom (#1303).
const MIN_PVP_XP_FIGHTS = 20

// Minimum runs with captured shop offers before the real purchase rate drives
// the price suggestion; below it, the simulated affordability proxy is used (#1229).
const REAL_SHOP_MIN_RUNS = 10

function computeDataFreshness(stats: RunRecord[]): DataFreshness {
  let trailing_error_runs = 0
  let trailing_empty_runs = 0
  let lastValid: RunRecord | undefined
  for (let i = stats.length - 1; i >= 0; i--) {
    const r = stats[i]
    if (!isErrorRun(r) && !isEmptyRun(r)) {
      lastValid = r
      break
    }
    if (isErrorRun(r)) trailing_error_runs++
    else trailing_empty_runs++
  }
  return {
    last_valid_run_at: lastValid?.date ?? null,
    trailing_error_runs,
    trailing_empty_runs,
    stale: trailing_error_runs + trailing_empty_runs >= FRESHNESS_STALE_RUNS,
  }
}

// #731: a persistent run uses the dedicated QA character (character_type ===
// 'persistent'). Fresh runs calibrate the first-session experience; legacy runs
// have no character_type at all and are treated as unknown.
function isPersistentRun(r: RunRecord): boolean {
  return r.character_type === 'persistent'
}

function isHalfwayRun(r: RunRecord): boolean {
  return !!r.fights && r.fights.length > 0 && !!r.errors && r.errors.length > 0
}

function isStatKey(key: string): boolean {
  return STAT_KEYS.has(key)
}

// Idle fights come from structured idle_fights[] (new) or legacy idle_runner
// xp_events (backward compat). Shared by the all-time aggregation and the
// recent-window idle win-rate alert (#730).
function collectIdleFights(runs: RunRecord[]): IdleFightRecord[] {
  const fights: IdleFightRecord[] = []
  for (const r of runs) {
    if (r.idle_fights && r.idle_fights.length > 0) {
      fights.push(...r.idle_fights)
    } else if (r.idle_runner && r.idle_runner.xp_events && r.idle_runner.xp_events.length > 0) {
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

// A run that replaces the character mid-run (QA bot `created-after-*` actions)
// reads initial_max_hp on the OLD character and final_max_hp on the NEW one, so
// final drops sharply. Such runs must be excluded from HP/essence growth metrics
// because they mix two different characters (#696).
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

function resolveStreakCohort(r: RunRecord): StreakCohort {
  if (r.character_type === 'persistent') return 'persistent'
  if (r.character_type === 'fresh') return 'fresh'
  return 'unknown'
}

function computeStreakStats(runs: RunRecord[]): StreakStats | null {
  const STREAK_MIN = 0
  const STREAK_MAX = 100
  const isValidStreak = (v: number) => v >= STREAK_MIN && v <= STREAK_MAX

  const runsWithInitStreak = runs.filter((r): r is RunRecord & { initial_streak: number } => typeof r.initial_streak === 'number')
  const runsWithFinalStreak = runs.filter((r): r is RunRecord & { final_streak: number } => typeof r.final_streak === 'number')
  const runsWithLootboxStreak = runs.filter((r): r is RunRecord & { lootbox_streak: number } => typeof r.lootbox_streak === 'number')
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

function hasShopResult(r: RunRecord): boolean {
  return r.shop != null || r.shop_data != null
}

// #1300 : le funnel compte aussi les runs SANS offre (shop verrouillé, inventaire
// inaccessible). Les ignorer faisait disparaître la cohorte QA-FRESH des stats :
// 10 runs verrouillés + 2 runs inabordables ressemblaient à une absence de mesure.
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

// Shop simulated affordability (#711): real purchases are near-impossible for
// fresh/mid-game QA characters (prices 150/250/350 💎 vs avg ~14 💎), so
// avg_shop_spent stays null and the economic balance is blind. We simulate a
// rational purchase from the observed offer pool + essence_before: a run
// "would purchase" when it can afford the cheapest offer. The resulting
// simulated_purchase_rate proxies the real purchase rate for pricing decisions
// (thresholds: <10% → lower SHOP_OFFERS prices, >60% → raise them).
function computeShopSimulatedAnalysis(runs: RunRecord[]): ShopSimulatedAnalysis | null {
  const runsWithShopData = runs.filter(
    (r): r is RunRecord & { shop_data: { offers: ShopOffer[] } } =>
      r.shop_data?.offers != null && r.shop_data.offers.length > 0
  )
  if (runsWithShopData.length === 0) return null

  const allPrices: number[] = []
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
    allPrices.push(...prices)

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
      // #1230 : la cohorte ne paie que ce que son budget absorbe. Sans budget
      // (runs historiques), on garde la règle d'affordabilité pure.
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
    budget_limited_runs: budgetLimitedRuns,
  }
}

// Real shop purchase rate (#1229): the runs already carry the observed outcome
// (shop.purchased, shop.cost, shop.item_rarity, shop_data.purchased_offer). The
// simulated affordability proxy measures whether the player *can* afford the
// cheapest offer (essence >= price) and is saturated by the persistent QA
// character's essence hoard — five blind +10% price hikes (#1033/#1078/#1098/
// #1108/#1182) followed. The real rate is the metric that must drive pricing.
function computeShopRealAnalysis(runs: RunRecord[]): ShopRealAnalysis | null {
  const runsWithShopData = runs.filter(
    (r): r is RunRecord & { shop_data: { offers: ShopOffer[] } } =>
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

  // #1230 : un run « budget limited » est le signal prix — l'offre était
  // abordable, la cohorte ne l'a pas payée parce qu'elle dépassait son budget.
  const budgetLimitedRuns = runsWithShopData.filter(r => r.shop_data?.budget_limited === true).length

  // #1230 : ventilation par cohorte. Un profil unique thésauriseur saturait le
  // taux (100 % sur les 20 derniers runs) ; chaque profil a désormais son taux,
  // ses moyens et son nombre de runs bridés par le budget.
  // #1300 : on groupe tous les runs avec un résultat shop (même sans offre) pour
  // que le funnel expose les runs verrouillés/inabordables de chaque cohorte.
  const shopResultRuns = runs.filter(hasShopResult)
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
        .flatMap(r => (r.shop_data?.offers ?? []).map(o => o.price))
        .filter((p): p is number => typeof p === 'number')
      const essences = groupWithOffers
        .map(r => r.shop?.essence_before ?? r.essence?.shop_before)
        .filter((e): e is number => typeof e === 'number')
      const funnel = computeShopFunnel(group)
      return {
        cohort: name,
        essence_budget: group[0]?.cohort?.essence_budget ?? null,
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

function computeTrendWindow(runs: RunRecord[], count: number, label: string): TrendWindow | null {
  const window = runs.slice(-count)
  if (window.length === 0) return null
  const fights = window.flatMap(r => r.fights)
  const wins = fights.filter(f => f.result === 'victory')
  const levels = window
    .map(r => r.final_stats?.level)
    .filter(l => l !== null && l !== undefined) as number[]
  const fightsWithXp = fights.filter(f => f.xp !== null) as FightRecord[]
  return {
    label,
    count: window.length,
    fights_count: fights.length,
    win_rate: fights.length > 0 ? wins.length / fights.length : 0,
    avg_fights: window.reduce((s, r) => s + r.fights.length, 0) / window.length,
    avg_level: levels.length > 0 ? levels.reduce((s, l) => s + l, 0) / levels.length : null,
    avg_xp_per_fight: fightsWithXp.length > 0
      ? fightsWithXp.reduce((s, f) => s + (f.xp ?? 0), 0) / fightsWithXp.length
      : 0,
    avg_duration_ms: fights.length > 0
      ? fights.reduce((s, f) => s + f.fight_duration_ms, 0) / fights.length
      : 0,
  }
}

function analyze(stats: RunRecord[]): AnalysisReport {
  const now = new Date().toISOString()
  const data_freshness = computeDataFreshness(stats)

  // Categorize runs. Empty runs (0 fight, 0 error — silent skipped attempts,
  // #1186) are their own category, never folded into successful_runs.
  const validRuns = stats.filter(r => r.fights && r.fights.length > 0)
  const errorRuns = stats.filter(isErrorRun)
  const emptyRuns = stats.filter(isEmptyRun)
  const halfwayRuns = validRuns.filter(isHalfwayRun)
  const successfulRuns = validRuns.filter(r => !r.errors || r.errors.length === 0)

  // Aggregate fights
  const allFights = validRuns.flatMap(r => r.fights)
  const wins = allFights.filter(f => f.result === 'victory')
  const losses = allFights.filter(f => f.result === 'defeat')
  const draws = allFights.filter(f => f.result === 'draw')
  const winRate = allFights.length > 0 ? wins.length / allFights.length : 0

  const isBossFight = (f: FightRecord): boolean =>
    f.fight_type === 'boss' ||
    (typeof f.monster_name === 'string' && f.monster_name.trim() === 'VOID TITAN')

  // XP analysis
  const fightsWithXp = allFights.filter((f): f is FightRecord => f.xp !== null)
  const avgXp = fightsWithXp.length > 0
    ? fightsWithXp.reduce((s, f) => s + f.xp, 0) / fightsWithXp.length
    : 0
  const xpPerWin = wins.filter((f): f is FightRecord => f.xp !== null)
  const avgXpWin = xpPerWin.length > 0
    ? xpPerWin.reduce((s, f) => s + f.xp, 0) / xpPerWin.length
    : 0
  const xpPerLoss = losses.filter((f): f is FightRecord => f.xp !== null)
  const avgXpLoss = xpPerLoss.length > 0
    ? xpPerLoss.reduce((s, f) => s + f.xp, 0) / xpPerLoss.length
    : 0
  const xpWinRatio = avgXpWin > 0 && avgXpLoss > 0 ? avgXpWin / avgXpLoss : 0

  // Duration stats
  const durations = allFights.map(f => f.fight_duration_ms)
  const avgDuration = durations.length > 0
    ? durations.reduce((s, d) => s + d, 0) / durations.length
    : 0
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0
  const medianDuration = median(durations)

  // Level distribution
  const levelDist: Record<string, number> = {}
  for (const r of validRuns) {
    if (r.final_stats?.level !== null && r.final_stats?.level !== undefined) {
      const key = `lvl-${r.final_stats.level}`
      levelDist[key] = (levelDist[key] || 0) + 1
    }
  }

  // Character type breakdown (#731): the persistent QA character is the only
  // source of longitudinal data; fresh runs calibrate the first-session
  // experience. Legacy runs have no character_type and count as unknown.
  const characterTypeBreakdown: CharacterTypeBreakdown = { fresh_runs: 0, persistent_runs: 0, unknown_runs: 0 }
  for (const r of stats) {
    if (r.character_type === 'persistent') characterTypeBreakdown.persistent_runs++
    else if (r.character_type === 'fresh') characterTypeBreakdown.fresh_runs++
    else characterTypeBreakdown.unknown_runs++
  }

  // Persistent-only level distribution: fresh characters can never reach
  // mid-game levels, so restricting the distribution to persistent runs gives
  // the LVL 6-29 visibility needed to calibrate the mid-game XP curve (#712).
  const persistentLevelDist: Record<string, number> = {}
  for (const r of validRuns) {
    if (!isPersistentRun(r)) continue
    if (r.final_stats?.level !== null && r.final_stats?.level !== undefined) {
      const key = `lvl-${r.final_stats.level}`
      persistentLevelDist[key] = (persistentLevelDist[key] || 0) + 1
    }
  }

  // Average level gained
  const runsWithLevelData = validRuns
    .filter(r => typeof r.initial_level === 'number' && r.final_stats !== null && r.final_stats !== undefined && typeof r.final_stats.level === 'number')
    .map(r => ({ initial_level: r.initial_level as number, final_level: r.final_stats!.level as number }))
  const avgLevelGained = runsWithLevelData.length > 0
    ? Math.round((runsWithLevelData.reduce((s, r) => s + (r.final_level - r.initial_level), 0) / runsWithLevelData.length) * 100) / 100
    : 0

  // Average stats
  const runsWithInitialStats = validRuns.filter((r): r is RunRecord & { initial_stats: Record<string, number> } => r.initial_stats !== null && r.initial_stats !== undefined)
  const avgInitialStats: Record<string, number> = {}
  if (runsWithInitialStats.length > 0) {
    const allKeys = new Set(runsWithInitialStats.flatMap(r => Object.keys(r.initial_stats)))
    for (const key of allKeys) {
      const vals = runsWithInitialStats.map(r => r.initial_stats[key]).filter(v => v !== undefined)
      avgInitialStats[key] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    }
  }

  const runsWithFinalStats = validRuns.filter((r): r is RunRecord & { final_character_stats: Record<string, number> } => r.final_character_stats !== null && r.final_character_stats !== undefined)
  const avgFinalStats: Record<string, number> = {}
  if (runsWithFinalStats.length > 0) {
    const allKeys = new Set(runsWithFinalStats.flatMap(r => Object.keys(r.final_character_stats)))
    for (const key of allKeys) {
      const vals = runsWithFinalStats.map(r => r.final_character_stats[key]).filter(v => v !== undefined)
      avgFinalStats[key] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    }
  }

  // --- HP Analysis (max HP growth) ---
  // Note: The game restores HP after every fight, so current HP always = max HP.
  // We track max HP progression to measure character growth from level-ups and equipment.
  const allRunsWithHpData = validRuns.filter(
    r => typeof r.initial_max_hp === 'number' && typeof r.final_max_hp === 'number'
  )
  const runsWithHpData = allRunsWithHpData.filter(r => !isCharacterReplacedRun(r))
  const hpExcludedRuns = allRunsWithHpData.length - runsWithHpData.length
  let hpAnalysis: HpAnalysis | null = null

  if (runsWithHpData.length > 0) {
    const avgInitialHp = runsWithHpData.reduce((s, r) => s + (r.initial_max_hp ?? 0), 0) / runsWithHpData.length
    const avgFinalHp = runsWithHpData.reduce((s, r) => s + (r.final_max_hp ?? 0), 0) / runsWithHpData.length
    const avgGrowth = runsWithHpData.reduce((s, r) => s + ((r.final_max_hp ?? 0) - (r.initial_max_hp ?? 0)), 0) / runsWithHpData.length

    hpAnalysis = {
      avg_initial_max_hp: Math.round(avgInitialHp * 10) / 10,
      avg_final_max_hp: Math.round(avgFinalHp * 10) / 10,
      avg_hp_growth_per_run: Math.round(avgGrowth * 10) / 10,
      runs_with_hp_data: runsWithHpData.length,
      runs_excluded_by_character_replacement: hpExcludedRuns,
    }
  }

  // --- Lootbox & Rarity Analysis ---
  const runsWithLootbox = validRuns.filter(r => r.lootbox && r.lootbox.available === true)
  const lootboxOpened = runsWithLootbox.filter(r => r.lootbox?.opened === true)
  const lootboxAcquireRate = runsWithLootbox.length > 0 ? lootboxOpened.length / runsWithLootbox.length : 0

  const rarityDist: LootRarityDistribution = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, unknown: 0 }
  for (const r of lootboxOpened) {
    const rarity = r.lootbox?.rarity
    const key = (rarity && typeof rarity === 'string' ? rarity.toLowerCase() : 'unknown') as keyof LootRarityDistribution
    if (key in rarityDist) {
      rarityDist[key]++
    } else {
      rarityDist.unknown++
    }
  }

  // --- Multi-window Trends ---
  const trendWindows: TrendWindow[] = []
  for (const { count, label } of [
    { count: 3, label: 'last_3' },
    { count: 5, label: 'last_5' },
    { count: 10, label: 'last_10' },
    { count: validRuns.length, label: 'all_time' },
  ]) {
    const tw = computeTrendWindow(validRuns, count, label)
    if (tw) trendWindows.push(tw)
  }

  // ===================== ISSUES & SUGGESTIONS =====================
  const issues: string[] = []
  const suggestions: string[] = []
  const recentRuns = stats.slice(-RECENT_WINDOW_RUNS)

  // Fight-type classification (#863, #705, #1303). VOID TITAN emitted as
  // 'pve' is a boss fight; idle fights live in idle_fights[] (legacy runs may
  // still carry fight_type 'idle' in fights[]).
  const bossFights = allFights.filter(isBossFight)
  const pveFights = allFights.filter(f => f.fight_type === 'pve' && !isBossFight(f))
  const pvpFights = allFights.filter(f => !isBossFight(f) && f.fight_type !== 'pve' && f.fight_type !== 'idle')

  const allIdleFightsFromRuns = validRuns.flatMap(
    r => (r.idle_fights ?? []).map(f => ({ ...f, fight_duration_ms: 0, result: f.result } as FightRecord))
  )
  const idleFightsForXp = [
    ...allFights.filter(f => f.fight_type === 'idle' && !isBossFight(f)),
    ...allIdleFightsFromRuns,
  ]
  const xpByFightType: XpByFightType = {
    pvp: computeXpTypeBreakdown(pvpFights),
    idle: computeXpTypeBreakdown(idleFightsForXp),
    boss: computeXpTypeBreakdown(bossFights),
    pve: computeXpTypeBreakdown(pveFights),
  }
  const recentPvpCoverage = recentRuns
    .flatMap(r => r.fights ?? [])
    .filter(f => !isBossFight(f) && f.fight_type !== 'pve' && f.fight_type !== 'idle')
    .filter(f => f.result === 'victory' || f.result === 'defeat')
    .length

  // Recent fight coverage (#1186): total fights carried by the recent window.
  // Balance signals (win rate, idle, shop, progression, streak) are only
  // actionable when the window actually holds combat data; a window starved of
  // fights must be reported loudly instead of silently validating a balance call.
  const recent_fight_coverage = recentRuns.reduce((s, r) => s + (r.fights?.length ?? 0), 0)
  if (recent_fight_coverage < MIN_RECENT_FIGHTS) {
    issues.push(`QA window starved: only ${recent_fight_coverage} fights over last ${recentRuns.length} runs — balance signals unreliable`)
  }

  // Win rate
  if (winRate < 0.3) issues.push(`Win rate is very low (${(winRate * 100).toFixed(1)}%) — game may be too hard`)
  else if (winRate < 0.4) suggestions.push(`Win rate is low (${(winRate * 100).toFixed(1)}%). Consider reducing opponent scaling or buffing starting stats.`)
  if (winRate > 0.8) issues.push(`Win rate is very high (${(winRate * 100).toFixed(1)}%) — game may be too easy`)
  else if (winRate > 0.7) suggestions.push(`Win rate is high (${(winRate * 100).toFixed(1)}%). Consider increasing opponent difficulty.`)

  // XP balance. The matchmaking suggestion only reads the PvP bucket and only
  // when the recent window carries enough PvP fights: boss defeats (~478 XP)
  // and idle XP otherwise drag the global ratio below the ~4x target (#1303).
  if (avgXpWin < 50) issues.push(`Avg XP per win is only ${avgXpWin.toFixed(0)} — may feel unrewarding`)
  const pvpXp = xpByFightType.pvp
  if (recentPvpCoverage >= MIN_PVP_XP_FIGHTS && pvpXp.n_win > 0 && pvpXp.n_loss > 0) {
    if (pvpXp.ratio < 2) suggestions.push(`PvP XP win/loss ratio is ${pvpXp.ratio.toFixed(1)}x (expected ~4x). Often a matchmaking symptom (#570/#725) — investigate MM before adjusting COMBAT.XP_WIN/XP_LOSS in gameRules.ts (100/25).`)
    if (pvpXp.ratio > 8) suggestions.push(`PvP XP win/loss ratio is ${pvpXp.ratio.toFixed(1)}x — very punishing. Consider raising COMBAT.XP_LOSS (currently 25).`)
  }

  // Fight duration
  if (avgDuration > 30000) issues.push(`Avg fight duration ${(avgDuration / 1000).toFixed(1)}s is too long`)
  const STALL_MIN_MS = 60000
  const STALL_RATIO = 3
  const BOSS_STALL_MIN_MS = 120000
  const recentFights = recentRuns.flatMap(r => r.fights ?? [])
  const nonBossFights = recentFights.filter(f => !isBossFight(f))
  const nonBossDurations = nonBossFights.map(f => f.fight_duration_ms)
  const nonBossMedian = median(nonBossDurations)
  const nonBossMax = nonBossDurations.length > 0 ? Math.max(...nonBossDurations) : 0
  if (nonBossMax > STALL_MIN_MS && nonBossMax > nonBossMedian * STALL_RATIO) suggestions.push(`Max non-boss fight duration ${(nonBossMax / 1000).toFixed(0)}s is ${(nonBossMax / nonBossMedian).toFixed(1)}x its median over the last ${recentRuns.length} runs — possible timeout issue`)
  const stallGroups: Array<{ label: string; durations: number[]; minMs: number }> = [
    { label: 'pvp', durations: recentFights.filter(f => !isBossFight(f) && f.fight_type !== 'pve' && f.fight_type !== 'idle').map(f => f.fight_duration_ms), minMs: STALL_MIN_MS },
    { label: 'pve', durations: recentFights.filter(f => f.fight_type === 'pve' && !isBossFight(f)).map(f => f.fight_duration_ms), minMs: STALL_MIN_MS },
    { label: 'idle', durations: recentFights.filter(f => f.fight_type === 'idle').map(f => f.fight_duration_ms), minMs: STALL_MIN_MS },
    { label: 'boss', durations: recentFights.filter(isBossFight).map(f => f.fight_duration_ms), minMs: BOSS_STALL_MIN_MS },
  ]
  for (const group of stallGroups) {
    if (group.durations.length === 0) continue
    const groupMedian = median(group.durations)
    const groupMax = Math.max(...group.durations)
    if (groupMax > group.minMs && groupMax > groupMedian * STALL_RATIO) suggestions.push(`Max ${group.label} fight duration ${(groupMax / 1000).toFixed(0)}s is ${(groupMax / groupMedian).toFixed(1)}x its median over the last ${recentRuns.length} runs — possible timeout issue`)
  }

  // Level progression
  if (avgLevelGained < 1 && validRuns.length >= 3) {
    suggestions.push(`Characters gain only ${avgLevelGained.toFixed(2)} levels/run. Consider increasing XP gains or reducing XP thresholds.`)
  }
  if (avgLevelGained > 5) {
    suggestions.push(`Characters gain ${avgLevelGained.toFixed(1)} levels/run — very fast progression. Consider increasing XP thresholds.`)
  }

  // Stats balance — only real character stats are compared against
  // STATS.MIN_VALUE/MAX_VALUE; the QA bot's structured parse can also capture
  // non-stat counters (e.g. 'fights' from the PvE panel) which must not trigger
  // stat-balance suggestions (#730).
  if (Object.keys(avgInitialStats).length > 0) {
    for (const [key, val] of Object.entries(avgInitialStats)) {
      if (!isStatKey(key)) continue
      if (val < 5) suggestions.push(`Average initial ${key.toUpperCase()} is ${val.toFixed(1)} (min=${Math.round(val)}). Consider raising STATS.MIN_VALUE (currently 5).`)
      if (val > 15) suggestions.push(`Average initial ${key.toUpperCase()} is ${val.toFixed(1)} (max=${Math.round(val)}). Consider lowering STATS.MAX_VALUE (currently 15).`)
    }
    // Check stat variance (are all stats roughly equal?)
    const statVals = Object.entries(avgInitialStats)
      .filter(([key]) => isStatKey(key))
      .map(([, v]) => v)
    const spread = statVals.length > 0 ? Math.max(...statVals) - Math.min(...statVals) : 0
    if (spread < 1 && statVals.length >= 6) {
      suggestions.push(`All initial stats are nearly identical (spread=${spread.toFixed(1)}). Random stat generation may need more variance.`)
    }
  }

  // HP growth (max HP progression — reflects level-ups and equipment)
  if (hpAnalysis) {
    if (hpAnalysis.avg_hp_growth_per_run > 50) suggestions.push(`High max HP growth (avg +${hpAnalysis.avg_hp_growth_per_run.toFixed(0)} HP/run). Characters may be scaling too fast.`)
    if (hpAnalysis.avg_initial_max_hp < 80) suggestions.push(`Low starting max HP (avg ${hpAnalysis.avg_initial_max_hp.toFixed(0)}). Consider increasing VIT impact on HP formula.`)
    if (hpAnalysis.avg_hp_growth_per_run < 1 && hpAnalysis.runs_with_hp_data >= 3) suggestions.push(`Minimal max HP growth (avg +${hpAnalysis.avg_hp_growth_per_run.toFixed(1)} HP/run). Characters may not be gaining enough VIT or equipment.`)
  }

  // Lootbox
  if (rarityDist.rare === 0 && rarityDist.epic === 0 && lootboxOpened.length >= 3) {
    suggestions.push(`No rare or epic items found in ${lootboxOpened.length} lootbox opens. Consider adjusting LOOTBOX_RARITY_WEIGHTS.`)
  }

  // Error rate — alerts use the recent 30-run window; the all-time cumulative
  // rate stays in the report, but stale failure eras must not keep triggering
  // alerts (#730).
  const recentErrorRuns = recentRuns.filter(isErrorRun)
  const recentHalfwayRuns = recentRuns.filter(isHalfwayRun)
  const isSiteDownRun = (r: RunRecord): boolean =>
    !!r.errors && r.errors.some(e => String(e).includes('SITE_DOWN'))
  const recentSiteDownRuns = recentRuns.filter(r => isErrorRun(r) && isSiteDownRun(r))
  const recentLocatorRuns = recentErrorRuns.filter(r => !isSiteDownRun(r))
  const errorRate = recentRuns.length > 0 ? recentErrorRuns.length / recentRuns.length : 0
  const totalErrorRate = recentRuns.length > 0
    ? (recentErrorRuns.length + recentHalfwayRuns.length) / recentRuns.length
    : 0
  if (recentSiteDownRuns.length > 0) {
    issues.push(`Site outage (site_down): ${recentSiteDownRuns.length} of the last ${recentRuns.length} runs failed before game load (SITE_DOWN: HTTP 4xx/5xx or error page) — check hosting/billing, not selectors`)
  }
  if (recentLocatorRuns.length > 0 && recentLocatorRuns.length / Math.max(1, recentRuns.length) > 0.3) {
    issues.push(`High error rate: ${(recentLocatorRuns.length / Math.max(1, recentRuns.length) * 100).toFixed(0)}% of the last ${recentRuns.length} runs failed completely (flaky_locator, excluding site_down)`)
  } else if (recentSiteDownRuns.length === 0 && errorRate > 0.3) {
    issues.push(`High error rate: ${(errorRate * 100).toFixed(0)}% of the last ${recentRuns.length} runs failed completely`)
  }
  if (totalErrorRate > 0.5) {
    suggestions.push(`High total error rate (${(totalErrorRate * 100).toFixed(0)}% of the last ${recentRuns.length} runs including partial runs). Check for UI stability issues.`)
  }

  // Trend direction
  const allTimeTrend = trendWindows.find(t => t.label === 'all_time')
  const last5Trend = trendWindows.find(t => t.label === 'last_5')
  if (allTimeTrend && last5Trend && last5Trend.count >= 3 && last5Trend.fights_count >= MIN_TREND_FIGHTS) {
    if (last5Trend.win_rate > allTimeTrend.win_rate + 0.15) {
      suggestions.push(`Win rate improving: ${(allTimeTrend.win_rate * 100).toFixed(0)}% → ${(last5Trend.win_rate * 100).toFixed(0)}% (last 5).`)
    }
    if (last5Trend.win_rate < allTimeTrend.win_rate - 0.15) {
      issues.push(`Win rate declining: ${(allTimeTrend.win_rate * 100).toFixed(0)}% → ${(last5Trend.win_rate * 100).toFixed(0)}% (last 5).`)
    }
    if (last5Trend.avg_level !== null && allTimeTrend.avg_level !== null && last5Trend.avg_level > allTimeTrend.avg_level + 1) {
      suggestions.push(`Character levels increasing: avg ${allTimeTrend.avg_level.toFixed(1)} → ${last5Trend.avg_level.toFixed(1)} (last 5). Progression may be accelerating.`)
    }
  }

  // Win-rate swing detection (last 3 vs all time)
  const last3Trend = trendWindows.find(t => t.label === 'last_3')
  if (allTimeTrend && last3Trend && last3Trend.count >= 2 && last3Trend.fights_count >= MIN_TREND_FIGHTS) {
    const swing = last3Trend.win_rate - allTimeTrend.win_rate
    if (swing > 0.20) {
      issues.push(`Win rate surged from ${(allTimeTrend.win_rate * 100).toFixed(0)}% to ${(last3Trend.win_rate * 100).toFixed(0)}% in last 3 runs. Monitor for over-correction — game may be too easy.`)
    } else if (swing < -0.20) {
      issues.push(`Win rate dropped from ${(allTimeTrend.win_rate * 100).toFixed(0)}% to ${(last3Trend.win_rate * 100).toFixed(0)}% in last 3 runs. Investigate bot difficulty or balance changes.`)
    }
  }

  // --- PvE / Boss classification (#863, #705) ---
  // Fight buckets are built above (issues/suggestions need them for #1303).
  const pveShiftedRuns = validRuns.filter(r => r.pve_data?.pve_shifted === true)
  let pveAnalysis: PveAnalysis | null = null

  if (pveFights.length > 0 || bossFights.length > 0 || pveShiftedRuns.length > 0) {
    const pveWins = pveFights.filter(f => f.result === 'victory')
    const pveXp = pveFights.filter((f): f is FightRecord => f.xp !== null)
    const monsters: Record<string, number> = {}
    for (const f of pveFights) {
      if (f.monster_name) monsters[f.monster_name] = (monsters[f.monster_name] || 0) + 1
    }

    // PvE XP modifier tracking: before_modifier (displayed) vs after_modifier (saved)
    const pveXpBeforeMod = pveFights.filter((f): f is FightRecord & { xp_before_modifier: number } =>
      f.xp_before_modifier !== null && f.xp_before_modifier !== undefined
    )
    const pveXpAfterMod = pveFights.filter((f): f is FightRecord & { xp_after_modifier: number } =>
      f.xp_after_modifier !== null && f.xp_after_modifier !== undefined
    )
    const avgXpBefore = pveXpBeforeMod.length > 0
      ? pveXpBeforeMod.reduce((s, f) => s + f.xp_before_modifier, 0) / pveXpBeforeMod.length
      : null
    const avgXpAfter = pveXpAfterMod.length > 0
      ? pveXpAfterMod.reduce((s, f) => s + f.xp_after_modifier, 0) / pveXpAfterMod.length
      : null

    // PvE/PvP XP ratio: compare after_modifier PvE XP to PvP win XP (boss fights excluded)
    const pvpWinsForRatio = wins
      .filter(f => !isBossFight(f) && f.fight_type !== 'pve')
      .filter((f): f is FightRecord => f.xp !== null)
    const avgPvpXpWin = pvpWinsForRatio.length > 0
      ? pvpWinsForRatio.reduce((s, f) => s + (f.xp ?? 0), 0) / pvpWinsForRatio.length
      : 0
    const pveRatio = avgXpAfter !== null && avgPvpXpWin > 0
      ? avgXpAfter / avgPvpXpWin
      : null

    // Boss fight aggregation (#705): fight_type === 'boss' records from captureBossFight
    const bossWins = bossFights.filter(f => f.result === 'victory')
    const bossWinXpFights = bossWins.filter((f): f is FightRecord => f.xp !== null)
    const bossLossXpFights = bossFights
      .filter(f => f.result === 'defeat')
      .filter((f): f is FightRecord => f.xp !== null)
    const bossHpLeftFights = bossFights.filter((f): f is FightRecord & { boss_hp_left: number } =>
      f.boss_hp_left !== null && f.boss_hp_left !== undefined
    )

    pveAnalysis = {
      total_fights: pveFights.length,
      win_rate: pveFights.length > 0 ? pveWins.length / pveFights.length : 0,
      avg_xp_per_fight: pveXp.length > 0 ? pveXp.reduce((s, f) => s + (f.xp ?? 0), 0) / pveXp.length : 0,
      avg_duration_ms: pveFights.length > 0
        ? pveFights.reduce((s, f) => s + f.fight_duration_ms, 0) / pveFights.length
        : 0,
      monsters_faced: monsters,
      avg_xp_before_modifier: avgXpBefore !== null ? Math.round(avgXpBefore * 100) / 100 : null,
      avg_xp_after_modifier: avgXpAfter !== null ? Math.round(avgXpAfter * 100) / 100 : null,
      pve_xp_ratio: pveRatio !== null ? Math.round(pveRatio * 1000) / 1000 : null,
      pve_shifted: pveShiftedRuns.length > 0,
      boss_observations: pveShiftedRuns.length,
      boss_fights: bossFights.length,
      boss_win_rate: bossFights.length > 0 ? bossWins.length / bossFights.length : null,
      boss_avg_xp_per_fight: bossWinXpFights.length > 0
        ? Math.round((bossWinXpFights.reduce((s, f) => s + (f.xp ?? 0), 0) / bossWinXpFights.length) * 100) / 100
        : null,
      boss_avg_xp_per_loss: bossLossXpFights.length > 0
        ? Math.round((bossLossXpFights.reduce((s, f) => s + (f.xp ?? 0), 0) / bossLossXpFights.length) * 100) / 100
        : null,
      boss_avg_hp_left: bossHpLeftFights.length > 0
        ? Math.round((bossHpLeftFights.reduce((s, f) => s + f.boss_hp_left, 0) / bossHpLeftFights.length) * 100) / 100
        : null,
    }
  }

  // --- Equipment Analysis ---
  // Gather from both initial_equipment and lootbox_equipment. Names that are
  // emoji-only, variation-selector remnants ("\uFE0F ARMOR"), or inventory group
  // labels ("WEAPONS", "ARMOR", "ACCESSORIES") are QA-bot fallback artifacts and
  // must never pollute equipment_analysis (#710).
  const EQUIPMENT_GROUP_LABELS = new Set([
    'WEAPONS', 'ARMOR', 'ACCESSORIES', 'TRINKETS', 'SHIELDS', 'RINGS', 'AMULETS',
    'WANDS', 'STAFFS', 'BOWS', 'DAGGERS', 'HELMETS', 'BOOTS', 'GLOVES', 'CLOAKS', 'ROBES', 'CHARMS',
  ])
  const EQUIPMENT_SLOT_FALLBACK_LABELS = new Set(['WEAPON', 'ARMOR', 'ACCESSORY'])
  const sanitizeEquippedItemName = (name: string): string =>
    String(name)
      .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s\-–—.:*"'()\[\]{}]+/u, '')
      .replace(/[\s×]+$/u, '')
      .trim()
  const isValidEquippedItemName = (name: string): boolean => {
    const sanitized = sanitizeEquippedItemName(name)
    const lettersOnly = sanitized.replace(/[^a-zA-Z]/g, '').toUpperCase()
    return (
      sanitized.length >= 2 &&
      /[a-zA-Z]/.test(sanitized) &&
      sanitized.toUpperCase() !== 'EMPTY' &&
      !EQUIPMENT_GROUP_LABELS.has(lettersOnly) &&
      !EQUIPMENT_SLOT_FALLBACK_LABELS.has(lettersOnly)
    )
  }
  const runsWithEquipment = validRuns.filter(
    (r): r is RunRecord & { initial_equipment: Array<{ slot: string; name: string }> } =>
      r.initial_equipment !== null && r.initial_equipment !== undefined &&
      r.initial_equipment.length > 0 &&
      r.initial_equipment.some(e => isValidEquippedItemName(e.name))
  )
  const runsWithLootboxEquipment = validRuns.filter(
    (r): r is RunRecord & { lootbox_equipment: Array<{ slot: string; name: string }> } =>
      r.lootbox_equipment !== null && r.lootbox_equipment !== undefined &&
      r.lootbox_equipment.length > 0 &&
      r.lootbox_equipment.some(e => isValidEquippedItemName(e.name))
  )
  const allEquippedItems = [
    ...runsWithEquipment.flatMap(r => r.initial_equipment.map(e => e.name).filter(isValidEquippedItemName)),
    ...runsWithLootboxEquipment.flatMap(r => r.lootbox_equipment.map(e => e.name).filter(isValidEquippedItemName)),
  ]
  let equipmentAnalysis: EquipmentAnalysis | null = null
  if (allEquippedItems.length > 0) {
    equipmentAnalysis = {
      runs_with_data: runsWithEquipment.length + runsWithLootboxEquipment.length,
      item_names: [...new Set(allEquippedItems)],
      unique_item_count: new Set(allEquippedItems).size,
    }
  }

  // --- Streak Analysis ---
  // #924: filter corrupted streak outliers (e.g. 73/1509 on QA-PERSI-4 2026-08-30) that dominate the mean.
  // Hard cap 0..100, then sigma |z|>3 when N>=30.
  // #1319: exclude character-replacement runs (same rule as HP/essence, #696) and
  // segment by cohort — fresh runs are structurally at 0 and must not dilute the
  // persistent streak.
  const hasAnyStreakData = (r: RunRecord) =>
    typeof r.initial_streak === 'number' ||
    typeof r.final_streak === 'number' ||
    typeof r.lootbox_streak === 'number'
  const runsExcludedByReplacement = validRuns.filter(r => hasAnyStreakData(r) && isCharacterReplacedRun(r)).length
  const streakRuns = validRuns.filter(r => !isCharacterReplacedRun(r))

  const isValidStreak = (v: number) => v >= 0 && v <= 100
  const runsWithFinalStreak = streakRuns.filter((r): r is RunRecord & { final_streak: number } => typeof r.final_streak === 'number')
  const streakOutliersHard = runsWithFinalStreak.filter(r => !isValidStreak(r.final_streak))
  const filteredFinalHard = runsWithFinalStreak.filter(r => isValidStreak(r.final_streak))
  const streakSigmaOutliers: RunRecord[] = []
  if (filteredFinalHard.length >= 30) {
    const vals = filteredFinalHard.map(r => r.final_streak)
    const m = vals.reduce((s, v) => s + v, 0) / vals.length
    const variance = vals.reduce((s, v) => s + (v - m) * (v - m), 0) / vals.length
    const std = Math.sqrt(variance)
    if (std > 0) {
      for (const r of filteredFinalHard) {
        if (Math.abs(r.final_streak - m) / std > 3) streakSigmaOutliers.push(r)
      }
    }
  }
  const streakOutliers = [...streakOutliersHard, ...streakSigmaOutliers]

  const globalStreakStats = computeStreakStats(streakRuns)
  const cohortGroups = new Map<StreakCohort, RunRecord[]>()
  for (const r of streakRuns) {
    const name = resolveStreakCohort(r)
    const group = cohortGroups.get(name)
    if (group) group.push(r)
    else cohortGroups.set(name, [r])
  }
  const cohortOrder: StreakCohort[] = ['persistent', 'fresh', 'unknown']
  const streakCohorts: StreakCohortAnalysis[] = cohortOrder.flatMap(name => {
    const group = cohortGroups.get(name)
    if (!group) return []
    const stats = computeStreakStats(group)
    if (!stats) return []
    return [{ cohort: name, ...stats }]
  })

  let streakAnalysis: StreakAnalysis | null = null
  if (globalStreakStats !== null || runsExcludedByReplacement > 0) {
    streakAnalysis = {
      avg_initial_streak: globalStreakStats?.avg_initial_streak ?? 0,
      avg_final_streak: globalStreakStats?.avg_final_streak ?? 0,
      runs_with_data: globalStreakStats?.runs_with_data ?? 0,
      runs_excluded_by_character_replacement: runsExcludedByReplacement,
      mixed_cohorts: streakCohorts.length > 1,
      cohorts: streakCohorts,
    }
  }

  if (streakOutliers.length > 0) {
    const vals = streakOutliers.map(r => String(r.final_streak)).join(',')
    const first = streakOutliers[0]
    const charInfo = first?.character ? ` — see ${first.character} ${String(first.date).slice(0, 10)}` : ''
    issues.push(`streak outliers excluded: ${streakOutliers.length} (${vals})${charInfo}`)
  }

  // --- Fight Type Breakdown (pvp / pve / idle / boss) ---
  const pvpWins = pvpFights.filter(f => f.result === 'victory')
  const pveWins = pveFights.filter(f => f.result === 'victory')
  const bossWinsForBreakdown = bossFights.filter(f => f.result === 'victory')

  // Idle fights come from idle_fights on each run (separate from active fights[])
  const idleWinsFromRuns = allIdleFightsFromRuns.filter(f => f.result === 'victory')

  const fightTypeBreakdown = {
    pvp_fights: pvpFights.length,
    pve_fights: pveFights.length,
    idle_fights: allIdleFightsFromRuns.length,
    boss_fights: bossFights.length,
    pvp_win_rate: pvpFights.length > 0 ? pvpWins.length / pvpFights.length : 0,
    pve_win_rate: pveFights.length > 0 ? pveWins.length / pveFights.length : 0,
    idle_win_rate: allIdleFightsFromRuns.length > 0 ? idleWinsFromRuns.length / allIdleFightsFromRuns.length : 0,
    boss_win_rate: bossFights.length > 0 ? bossWinsForBreakdown.length / bossFights.length : null,
  }

  // --- PvE-specific suggestions ---
  // PvE mode now launches the raid boss (LOCKED LVL 30, #633/#705): monster PvE
  // data is stale for low-level characters. Report the shift so the analysis is
  // not mistaken for live monster balance data.
  if (pveAnalysis && pveAnalysis.pve_shifted) {
    const shiftedLockLevels = pveShiftedRuns
      .map(r => r.pve_data?.boss_locked_level)
      .filter((l): l is number => typeof l === 'number')
    const bossLockedLevel = shiftedLockLevels.length > 0 ? Math.max(...shiftedLockLevels) : 30
    issues.push(`PvE mode now maps to the raid boss fight (LOCKED LVL ${bossLockedLevel}, ${pveAnalysis.boss_observations} observation run(s)) — monster PvE is stale (pve_shifted). pve_analysis reflects pre-shift monster data only; boss fights tracked via boss_fights (${pveAnalysis.boss_fights}). See #705.`)
  }
  if (pveAnalysis && pveAnalysis.total_fights >= 1) {
    if (pveAnalysis.win_rate < 0.3) {
      suggestions.push(`PvE win rate is ${(pveAnalysis.win_rate * 100).toFixed(0)}% — monsters may be too strong. Consider lowering PVE.STAT_MULTIPLIER or PVE.HP_MULTIPLIER.`)
    }
    if (pveAnalysis.win_rate > 0.9) {
      suggestions.push(`PvE win rate is ${(pveAnalysis.win_rate * 100).toFixed(0)}% — monsters may be too weak. Consider raising PVE.STAT_MULTIPLIER or PVE.HP_MULTIPLIER.`)
    }
    if (pveAnalysis.avg_duration_ms > 40000) {
      suggestions.push(`PvE fights avg ${(pveAnalysis.avg_duration_ms / 1000).toFixed(1)}s — may be too long for mobile sessions. Consider reducing monster HP.`)
    }
    // PvE XP ratio: warn if actual saved XP deviates significantly from expected 2.5x (GAME_RULES.PVE.XP_MODIFIER).
    // Gated behind !pve_shifted: pre-shift monster fights are stale (#705) and
    // must not keep emitting misleading ratio suggestions (#730).
    if (pveAnalysis.pve_xp_ratio !== null && pveAnalysis.total_fights >= 3 && !pveAnalysis.pve_shifted) {
      const expectedRatio = 2.5
      const tolerance = 0.30
      if (pveAnalysis.pve_xp_ratio < expectedRatio - tolerance) {
        suggestions.push(`PvE XP ratio is ${(pveAnalysis.pve_xp_ratio * 100).toFixed(0)}% of PvP (expected ${(expectedRatio * 100).toFixed(0)}%). PvE XP may be too low — check if XP_LOSS is used as base instead of XP_WIN.`)
      } else if (pveAnalysis.pve_xp_ratio > expectedRatio + tolerance) {
        suggestions.push(`PvE XP ratio is ${(pveAnalysis.pve_xp_ratio * 100).toFixed(0)}% of PvP (expected ${(expectedRatio * 100).toFixed(0)}%). PvE XP may be too high.`)
      }
    }
  }

  // --- Streak suggestions ---
  if (streakAnalysis && streakAnalysis.runs_with_data >= 3 && !streakAnalysis.mixed_cohorts) {
    if (streakAnalysis.avg_initial_streak === 0 && streakAnalysis.avg_final_streak === 0) {
      suggestions.push(`Lootbox streak is consistently 0 — players may not be claiming daily lootboxes consistently. Check invite flow.`)
    }
  }

  // --- Essence Analysis ---
  const allRunsWithEssenceData = validRuns.filter(
    (r): r is RunRecord & { initial_essence: number; final_essence: number } =>
      typeof r.initial_essence === 'number' && typeof r.final_essence === 'number'
  )
  const runsWithEssenceData = allRunsWithEssenceData.filter(r => !isCharacterReplacedRun(r))
  const essenceExcludedRuns = allRunsWithEssenceData.length - runsWithEssenceData.length
  let essenceAnalysis: EssenceAnalysis | null = null
  if (runsWithEssenceData.length > 0) {
    const avgInitial = runsWithEssenceData.reduce((s, r) => s + r.initial_essence, 0) / runsWithEssenceData.length
    const avgFinal = runsWithEssenceData.reduce((s, r) => s + r.final_essence, 0) / runsWithEssenceData.length

    // Detailed flow analysis from essence.flow data
    const runsWithFlow = runsWithEssenceData.filter(r => r.essence?.flow)
    const withIdle = runsWithFlow.filter(r => typeof r.essence!.flow.idle_gained === 'number')
    const withForge = runsWithFlow.filter(r => typeof r.essence!.flow.forge_net === 'number')
    const withShop = runsWithFlow.filter(r => typeof r.essence!.flow.shop_cost === 'number')
    const withSalvage = runsWithFlow.filter(r => typeof r.essence!.flow.salvage_gained === 'number')
    const withFusion = runsWithFlow.filter(r => typeof r.essence!.flow.fusion_cost === 'number')
    const withUpgrade = runsWithFlow.filter(r => typeof r.essence!.flow.upgrade_cost === 'number')

    essenceAnalysis = {
      runs_with_essence_data: runsWithEssenceData.length,
      avg_essence_gained_per_run: Math.round((avgFinal - avgInitial) * 100) / 100,
      avg_initial_essence: Math.round(avgInitial * 10) / 10,
      avg_final_essence: Math.round(avgFinal * 10) / 10,
      avg_idle_essence_gained: withIdle.length > 0
        ? Math.round((withIdle.reduce((s, r) => s + (r.essence!.flow.idle_gained as number), 0) / withIdle.length) * 100) / 100
        : null,
      avg_forge_net: withForge.length > 0
        ? Math.round((withForge.reduce((s, r) => s + (r.essence!.flow.forge_net as number), 0) / withForge.length) * 100) / 100
        : null,
      avg_shop_spent: withShop.length > 0
        ? Math.round((withShop.reduce((s, r) => s + (r.essence!.flow.shop_cost as number), 0) / withShop.length) * 100) / 100
        : null,
      avg_salvage_gained: withSalvage.length > 0
        ? Math.round((withSalvage.reduce((s, r) => s + (r.essence!.flow.salvage_gained as number), 0) / withSalvage.length) * 100) / 100
        : null,
      avg_fusion_cost: withFusion.length > 0
        ? Math.round((withFusion.reduce((s, r) => s + (r.essence!.flow.fusion_cost as number), 0) / withFusion.length) * 100) / 100
        : null,
      avg_upgrade_cost: withUpgrade.length > 0
        ? Math.round((withUpgrade.reduce((s, r) => s + (r.essence!.flow.upgrade_cost as number), 0) / withUpgrade.length) * 100) / 100
        : null,
      runs_with_flow_data: runsWithFlow.length,
      runs_excluded_by_character_replacement: essenceExcludedRuns,
    }
  }

  // --- Shop Simulated Affordability (#711) ---
  // Real shop purchases are impossible for fresh/mid-game characters, so the
  // purchase_rate would be blind without a simulation. Compute the affordability
  // proxy from the observed offer pool + essence_before.
  const shopSimulated = computeShopSimulatedAnalysis(validRuns)

  // --- Shop Real Purchases (#1229) ---
  const shopReal = computeShopRealAnalysis(validRuns)

  // --- Idle Analysis ---
  // Collect idle fights from both structured idle_fights[] (new) and legacy idle_runner (backward compat)
  const runsWithIdleData = validRuns.filter(r =>
    (r.idle_fights && r.idle_fights.length > 0) ||
    (r.idle_runner && r.idle_runner.xp_events && r.idle_runner.xp_events.length > 0)
  )
  const allIdleFights = collectIdleFights(runsWithIdleData)
  const runsWithIdleDataCount = runsWithIdleData.length

  let idleAnalysis: IdleAnalysis | null = null
  if (runsWithIdleDataCount > 0 && allIdleFights.length > 0) {
    const idleWins = allIdleFights.filter(f => f.result === 'victory')
    const idleXpFights = allIdleFights.filter((f): f is IdleFightRecord & { xp: number } => f.xp !== null)
    const idleEssenceFights = allIdleFights.filter((f): f is IdleFightRecord & { essence: number } => f.essence !== null && Number.isFinite(f.essence))
    let totalIdleEssence: number
    let avgIdleEssencePerFight: number
    if (idleEssenceFights.length > 0) {
      const sum = idleEssenceFights.reduce((s, f) => s + f.essence, 0)
      totalIdleEssence = Number.isFinite(sum) ? Math.round(sum * 100) / 100 : 0
      const avg = sum / idleEssenceFights.length
      avgIdleEssencePerFight = Number.isFinite(avg) ? Math.round(avg * 100) / 100 : 0
    } else {
      const flowTotals = runsWithIdleData
        .map(r => r.essence?.flow?.idle_gained)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      const sumFlow = flowTotals.reduce((s, v) => s + v, 0)
      totalIdleEssence = Number.isFinite(sumFlow) ? Math.round(sumFlow * 100) / 100 : 0
      const avgFlow = allIdleFights.length > 0 ? sumFlow / allIdleFights.length : 0
      avgIdleEssencePerFight = Number.isFinite(avgFlow) ? Math.round(avgFlow * 100) / 100 : 0
    }
    idleAnalysis = {
      runs_with_idle_data: runsWithIdleDataCount,
      total_idle_fights: allIdleFights.length,
      idle_win_rate: allIdleFights.length > 0 ? idleWins.length / allIdleFights.length : 0,
      avg_idle_xp_per_fight: idleXpFights.length > 0
        ? Math.round((idleXpFights.reduce((s, f) => s + f.xp, 0) / idleXpFights.length) * 100) / 100
        : 0,
      avg_idle_essence_per_fight: avgIdleEssencePerFight,
      total_idle_essence: totalIdleEssence,
    }
  }

  // --- Progression Curve ---
  const runsWithCurve = validRuns.filter(
    (r): r is RunRecord & { progression_curve: { level: number; total_xp: number; xp_for_next: number; percent: number } } =>
      r.progression_curve !== null && r.progression_curve !== undefined
  )
  let progressionCurve: ProgressionCurveSummary | null = null
  if (runsWithCurve.length > 0) {
    progressionCurve = {
      runs_with_data: runsWithCurve.length,
      avg_level: Math.round((runsWithCurve.reduce((s, r) => s + r.progression_curve.level, 0) / runsWithCurve.length) * 10) / 10,
      avg_xp_progress_percent: Math.round((runsWithCurve.reduce((s, r) => s + r.progression_curve.percent, 0) / runsWithCurve.length) * 10) / 10,
      avg_xp_for_next: Math.round(runsWithCurve.reduce((s, r) => s + r.progression_curve.xp_for_next, 0) / runsWithCurve.length),
    }
  }

  // Progression curve suggestions
  if (progressionCurve && progressionCurve.runs_with_data >= 3) {
    if (progressionCurve.avg_xp_progress_percent > 90) {
      suggestions.push(`Players are close to leveling (avg ${progressionCurve.avg_xp_progress_percent.toFixed(0)}% of next level). XP curve may be too flat.`)
    }
    if (progressionCurve.avg_xp_progress_percent < 10 && progressionCurve.avg_level > 5) {
      suggestions.push(`Players are far from leveling (avg ${progressionCurve.avg_xp_progress_percent.toFixed(0)}% progress at level ${progressionCurve.avg_level.toFixed(0)}). XP curve may be too steep.`)
    }
  }

  // Essence suggestions
  if (essenceAnalysis && essenceAnalysis.runs_with_essence_data >= 3) {
    if (essenceAnalysis.avg_essence_gained_per_run > 20) {
      suggestions.push(`High essence gain (avg +${essenceAnalysis.avg_essence_gained_per_run.toFixed(1)}/run). Consider adjusting salvage yields.`)
    }
    if (essenceAnalysis.avg_essence_gained_per_run < 1 && essenceAnalysis.avg_initial_essence > 50) {
      suggestions.push(`Low essence gain (avg +${essenceAnalysis.avg_essence_gained_per_run.toFixed(1)}/run). Players may be hoarding essence.`)
    }
    // Detailed flow suggestions
    if (essenceAnalysis.runs_with_flow_data >= 3) {
      if (essenceAnalysis.avg_idle_essence_gained !== null && essenceAnalysis.avg_idle_essence_gained > 0.5) {
        suggestions.push(`High idle essence gain (avg ${essenceAnalysis.avg_idle_essence_gained.toFixed(2)}/run). Consider reducing IDLE_CONFIG.ESSENCE.BASE_RATE (0.12) or LEVEL_SCALE (0.05).`)
      }
      if (essenceAnalysis.avg_salvage_gained !== null && essenceAnalysis.avg_salvage_gained > 30) {
        suggestions.push(`High salvage essence gain (avg +${essenceAnalysis.avg_salvage_gained.toFixed(1)}/run). Salvage yields may need reduction.`)
      }
      if (essenceAnalysis.avg_fusion_cost !== null && essenceAnalysis.avg_fusion_cost > 100) {
        suggestions.push(`High fusion cost (avg ${essenceAnalysis.avg_fusion_cost.toFixed(1)}/run). Fusion may be too expensive.`)
      }
      if (essenceAnalysis.avg_upgrade_cost !== null && essenceAnalysis.avg_upgrade_cost > 50) {
        suggestions.push(`High upgrade cost (avg ${essenceAnalysis.avg_upgrade_cost.toFixed(1)}/run). Upgrade may be too expensive.`)
      }
      if (essenceAnalysis.avg_shop_spent !== null && essenceAnalysis.avg_shop_spent > 300) {
        suggestions.push(`High shop spending (avg ${essenceAnalysis.avg_shop_spent.toFixed(1)}/run). Shop prices may need adjustment.`)
      }
    }
  }

  // Shop purchase-rate suggestions (#711, #1229): once the window carries
  // enough REAL purchase observations, the price suggestion is driven by the
  // observed purchase rate. The simulated affordability proxy is only a fallback
  // (fewer than REAL_SHOP_MIN_RUNS captured offers): it measures "can afford"
  // rather than "buys" and is saturated by the persistent character's essence
  // hoard, which previously produced five blind +10% price hikes.
  if (shopReal && shopReal.runs_with_shop_data >= REAL_SHOP_MIN_RUNS && shopReal.real_purchase_rate !== null) {
    const unsegmentedRuns = shopReal.cohorts.find(c => c.cohort === 'unsegmented')?.runs_with_shop_data ?? 0
    const segmentedRuns = shopReal.runs_with_shop_data - unsegmentedRuns
    const measurementPending = unsegmentedRuns > shopReal.runs_with_shop_data / 2 || segmentedRuns < REAL_SHOP_MIN_RUNS
    const cheapestOnly = shopReal.cheapest_offer_share !== null && shopReal.cheapest_offer_share >= 0.95
    const ratePct = (shopReal.real_purchase_rate * 100).toFixed(0)
    const cohortEssence = shopReal.cohorts.filter(
      (c): c is ShopCohortAnalysis & { avg_essence_before: number } => c.avg_essence_before !== null
    )
    const cohortEssenceRuns = cohortEssence.reduce((s, c) => s + c.runs_with_shop_data, 0)
    const avgEssenceBefore = cohortEssenceRuns > 0
      ? cohortEssence.reduce((s, c) => s + c.avg_essence_before * c.runs_with_shop_data, 0) / cohortEssenceRuns
      : null
    const avgPurchaseCost = shopReal.avg_purchase_cost
    const essenceCostRatio = avgEssenceBefore !== null && avgPurchaseCost !== null && avgPurchaseCost > 0
      ? Math.round(avgEssenceBefore / avgPurchaseCost)
      : null

    // #1300 : le taux agrégé ne dit rien de la cohorte FRESH quand son funnel est
    // vide (shop verrouillé) ou hors de portée (essence sous le prix plancher).
    const freshCohort = shopReal.cohorts.find(c => c.cohort === 'QA-FRESH')
    const freshFunnel = freshCohort?.funnel
    const freshOutOfReach = freshCohort !== undefined && freshFunnel !== undefined
      && freshCohort.runs_with_purchase === 0
      && (freshFunnel.unaffordable_runs > 0 || freshFunnel.shop_locked_runs > 0)

    if (freshOutOfReach && freshCohort !== undefined && freshFunnel !== undefined) {
      if (freshFunnel.unaffordable_runs > 0) {
        const lockedDetail = freshFunnel.shop_locked_runs > 0 ? `, ${freshFunnel.shop_locked_runs} locked` : ''
        suggestions.push(`QA-FRESH funnel: shop hors de portée à ce stade (${freshFunnel.unaffordable_runs} runs sous le prix plancher) — ${freshFunnel.unaffordable_runs}/${freshFunnel.shop_visits} shop visit(s) below the cheapest offer${lockedDetail}; ${freshCohort.runs_with_purchase}/${freshCohort.runs_with_shop_data} purchase(s). The aggregate rate carries no price signal until this cohort can reach the cheapest offer.`)
      } else {
        suggestions.push(`QA-FRESH funnel: ${freshFunnel.shop_locked_runs} run(s) locked by shopUnlockLevel (${freshFunnel.shop_visits} shop visit(s), ${freshCohort.runs_with_purchase}/${freshCohort.runs_with_shop_data} purchase(s)). Wait for fresh runs above the gate before reading a price signal.`)
      }
    } else if (shopReal.real_purchase_rate < 0.1) {
      suggestions.push(`Real shop purchase rate is ${ratePct}% (${shopReal.runs_with_purchase}/${shopReal.runs_with_shop_data} runs) — players are not buying. Consider lowering SHOP_OFFERS prices.`)
    } else if (shopReal.real_purchase_rate > 0.6 && measurementPending) {
      suggestions.push(`Real shop purchase rate is ${ratePct}% (${shopReal.runs_with_purchase}/${shopReal.runs_with_shop_data} runs) — measurement pending: ${unsegmentedRuns} unsegmented run(s) vs ${segmentedRuns} segmented (below REAL_SHOP_MIN_RUNS=${REAL_SHOP_MIN_RUNS}). The rate is carried by the legacy hoarding character; no price action until fresh segmented runs exist.`)
    } else if (shopReal.real_purchase_rate > 0.6 && !cheapestOnly) {
      suggestions.push(`Real shop purchase rate is ${ratePct}% (${shopReal.runs_with_purchase}/${shopReal.runs_with_shop_data} runs, avg cost ${shopReal.avg_purchase_cost?.toFixed(0) ?? 'n/a'} 💎) — offers are trivially affordable for players. Consider raising SHOP_OFFERS prices.`)
    }
    if (cheapestOnly) {
      suggestions.push(`Real shop purchases target the cheapest offer (share ${(shopReal.cheapest_offer_share! * 100).toFixed(0)}%) — available essence${avgEssenceBefore !== null ? ` (avg ${avgEssenceBefore.toFixed(0)} 💎)` : ''} is ${essenceCostRatio !== null ? `~${essenceCostRatio}× ` : ''}the purchased offer cost (avg ${avgPurchaseCost?.toFixed(0) ?? 'n/a'} 💎): hoarding / offer-structure, not a price signal. A uniform price increase will not change the behaviour; calibrate on cost relative to essence, not the raw purchase rate.`)
    }
    // Cohortes QA (#1230) : le signal prix. Une offre abordable mais au-dessus du
    // budget d'un profil est un run « budget limited » — la métrique bouge avec
    // le prix au lieu de saturer sur la thésaurisation du persistant.
    if (shopReal.budget_limited_runs > 0) {
      const limitedShare = Math.round((shopReal.budget_limited_runs / shopReal.runs_with_shop_data) * 100)
      const perCohort = shopReal.cohorts
        .filter(c => c.budget_limited_runs > 0)
        .map(c => `${c.cohort} ${c.budget_limited_runs}/${c.runs_with_shop_data}`)
        .join(', ')
      suggestions.push(`QA cohort budgets (#1230) blocked ${shopReal.budget_limited_runs}/${shopReal.runs_with_shop_data} shop runs (${limitedShare}%${perCohort ? `: ${perCohort}` : ''}) — the cheapest affordable offer cost more than the profile's per-item budget. That is the price signal: the shop is out of reach for that cohort. Read shop.real.cohorts before acting on the raw rate.`)
    }
  } else if (shopSimulated && shopSimulated.runs_with_shop_data >= 3) {
    if (shopSimulated.simulated_purchase_rate !== null && shopSimulated.simulated_purchase_rate < 0.1) {
      suggestions.push(`Simulated shop purchase rate is ${(shopSimulated.simulated_purchase_rate * 100).toFixed(0)}% (${shopSimulated.would_purchase_runs}/${shopSimulated.runs_with_shop_data} runs) — shop prices (avg ${shopSimulated.avg_offer_price?.toFixed(0) ?? 'n/a'} 💎) exceed player essence (avg ${shopSimulated.avg_essence_before?.toFixed(1) ?? 'n/a'} 💎). Consider lowering SHOP_OFFERS prices.`)
    } else if (shopSimulated.simulated_purchase_rate !== null && shopSimulated.simulated_purchase_rate > 0.6) {
      suggestions.push(`Simulated shop purchase rate is ${(shopSimulated.simulated_purchase_rate * 100).toFixed(0)}% — offers are easily affordable for players. Consider raising SHOP_OFFERS prices to make purchases meaningful.`)
    }
  }

  // Idle suggestions
  if (idleAnalysis && idleAnalysis.runs_with_idle_data >= 3) {
    if (idleAnalysis.avg_idle_essence_per_fight > 0.5) {
      suggestions.push(`High idle essence (${idleAnalysis.avg_idle_essence_per_fight.toFixed(2)}/fight). Consider reducing IDLE_CONFIG.ESSENCE.BASE_RATE or LEVEL_SCALE.`)
    }
    // Idle win-rate alerts use the recent idle-data window (#730): the all-time
    // cumulative rate includes the pre-#727 era (STAT_MULTIPLIER 20.0) and would
    // keep flagging "too strong" forever even after the fix.
    // Freshness gate (#858, #1186): when the trailing error + empty run count
    // reaches the stale threshold the last 15 idle runs are stale (pre-#738
    // era). Gate the High win-rate suggestion to avoid retuning in the wrong
    // direction when fresh WR is <50%.
    const recentIdleRuns = runsWithIdleData.slice(-RECENT_IDLE_RUNS)
    const recentIdleFights = collectIdleFights(recentIdleRuns)
    const recentIdleWinRate = recentIdleFights.length > 0
      ? recentIdleFights.filter(f => f.result === 'victory').length / recentIdleFights.length
      : null
    if (recentIdleWinRate !== null) {
      const isIdleStale = data_freshness.stale
      if (recentIdleWinRate < 0.4) {
        if (!isIdleStale) {
          suggestions.push(`Low idle win rate (${(recentIdleWinRate * 100).toFixed(0)}% over the last ${recentIdleRuns.length} idle runs). Idle monsters may be too strong.`)
        }
      }
      if (recentIdleWinRate > 0.9) {
        if (isIdleStale) {
          if (idleAnalysis && idleAnalysis.idle_win_rate < 0.5) {
          } else {
            suggestions.push(`[STALE] High idle win rate (${(recentIdleWinRate * 100).toFixed(0)}% over the last ${recentIdleRuns.length} idle runs). Idle monsters may be too weak.`)
          }
        } else {
          suggestions.push(`High idle win rate (${(recentIdleWinRate * 100).toFixed(0)}% over the last ${recentIdleRuns.length} idle runs). Idle monsters may be too weak.`)
        }
      }
    }
  }

  return {
    generated_at: now,
    total_runs: stats.length,
    total_fights: allFights.length,
    successful_runs: successfulRuns.length,
    halfway_runs: halfwayRuns.length,
    error_runs: errorRuns.length,
    empty_runs: emptyRuns.length,
    data_freshness,
    recent_fight_coverage,
    character_type_breakdown: characterTypeBreakdown,
    persistent_level_distribution: persistentLevelDist,
    win_rate: Math.round(winRate * 1000) / 1000,
    loss_rate: Math.round((allFights.length > 0 ? losses.length / allFights.length : 0) * 1000) / 1000,
    draw_rate: Math.round((allFights.length > 0 ? draws.length / allFights.length : 0) * 1000) / 1000,
    avg_fights_per_run: validRuns.length > 0
      ? Math.round((validRuns.reduce((s, r) => s + r.fights.length, 0) / validRuns.length) * 100) / 100
      : 0,
    avg_xp_per_fight: Math.round(avgXp * 100) / 100,
    avg_xp_per_win: Math.round(avgXpWin * 100) / 100,
    avg_xp_per_loss: Math.round(avgXpLoss * 100) / 100,
    xp_win_loss_ratio: Math.round(xpWinRatio * 100) / 100,
    xp_by_fight_type: xpByFightType,
    avg_fight_duration_ms: Math.round(avgDuration),
    min_fight_duration_ms: Math.round(minDuration),
    max_fight_duration_ms: Math.round(maxDuration),
    median_fight_duration_ms: Math.round(medianDuration),
    level_distribution: levelDist,
    avg_level_gained_per_run: Math.round(avgLevelGained * 100) / 100,
    avg_initial_stats: Object.keys(avgInitialStats).length > 0 ? avgInitialStats : null,
    avg_final_stats: Object.keys(avgFinalStats).length > 0 ? avgFinalStats : null,
    hp_analysis: hpAnalysis,
    essence_analysis: essenceAnalysis,
    idle_analysis: idleAnalysis,
    progression_curve: progressionCurve,
    shop: {
      simulated: shopSimulated,
      real: shopReal,
    },
    lootbox: {
      runs_with_lootbox: runsWithLootbox.length,
      lootboxes_opened: lootboxOpened.length,
      acquire_rate: Math.round(lootboxAcquireRate * 1000) / 1000,
      rarity_distribution: rarityDist,
    },
    trends: trendWindows,
    pve_analysis: pveAnalysis,
    equipment_analysis: equipmentAnalysis,
    streak_analysis: streakAnalysis,
    fight_type_breakdown: fightTypeBreakdown,
    issues,
    suggestions,
  }
}

function printReport(report: AnalysisReport): void {
  const { green, red, yellow, cyan, bold, reset } = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    reset: '\x1b[0m',
  }

  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`
  const fmtSec = (ms: number) => `${(ms / 1000).toFixed(1)}s`

  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  ${bold}QA Stats Analysis Report${reset}`)
  console.log(`  ${cyan}${report.generated_at}${reset}`)
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log(`  ${bold}Runs:${reset} ${report.total_runs} total`)
  console.log(`        ${green}${report.successful_runs} successful${reset}, ${yellow}${report.halfway_runs} partial${reset}, ${red}${report.error_runs} errors${reset}, ${report.empty_runs} empty`)
  console.log(`        ${bold}Fights in recent window:${reset} ${report.recent_fight_coverage} (min ${MIN_RECENT_FIGHTS} for reliable signals)`)
  const ct = report.character_type_breakdown
  console.log(`  ${bold}Characters:${reset} ${ct.persistent_runs} persistent (longitudinal), ${ct.fresh_runs} fresh (first-session), ${ct.unknown_runs} unknown`)
  if (Object.keys(report.persistent_level_distribution).length > 0) {
    console.log(`  ${bold}Persistent LVL dist:${reset} ${Object.entries(report.persistent_level_distribution).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }
  console.log(`  ${bold}Fights:${reset} ${report.total_fights} (avg ${report.avg_fights_per_run}/run)`)
  if (report.data_freshness.stale) {
    console.log(`  ${yellow}DATA STALE — ${report.data_freshness.trailing_error_runs} error run(s) + ${report.data_freshness.trailing_empty_runs} trailing empty run(s) since ${report.data_freshness.last_valid_run_at ?? 'unknown'} — aggregates reflect pre-outage data${reset}`)
  } else if (report.data_freshness.trailing_error_runs > 0 || report.data_freshness.trailing_empty_runs > 0) {
    console.log(`  Freshness:      ${report.data_freshness.trailing_error_runs} trailing error run(s), ${report.data_freshness.trailing_empty_runs} trailing empty run(s), last valid ${report.data_freshness.last_valid_run_at ?? 'n/a'}`)
  }
  console.log('')
  console.log(`  ── ${bold}Combat Balance${reset} ──`)
  console.log(`  Win rate:       ${report.win_rate > 0.5 ? green : red}${fmtPct(report.win_rate)}${reset}`)
  console.log(`  Loss rate:      ${fmtPct(report.loss_rate)}`)
  console.log(`  Draw rate:      ${fmtPct(report.draw_rate)}`)
  console.log(`  XP win/loss:    ${green}${report.avg_xp_per_win.toFixed(0)}${reset} / ${red}${report.avg_xp_per_loss.toFixed(0)}${reset} (ratio ${report.xp_win_loss_ratio.toFixed(1)}x)`)
  console.log(`  Avg XP/fight:   ${report.avg_xp_per_fight.toFixed(0)}`)
  console.log(`  Duration:       avg=${fmtSec(report.avg_fight_duration_ms)} min=${fmtSec(report.min_fight_duration_ms)} max=${fmtSec(report.max_fight_duration_ms)} med=${fmtSec(report.median_fight_duration_ms)}`)
  console.log('')
  console.log(`  ── ${bold}Level Progression${reset} ──`)
  console.log(`  Avg levels/run: ${report.avg_level_gained_per_run.toFixed(2)}`)
  console.log(`  Level dist:     ${Object.entries(report.level_distribution).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  console.log('')
  console.log(`  ── ${bold}Character Stats${reset} ──`)
  if (report.avg_initial_stats) {
    const initialStr = Object.entries(report.avg_initial_stats)
      .map(([k, v]) => `${k.toUpperCase()}=${v.toFixed(1)}`)
      .join(' ')
    console.log(`  Initial:        ${initialStr}`)
  }
  if (report.avg_final_stats) {
    const finalStr = Object.entries(report.avg_final_stats)
      .map(([k, v]) => `${k.toUpperCase()}=${v.toFixed(1)}`)
      .join(' ')
    console.log(`  Final:          ${finalStr}`)
  }
  console.log('')
  if (report.fight_type_breakdown.pve_fights > 0 || report.fight_type_breakdown.pvp_fights > 0 || report.fight_type_breakdown.idle_fights > 0 || report.fight_type_breakdown.boss_fights > 0) {
    console.log(`  ── ${bold}Fight Type${reset} ──`)
    console.log(`  PvP:            ${report.fight_type_breakdown.pvp_fights} fights, ${fmtPct(report.fight_type_breakdown.pvp_win_rate)} win rate`)
    console.log(`  PvE:            ${report.fight_type_breakdown.pve_fights} fights, ${fmtPct(report.fight_type_breakdown.pve_win_rate)} win rate`)
    console.log(`  Idle:           ${report.fight_type_breakdown.idle_fights} fights, ${fmtPct(report.fight_type_breakdown.idle_win_rate)} win rate`)
    if (report.fight_type_breakdown.boss_fights > 0) {
      console.log(`  Boss:           ${report.fight_type_breakdown.boss_fights} fights, ${report.fight_type_breakdown.boss_win_rate !== null ? fmtPct(report.fight_type_breakdown.boss_win_rate) : 'n/a'} win rate`)
    }
    console.log('')
  }

  const xpTypes: Array<[string, XpTypeBreakdown]> = [
    ['PvP', report.xp_by_fight_type.pvp],
    ['PvE', report.xp_by_fight_type.pve],
    ['Idle', report.xp_by_fight_type.idle],
    ['Boss', report.xp_by_fight_type.boss],
  ]
  if (xpTypes.some(([, xp]) => xp.n_win + xp.n_loss > 0)) {
    console.log(`  ── ${bold}XP by Fight Type${reset} ──`)
    for (const [label, xp] of xpTypes) {
      if (xp.n_win + xp.n_loss === 0) continue
      console.log(`  ${label.padEnd(5)} win ${xp.win_avg.toFixed(0)} (${xp.n_win}) / loss ${xp.loss_avg.toFixed(0)} (${xp.n_loss}) — ratio ${xp.ratio.toFixed(1)}x`)
    }
    console.log('')
  }

  if (report.pve_analysis && (report.pve_analysis.total_fights >= 1 || report.pve_analysis.pve_shifted)) {
    console.log(`  ── ${bold}PvE / Boss${reset} ──`)
    if (report.pve_analysis.pve_shifted) {
      console.log(`  Shifted:        ${yellow}PvE = raid boss (${report.pve_analysis.boss_observations} observation run(s))${reset}`)
    }
    console.log(`  Monsters:       ${Object.entries(report.pve_analysis.monsters_faced).map(([name, count]) => `${name}=${count}`).join(', ') || 'none (PvE is boss-shifted)'}`)
    if (report.pve_analysis.boss_fights > 0) {
      console.log(`  Boss fights:    ${report.pve_analysis.boss_fights} (${report.pve_analysis.boss_win_rate !== null ? fmtPct(report.pve_analysis.boss_win_rate) : 'n/a'} win rate)`)
      if (report.pve_analysis.boss_avg_xp_per_fight !== null) {
        console.log(`  Boss XP/win:    ${report.pve_analysis.boss_avg_xp_per_fight.toFixed(0)}`)
      }
      if (report.pve_analysis.boss_avg_xp_per_loss !== null) {
        console.log(`  Boss XP/loss:   ${report.pve_analysis.boss_avg_xp_per_loss.toFixed(0)}`)
      }
      if (report.pve_analysis.boss_avg_hp_left !== null) {
        console.log(`  Boss HP left:   ${report.pve_analysis.boss_avg_hp_left.toFixed(0)} (pool progress)`)
      }
    }
    console.log(`  XP/fight:       ${report.pve_analysis.avg_xp_per_fight.toFixed(0)}`)
    console.log(`  Avg duration:   ${fmtSec(report.pve_analysis.avg_duration_ms)}`)
    if (report.pve_analysis.avg_xp_before_modifier !== null) {
      console.log(`  XP before mod:  ${report.pve_analysis.avg_xp_before_modifier.toFixed(1)}`)
    }
    if (report.pve_analysis.avg_xp_after_modifier !== null) {
      console.log(`  XP after mod:   ${report.pve_analysis.avg_xp_after_modifier.toFixed(1)}`)
    }
    if (report.pve_analysis.pve_xp_ratio !== null) {
      console.log(`  PvE/PvP ratio:  ${fmtPct(report.pve_analysis.pve_xp_ratio)} (expected 250%)`)
    }
    console.log('')
  }

  if (report.equipment_analysis) {
    console.log(`  ── ${bold}Equipment${reset} ──`)
    console.log(`  Runs with data: ${report.equipment_analysis.runs_with_data}`)
    console.log(`  Unique items:   ${report.equipment_analysis.unique_item_count}`)
    console.log(`  Items:          ${report.equipment_analysis.item_names.join(', ')}`)
    console.log('')
  }

  if (report.streak_analysis) {
    console.log(`  ── ${bold}Lootbox Streak${reset} ──`)
    console.log(`  Avg initial:    ${report.streak_analysis.avg_initial_streak.toFixed(1)}${report.streak_analysis.mixed_cohorts ? ' (mixed cohorts — read per-cohort rows)' : ''}`)
    console.log(`  Avg final:      ${report.streak_analysis.avg_final_streak.toFixed(1)}`)
    console.log(`  Excluded:       ${report.streak_analysis.runs_excluded_by_character_replacement} replaced-character run(s)`)
    for (const c of report.streak_analysis.cohorts) {
      console.log(`  ${c.cohort.padEnd(11)} ${c.runs_with_data} run(s), initial ${c.avg_initial_streak.toFixed(2)}, final ${c.avg_final_streak.toFixed(2)}`)
    }
    console.log('')
  }

  if (report.hp_analysis) {
    console.log(`  ── ${bold}HP Growth (max HP)${reset} ──`)
    console.log(`  Initial avg:    ${report.hp_analysis.avg_initial_max_hp.toFixed(0)} HP`)
    console.log(`  Final avg:      ${report.hp_analysis.avg_final_max_hp.toFixed(0)} HP`)
    console.log(`  Growth/run:     +${report.hp_analysis.avg_hp_growth_per_run.toFixed(1)} HP`)
    console.log(`  Data from:      ${report.hp_analysis.runs_with_hp_data} run(s)`)
    console.log(`  Excluded:       ${report.hp_analysis.runs_excluded_by_character_replacement} replaced-character run(s)`)
    console.log('')
  }
  if (report.essence_analysis) {
    console.log(`  ── ${bold}Essence${reset} ──`)
    console.log(`  Avg initial:    ${report.essence_analysis.avg_initial_essence.toFixed(1)}`)
    console.log(`  Avg final:      ${report.essence_analysis.avg_final_essence.toFixed(1)}`)
    console.log(`  Gained/run:     +${report.essence_analysis.avg_essence_gained_per_run.toFixed(2)}`)
    if (report.essence_analysis.runs_with_flow_data > 0) {
      const idle = report.essence_analysis.avg_idle_essence_gained
      const forge = report.essence_analysis.avg_forge_net
      const shop = report.essence_analysis.avg_shop_spent
      const salvage = report.essence_analysis.avg_salvage_gained
      const fusion = report.essence_analysis.avg_fusion_cost
      const upgrade = report.essence_analysis.avg_upgrade_cost
      console.log(`  ── Flow (avg) ─`)
      if (idle !== null) console.log(`  Idle gain:      +${idle.toFixed(2)}`)
      if (salvage !== null) console.log(`  Salvage gain:   +${salvage.toFixed(2)}`)
      if (fusion !== null) console.log(`  Fusion cost:    -${fusion.toFixed(2)}`)
      if (upgrade !== null) console.log(`  Upgrade cost:   -${upgrade.toFixed(2)}`)
      if (forge !== null) console.log(`  Forge net:      ${forge >= 0 ? '+' : ''}${forge.toFixed(2)}`)
      if (shop !== null) console.log(`  Shop spent:     -${shop.toFixed(2)}`)
    }
    console.log(`  Data from:      ${report.essence_analysis.runs_with_essence_data} run(s)`)
    console.log(`  Excluded:       ${report.essence_analysis.runs_excluded_by_character_replacement} replaced-character run(s)`)
    console.log('')
  }

  if (report.shop.simulated) {
    const s = report.shop.simulated
    console.log(`  ── ${bold}Shop Simulated Affordability${reset} ──`)
    console.log(`  Runs with data: ${s.runs_with_shop_data}`)
    console.log(`  Avg essence:    ${s.avg_essence_before?.toFixed(1) ?? 'n/a'} before shop`)
    console.log(`  Offer prices:   avg ${s.avg_offer_price?.toFixed(0) ?? 'n/a'} min ${s.min_offer_price ?? 'n/a'} max ${s.max_offer_price ?? 'n/a'}`)
    const rarities = Object.entries(s.offer_rarity_distribution)
      .filter(([, count]) => count > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')
    if (rarities) console.log(`  Rarities:       ${rarities}`)
    console.log(`  Affordable:     ${s.affordable_offer_count} offers (avg ${s.avg_affordable_offer_count?.toFixed(1) ?? 'n/a'}/run)`)
    console.log(`  Would purchase: ${s.would_purchase_runs}/${s.runs_with_shop_data} runs (${(s.simulated_purchase_rate! * 100).toFixed(0)}%)`)
    console.log(`  Funnel:         ${s.funnel.shop_visits} visit(s), ${s.funnel.shop_locked_runs} locked, ${s.funnel.no_offer_runs} no offer, ${s.funnel.unaffordable_runs} unaffordable`)
    console.log('')
  }

  if (report.shop.real) {
    const r = report.shop.real
    console.log(`  ── ${bold}Shop Real Purchases${reset} ──`)
    console.log(`  Runs with data: ${r.runs_with_shop_data}`)
    console.log(`  Purchases:      ${r.runs_with_purchase} (${((r.real_purchase_rate ?? 0) * 100).toFixed(0)}%)`)
    if (r.avg_purchase_cost !== null) console.log(`  Avg cost:       ${r.avg_purchase_cost.toFixed(1)} 💎`)
    if (r.cheapest_offer_share !== null) console.log(`  Cheapest share: ${(r.cheapest_offer_share * 100).toFixed(0)}% of purchases on offer #1`)
    const purchaseRarities = Object.entries(r.purchase_rarity_distribution)
      .filter(([, count]) => count > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')
    if (purchaseRarities) console.log(`  Rarities:       ${purchaseRarities}`)
    console.log(`  Funnel:         ${r.funnel.shop_visits} visit(s), ${r.funnel.shop_locked_runs} locked, ${r.funnel.no_offer_runs} no offer, ${r.funnel.unaffordable_runs} unaffordable, ${r.funnel.affordable_runs} affordable`)
    console.log('')
  }

  if (report.idle_analysis) {
    console.log(`  ── ${bold}Idle Combat${reset} ──`)
    console.log(`  Fights:         ${report.idle_analysis.total_idle_fights} (${report.idle_analysis.runs_with_idle_data} runs)`)
    console.log(`  Win rate:       ${fmtPct(report.idle_analysis.idle_win_rate)}`)
    console.log(`  Avg XP/fight:   ${report.idle_analysis.avg_idle_xp_per_fight.toFixed(1)}`)
    console.log(`  Avg essence/f:  ${report.idle_analysis.avg_idle_essence_per_fight.toFixed(3)}`)
    console.log(`  Total essence:  ${report.idle_analysis.total_idle_essence.toFixed(1)}`)
    console.log('')
  }

  if (report.progression_curve) {
    console.log(`  ── ${bold}Progression Curve${reset} ──`)
    console.log(`  Avg level:      ${report.progression_curve.avg_level.toFixed(1)}`)
    console.log(`  Avg progress:   ${report.progression_curve.avg_xp_progress_percent.toFixed(1)}%`)
    console.log(`  Avg XP next:    ${report.progression_curve.avg_xp_for_next}`)
    console.log('')
  }

  console.log(`  ── ${bold}Lootbox${reset} ──`)
  console.log(`  Available:      ${report.lootbox.runs_with_lootbox} run(s)`)
  console.log(`  Opened:         ${report.lootbox.lootboxes_opened} (${fmtPct(report.lootbox.acquire_rate)})`)
  const rarities = Object.entries(report.lootbox.rarity_distribution)
    .filter(([, count]) => count > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
  if (rarities) console.log(`  Rarities:       ${rarities}`)
  console.log('')
  console.log(`  ── ${bold}Trends${reset} ──`)
  for (const tw of report.trends) {
    const winColor = tw.win_rate > 0.5 ? green : red
    console.log(`  ${tw.label.padEnd(10)} ${tw.count}runs  ${winColor}${fmtPct(tw.win_rate)}${reset}  ${tw.avg_fights.toFixed(1)} fights/run  ${tw.avg_level !== null ? `lvl ${tw.avg_level.toFixed(1)}` : 'lvl N/A'}  ${report.avg_xp_per_fight.toFixed(0)} XP/f  ${fmtSec(tw.avg_duration_ms)}`)
  }
  console.log('')

  if (report.issues.length > 0) {
    console.log(`  ${bold}${red}🔴 Issues${reset}`)
    for (const issue of report.issues) {
      console.log(`    ❌ ${issue}`)
    }
    console.log('')
  }

  if (report.suggestions.length > 0) {
    console.log(`  ${bold}${yellow}💡 Suggestions${reset}`)
    for (const suggestion of report.suggestions) {
      console.log(`    → ${suggestion}`)
    }
    console.log('')
  }

  if (report.issues.length === 0 && report.suggestions.length === 0) {
    console.log(`  ${green}✅ No issues or suggestions — game balance looks good!${reset}`)
    console.log('')
  }

  console.log('═══════════════════════════════════════════════════════')
  console.log('')
}

function main() {
  const stats = loadStats()
  if (stats.length === 0) {
    console.log('No QA stats to analyze.')
    process.exit(0)
  }

  const report = analyze(stats)

  // Write machine-readable output
  writeFileSync(ANALYSIS_OUTPUT, JSON.stringify(report, null, 2))
  console.log(`📊 Analysis written to ${ANALYSIS_OUTPUT}`)

  // Print human-readable report
  printReport(report)
}

main()
