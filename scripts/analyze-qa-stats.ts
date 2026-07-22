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

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const STATS_FILE = join(ROOT, 'qa', 'stats.json')
const ANALYSIS_OUTPUT = join(ROOT, 'qa', 'analysis-latest.json')

interface FightRecord {
  result: 'victory' | 'defeat' | 'draw'
  xp: number | null
  fight_duration_ms: number
  max_hp?: number | null
  fight_type?: 'pvp' | 'pve'   // track PvP vs PvE fights
  monster_name?: string | null  // PvE monster name if applicable
  xp_before_modifier?: number | null  // PvE XP before 0.80 modifier (displayed value)
  xp_after_modifier?: number | null   // PvE XP after 0.80 modifier (actual saved value)
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
  fights: FightRecord[]
  idle_fights?: IdleFightRecord[]
  lootbox?: LootboxResult | null
  auto_mode_enabled?: boolean
  auto_mode_sync_ok?: boolean
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
  pve_data?: { fights: number; wins: number; xp_total: number; monsters_faced: string[] }
  level_up_events?: LevelUpEvent[]
  progression_curve?: { level: number; total_xp: number; xp_for_next: number; percent: number }
  essence?: EssenceData
  forge?: ForgeResult | null
  shop?: { essence_before?: number | null; essence_after?: number | null }
  errors: string[]
  load_times_ms?: Record<string, number>
}

interface TrendWindow {
  label: string
  count: number
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
  avg_xp_before_modifier: number | null   // average PvE XP before 0.80 modifier (displayed value)
  avg_xp_after_modifier: number | null    // average PvE XP after 0.80 modifier (actual saved value)
  pve_xp_ratio: number | null             // ratio of PvE avg_xp_after_modifier to PvP avg_xp_per_win
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
  avg_initial_max_hp: number       // average max HP at run start
  avg_final_max_hp: number         // average max HP at run end
  avg_hp_growth_per_run: number    // average increase in max HP per run
  runs_with_hp_data: number
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
}

interface IdleAnalysis {
  runs_with_idle_data: number
  total_idle_fights: number
  idle_win_rate: number
  avg_idle_xp_per_fight: number
  avg_idle_essence_per_fight: number
  total_idle_essence: number
}

interface ProgressionCurveSummary {
  runs_with_data: number
  avg_level: number
  avg_xp_progress_percent: number
  avg_xp_for_next: number
}

interface AnalysisReport {
  generated_at: string
  total_runs: number
  total_fights: number
  successful_runs: number
  halfway_runs: number
  error_runs: number
  win_rate: number
  loss_rate: number
  draw_rate: number
  avg_fights_per_run: number
  avg_xp_per_fight: number
  avg_xp_per_win: number
  avg_xp_per_loss: number
  xp_win_loss_ratio: number
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
    pvp_win_rate: number
    pve_win_rate: number
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

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
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

  // Categorize runs
  const validRuns = stats.filter(r => r.fights && r.fights.length > 0)
  const errorRuns = stats.filter(r => r.errors && r.errors.length > 0 && (!r.fights || r.fights.length === 0))
  const halfwayRuns = validRuns.filter(r => r.errors && r.errors.length > 0)
  const successfulRuns = validRuns.filter(r => !r.errors || r.errors.length === 0)

  // Aggregate fights
  const allFights = validRuns.flatMap(r => r.fights)
  const wins = allFights.filter(f => f.result === 'victory')
  const losses = allFights.filter(f => f.result === 'defeat')
  const draws = allFights.filter(f => f.result === 'draw')
  const winRate = allFights.length > 0 ? wins.length / allFights.length : 0

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
  const runsWithHpData = validRuns.filter(
    r => typeof r.initial_max_hp === 'number' && typeof r.final_max_hp === 'number'
  )
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

  // Win rate
  if (winRate < 0.3) issues.push(`Win rate is very low (${(winRate * 100).toFixed(1)}%) — game may be too hard`)
  else if (winRate < 0.4) suggestions.push(`Win rate is low (${(winRate * 100).toFixed(1)}%). Consider reducing opponent scaling or buffing starting stats.`)
  if (winRate > 0.8) issues.push(`Win rate is very high (${(winRate * 100).toFixed(1)}%) — game may be too easy`)
  else if (winRate > 0.7) suggestions.push(`Win rate is high (${(winRate * 100).toFixed(1)}%). Consider increasing opponent difficulty.`)

