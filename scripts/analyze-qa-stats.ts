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

interface HpSnapshot {
  current: number
  max: number
}

interface FightRecord {
  result: 'victory' | 'defeat' | 'draw'
  xp: number | null
  fight_duration_ms: number
  hp_after?: HpSnapshot | null
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

interface RunRecord {
  date: string
  run: string
  character: string
  character_action?: string | null
  replaced_character?: string | null
  fights: FightRecord[]
  lootbox?: LootboxResult | null
  auto_mode_enabled?: boolean
  auto_mode_sync_ok?: boolean
  initial_stats?: Record<string, number> | null
  initial_level?: number | null
  initial_xp?: { current: number; max: number } | null
  initial_hp?: HpSnapshot | null
  final_stats?: { level: number | null; xp: number | null; wins: number | null; losses: number | null } | null
  final_character_stats?: Record<string, number> | null
  final_hp?: HpSnapshot | null
  level_up_events?: LevelUpEvent[]
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

interface HpAnalysis {
  avg_hp_loss_per_fight: number
  avg_hp_after_fight: number
  survivability_score: number     // 0-1, how much HP remains on average after fights
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

interface AnalysisReport {
  generated_at: string
  total_runs: number
  total_fights: number
  successful_runs: number
  halfway_runs: number            // had fights but also errors
  error_runs: number              // zero fights completed
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
  lootbox: {
    runs_with_lootbox: number
    lootboxes_opened: number
    acquire_rate: number
    rarity_distribution: LootRarityDistribution
  }
  trends: TrendWindow[]           // multiple windows: last 3, 5, 10, all
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

  // --- HP Analysis ---
  const fightsWithHp = allFights.filter(f => f.hp_after !== null && f.hp_after !== undefined)
  const runsWithHp = validRuns.filter(r => r.initial_hp !== null && r.initial_hp !== undefined && r.final_hp !== null && r.final_hp !== undefined)
  let hpAnalysis: HpAnalysis | null = null

  if (fightsWithHp.length > 0) {
    const avgHpAfter = fightsWithHp.reduce((s, f) => s + (f.hp_after?.current ?? 0), 0) / fightsWithHp.length
    // Average HP loss per fight: (HP before first fight - HP after each fight) averaged
    let totalHpLoss = 0
    let hpLossCount = 0
    for (const r of validRuns) {
      if (r.initial_hp && r.fights.length > 0) {
        for (const f of r.fights) {
          if (f.hp_after !== null && f.hp_after !== undefined) {
            totalHpLoss += (r.initial_hp.current - f.hp_after.current)
            hpLossCount++
          }
        }
      }
    }
    const avgHpLoss = hpLossCount > 0 ? totalHpLoss / hpLossCount : 0

    // Survivability: average HP remaining as percentage
    const hpAfterPcts = fightsWithHp
      .filter(f => f.hp_after && f.hp_after.max > 0)
      .map(f => (f.hp_after!.current / f.hp_after!.max))
    const survivability = hpAfterPcts.length > 0
      ? hpAfterPcts.reduce((s, p) => s + p, 0) / hpAfterPcts.length
      : 0

    hpAnalysis = {
      avg_hp_loss_per_fight: Math.round(avgHpLoss * 10) / 10,
      avg_hp_after_fight: Math.round(avgHpAfter * 10) / 10,
      survivability_score: Math.round(survivability * 1000) / 1000,
      runs_with_hp_data: runsWithHp.length,
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
      if (val < 7) suggestions.push(`Average initial ${key.toUpperCase()} is ${val.toFixed(1)} (min=${Math.round(val)}). Consider raising STATS.MIN_VALUE (currently 6).`)
      if (val > 13) suggestions.push(`Average initial ${key.toUpperCase()} is ${val.toFixed(1)} (max=${Math.round(val)}). Consider lowering STATS.MAX_VALUE (currently 14).`)
    }
    // Check stat variance (are all stats roughly equal?)
    const vals = Object.values(avgInitialStats)
    const spread = vals.length > 0 ? Math.max(...vals) - Math.min(...vals) : 0
    if (spread < 1 && vals.length >= 6) {
      suggestions.push(`All initial stats are nearly identical (spread=${spread.toFixed(1)}). Random stat generation may need more variance.`)
    }
  }

  // HP / survivability
  if (hpAnalysis) {
    if (hpAnalysis.survivability_score < 0.3) issues.push(`Low survivability (avg ${(hpAnalysis.survivability_score * 100).toFixed(0)}% HP after fight). Consider increasing VIT impact on HP.`)
    if (hpAnalysis.survivability_score > 0.95) suggestions.push(`Very high survivability (avg ${(hpAnalysis.survivability_score * 100).toFixed(0)}% HP after fight). Fights may not be threatening enough.`)
    if (hpAnalysis.avg_hp_loss_per_fight > 50) suggestions.push(`Avg HP loss per fight is ${hpAnalysis.avg_hp_loss_per_fight.toFixed(0)}. Consider balancing damage output.`)
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
    lootbox: {
      runs_with_lootbox: runsWithLootbox.length,
      lootboxes_opened: lootboxOpened.length,
      acquire_rate: Math.round(lootboxAcquireRate * 1000) / 1000,
      rarity_distribution: rarityDist,
    },
    trends: trendWindows,
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
  if (report.hp_analysis) {
    console.log(`  ── ${bold}HP / Survivability${reset} ──`)
    console.log(`  HP after fight: ${report.hp_analysis.avg_hp_after_fight.toFixed(0)} (${(report.hp_analysis.survivability_score * 100).toFixed(0)}% remaining)`)
    console.log(`  HP loss/fight:  ${report.hp_analysis.avg_hp_loss_per_fight.toFixed(1)}`)
    console.log(`  Data from:      ${report.hp_analysis.runs_with_hp_data} run(s)`)
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