  // XP balance
  if (avgXpWin < 50) issues.push(`Avg XP per win is only ${avgXpWin.toFixed(0)} — may feel unrewarding`)
  if (xpWinRatio < 2) suggestions.push(`XP win/loss ratio is ${xpWinRatio.toFixed(1)}x (expected ~4x). Adjust COMBAT.XP_WIN or XP_LOSS in gameRules.ts (100/25).`)
  if (xpWinRatio > 8) suggestions.push(`XP win/loss ratio is ${xpWinRatio.toFixed(1)}x — very punishing. Consider raising COMBAT.XP_LOSS (currently 25).`)

  // Fight duration
  if (avgDuration > 30000) issues.push(`Avg fight duration ${(avgDuration / 1000).toFixed(1)}s is too long`)
  if (maxDuration > 60000 && maxDuration > avgDuration * 3) suggestions.push(`Max fight duration ${(maxDuration / 1000).toFixed(0)}s is ${(maxDuration / avgDuration).toFixed(1)}x the average — possible timeout issue`)

  // Level progression
  if (avgLevelGained < 1 && validRuns.length >= 3) {
    suggestions.push(`Characters gain only ${avgLevelGained.toFixed(2)} levels/run. Consider increasing XP gains or reducing XP thresholds.`)
  }
  if (avgLevelGained > 5) {
    suggestions.push(`Characters gain ${avgLevelGained.toFixed(1)} levels/run — very fast progression. Consider increasing XP thresholds.`)
  }

  // Stats balance
  if (Object.keys(avgInitialStats).length > 0) {
    for (const [key, val] of Object.entries(avgInitialStats)) {
      if (val < 5) suggestions.push(`Average initial ${key.toUpperCase()} is ${val.toFixed(1)} (min=${Math.round(val)}). Consider raising STATS.MIN_VALUE (currently 5).`)
      if (val > 15) suggestions.push(`Average initial ${key.toUpperCase()} is ${val.toFixed(1)} (max=${Math.round(val)}). Consider lowering STATS.MAX_VALUE (currently 15).`)
    }
    // Check stat variance (are all stats roughly equal?)
    const vals = Object.values(avgInitialStats)
    const spread = vals.length > 0 ? Math.max(...vals) - Math.min(...vals) : 0
    if (spread < 1 && vals.length >= 6) {
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

  // Error rate
  const errorRate = stats.length > 0 ? errorRuns.length / stats.length : 0
  const totalErrorRate = stats.length > 0 ? (errorRuns.length + halfwayRuns.length) / stats.length : 0
  if (errorRate > 0.3) {
    issues.push(`High error rate: ${(errorRate * 100).toFixed(0)}% of runs failed completely`)
  }
  if (totalErrorRate > 0.5) {
    suggestions.push(`High total error rate (${(totalErrorRate * 100).toFixed(0)}% including partial runs). Check for UI stability issues.`)
  }

  // Trend direction
  const allTimeTrend = trendWindows.find(t => t.label === 'all_time')
  const last5Trend = trendWindows.find(t => t.label === 'last_5')
  if (allTimeTrend && last5Trend && last5Trend.count >= 3) {
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
  if (allTimeTrend && last3Trend && last3Trend.count >= 2) {
    const swing = last3Trend.win_rate - allTimeTrend.win_rate
    if (swing > 0.20) {
      issues.push(`Win rate surged from ${(allTimeTrend.win_rate * 100).toFixed(0)}% to ${(last3Trend.win_rate * 100).toFixed(0)}% in last 3 runs. Monitor for over-correction — game may be too easy.`)
    } else if (swing < -0.20) {
      issues.push(`Win rate dropped from ${(allTimeTrend.win_rate * 100).toFixed(0)}% to ${(last3Trend.win_rate * 100).toFixed(0)}% in last 3 runs. Investigate bot difficulty or balance changes.`)
    }
  }

  // --- PvE Analysis ---
  const pveFights = allFights.filter(f => f.fight_type === 'pve')
  const pvpFights = allFights.filter(f => f.fight_type !== 'pve')
  let pveAnalysis: PveAnalysis | null = null

  if (pveFights.length > 0) {
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

    // PvE/PvP XP ratio: compare after_modifier PvE XP to PvP win XP
    const pvpWinsForRatio = wins.filter(f => f.fight_type !== 'pve').filter((f): f is FightRecord => f.xp !== null)
    const avgPvpXpWin = pvpWinsForRatio.length > 0
      ? pvpWinsForRatio.reduce((s, f) => s + (f.xp ?? 0), 0) / pvpWinsForRatio.length
      : 0
    const pveRatio = avgXpAfter !== null && avgPvpXpWin > 0
      ? avgXpAfter / avgPvpXpWin
      : null

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
    }
  }

  // --- Equipment Analysis ---
  // Gather from both initial_equipment and lootbox_equipment
  const runsWithEquipment = validRuns.filter(
    (r): r is RunRecord & { initial_equipment: Array<{ slot: string; name: string }> } =>
      r.initial_equipment !== null && r.initial_equipment !== undefined && r.initial_equipment.length > 0
  )
  const runsWithLootboxEquipment = validRuns.filter(
    (r): r is RunRecord & { lootbox_equipment: Array<{ slot: string; name: string }> } =>
      r.lootbox_equipment !== null && r.lootbox_equipment !== undefined && r.lootbox_equipment.length > 0
  )
  const allEquippedItems = [
    ...runsWithEquipment.flatMap(r => r.initial_equipment.map(e => e.name)),
    ...runsWithLootboxEquipment.flatMap(r => r.lootbox_equipment.map(e => e.name)),
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
  // Use initial_streak, final_streak, and lootbox_streak
  const runsWithInitStreak = validRuns.filter((r): r is RunRecord & { initial_streak: number } => typeof r.initial_streak === 'number')
  const runsWithFinalStreak = validRuns.filter((r): r is RunRecord & { final_streak: number } => typeof r.final_streak === 'number')
  const runsWithLootboxStreak = validRuns.filter((r): r is RunRecord & { lootbox_streak: number } => typeof r.lootbox_streak === 'number')
  let streakAnalysis: StreakAnalysis | null = null
  if (runsWithInitStreak.length > 0 || runsWithLootboxStreak.length > 0) {
    streakAnalysis = {
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

  // --- Fight Type Breakdown ---
  const pvpWins = pvpFights.filter(f => f.result === 'victory')
  const pveWins = pveFights.filter(f => f.result === 'victory')
  const fightTypeBreakdown = {
    pvp_fights: pvpFights.length,
    pve_fights: pveFights.length,
    pvp_win_rate: pvpFights.length > 0 ? pvpWins.length / pvpFights.length : 0,
    pve_win_rate: pveFights.length > 0 ? pveWins.length / pveFights.length : 0,
  }

  // --- PvE-specific suggestions ---
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
    // PvE XP ratio: warn if actual saved XP deviates significantly from expected 80%
    if (pveAnalysis.pve_xp_ratio !== null && pveAnalysis.total_fights >= 3) {
      const expectedRatio = 0.80
      const tolerance = 0.10
      if (pveAnalysis.pve_xp_ratio < expectedRatio - tolerance) {
        suggestions.push(`PvE XP ratio is ${(pveAnalysis.pve_xp_ratio * 100).toFixed(0)}% of PvP (expected ${(expectedRatio * 100).toFixed(0)}%). PvE XP may be too low — check if XP_LOSS is used as base instead of XP_WIN.`)
      } else if (pveAnalysis.pve_xp_ratio > expectedRatio + tolerance) {
        suggestions.push(`PvE XP ratio is ${(pveAnalysis.pve_xp_ratio * 100).toFixed(0)}% of PvP (expected ${(expectedRatio * 100).toFixed(0)}%). PvE XP may be too high.`)
      }
    }
  }

  // --- Streak suggestions ---
  if (streakAnalysis && streakAnalysis.runs_with_data >= 3) {
    if (streakAnalysis.avg_initial_streak === 0 && streakAnalysis.avg_final_streak === 0) {
      suggestions.push(`Lootbox streak is consistently 0 — players may not be claiming daily lootboxes consistently. Check invite flow.`)
    }
  }

  // --- Essence Analysis ---
  const runsWithEssenceData = validRuns.filter(
    (r): r is RunRecord & { initial_essence: number; final_essence: number } =>
      typeof r.initial_essence === 'number' && typeof r.final_essence === 'number'
  )
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
    }
  }

  // --- Idle Analysis ---
  const runsWithIdleData = validRuns.filter(
    (r): r is RunRecord & { idle_fights: IdleFightRecord[] } =>
      r.idle_fights !== null && r.idle_fights !== undefined && r.idle_fights.length > 0
  )
  let idleAnalysis: IdleAnalysis | null = null
  if (runsWithIdleData.length > 0) {
    const allIdleFights = runsWithIdleData.flatMap(r => r.idle_fights)
    const idleWins = allIdleFights.filter(f => f.result === 'victory')
    const idleXpFights = allIdleFights.filter((f): f is IdleFightRecord & { xp: number } => f.xp !== null)
    const idleEssenceFights = allIdleFights.filter((f): f is IdleFightRecord & { essence: number } => f.essence !== null)

    idleAnalysis = {
      runs_with_idle_data: runsWithIdleData.length,
      total_idle_fights: allIdleFights.length,
      idle_win_rate: allIdleFights.length > 0 ? idleWins.length / allIdleFights.length : 0,
      avg_idle_xp_per_fight: idleXpFights.length > 0
        ? Math.round((idleXpFights.reduce((s, f) => s + f.xp, 0) / idleXpFights.length) * 100) / 100
        : 0,
      avg_idle_essence_per_fight: idleEssenceFights.length > 0
        ? Math.round((idleEssenceFights.reduce((s, f) => s + f.essence, 0) / idleEssenceFights.length) * 100) / 100
        : 0,
      total_idle_essence: Math.round(idleEssenceFights.reduce((s, f) => s + f.essence, 0) * 100) / 100,
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

  // Idle suggestions
  if (idleAnalysis && idleAnalysis.runs_with_idle_data >= 3) {
    if (idleAnalysis.avg_idle_essence_per_fight > 0.5) {
      suggestions.push(`High idle essence (${idleAnalysis.avg_idle_essence_per_fight.toFixed(2)}/fight). Consider reducing IDLE_CONFIG.ESSENCE.BASE_RATE or LEVEL_SCALE.`)
    }
    if (idleAnalysis.idle_win_rate < 0.4) {
      suggestions.push(`Low idle win rate (${(idleAnalysis.idle_win_rate * 100).toFixed(0)}%). Idle monsters may be too strong.`)
    }
    if (idleAnalysis.idle_win_rate > 0.9) {
      suggestions.push(`High idle win rate (${(idleAnalysis.idle_win_rate * 100).toFixed(0)}%). Idle monsters may be too weak.`)
    }
  }

  return {
    generated_at: now,
    total_runs: stats.length,
    total_fights: allFights.length,
    successful_runs: successfulRuns.length,
    halfway_runs: halfwayRuns.length,
    error_runs: errorRuns.length,
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
  console.log(`        ${green}${report.successful_runs} successful${reset}, ${yellow}${report.halfway_runs} partial${reset}, ${red}${report.error_runs} errors${reset}`)
  console.log(`  ${bold}Fights:${reset} ${report.total_fights} (avg ${report.avg_fights_per_run}/run)`)
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
  if (report.fight_type_breakdown.pve_fights > 0 || report.fight_type_breakdown.pvp_fights > 0) {
    console.log(`  ── ${bold}Fight Type${reset} ──`)
    console.log(`  PvP:            ${report.fight_type_breakdown.pvp_fights} fights, ${fmtPct(report.fight_type_breakdown.pvp_win_rate)} win rate`)
    console.log(`  PvE:            ${report.fight_type_breakdown.pve_fights} fights, ${fmtPct(report.fight_type_breakdown.pve_win_rate)} win rate`)
    console.log('')
  }

  if (report.pve_analysis && report.pve_analysis.total_fights >= 1) {
    console.log(`  ── ${bold}PvE Monsters${reset} ──`)
    const monsterStr = Object.entries(report.pve_analysis.monsters_faced)
      .map(([name, count]) => `${name}=${count}`)
      .join(', ')
    console.log(`  Monsters:       ${monsterStr || 'none'}`)
    console.log(`  XP/fight:       ${report.pve_analysis.avg_xp_per_fight.toFixed(0)}`)
    console.log(`  Avg duration:   ${fmtSec(report.pve_analysis.avg_duration_ms)}`)
    if (report.pve_analysis.avg_xp_before_modifier !== null) {
      console.log(`  XP before mod:  ${report.pve_analysis.avg_xp_before_modifier.toFixed(1)}`)
    }
    if (report.pve_analysis.avg_xp_after_modifier !== null) {
      console.log(`  XP after mod:   ${report.pve_analysis.avg_xp_after_modifier.toFixed(1)}`)
    }
    if (report.pve_analysis.pve_xp_ratio !== null) {
      console.log(`  PvE/PvP ratio:  ${fmtPct(report.pve_analysis.pve_xp_ratio)} (expected 80%)`)
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
    console.log(`  Avg initial:    ${report.streak_analysis.avg_initial_streak.toFixed(1)}`)
    console.log(`  Avg final:      ${report.streak_analysis.avg_final_streak.toFixed(1)}`)
    console.log('')
  }

  if (report.hp_analysis) {
    console.log(`  ── ${bold}HP Growth (max HP)${reset} ──`)
    console.log(`  Initial avg:    ${report.hp_analysis.avg_initial_max_hp.toFixed(0)} HP`)
    console.log(`  Final avg:      ${report.hp_analysis.avg_final_max_hp.toFixed(0)} HP`)
    console.log(`  Growth/run:     +${report.hp_analysis.avg_hp_growth_per_run.toFixed(1)} HP`)
    console.log(`  Data from:      ${report.hp_analysis.runs_with_hp_data} run(s)`)
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
