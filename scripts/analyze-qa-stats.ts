/**
 * QA Stats Analyzer
 *
 * Reads qa/stats.json and gameRules.ts to produce a structured balance report.
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
const GAME_RULES_FILE = join(ROOT, 'src', 'config', 'gameRules.ts')
const ANALYSIS_OUTPUT = join(ROOT, 'qa', 'analysis-latest.json')

interface FightRecord {
  result: 'victory' | 'defeat' | 'draw'
  xp: number | null
  fight_duration_ms: number
}

interface LevelUpEvent {
  fight_number: number
  levels_gained: number
  points_to_allocate: number
  previous_level: number
  new_level: number
}

interface RunRecord {
  date: string
  run: string
  character: string
  character_action?: string | null
  replaced_character?: string | null
  fights: FightRecord[]
  lootbox?: Record<string, unknown> | null
  auto_mode_enabled?: boolean
  auto_mode_sync_ok?: boolean
  initial_stats?: Record<string, number> | null
  initial_level?: number | null
  initial_xp?: { current: number; max: number } | null
  final_stats?: { level: number | null; xp: number | null; wins: number | null; losses: number | null } | null
  final_character_stats?: Record<string, number> | null
  level_up_events?: LevelUpEvent[]
  errors: string[]
  load_times_ms?: Record<string, number>
}

interface AnalysisReport {
  generated_at: string
  total_runs: number
  total_fights: number
  successful_runs: number
  error_runs: number
  win_rate: number
  avg_fights_per_run: number
  avg_xp_per_fight: number
  avg_xp_per_win: number
  avg_xp_per_loss: number
  avg_fight_duration_ms: number
  level_distribution: Record<string, number>
  avg_level_gained_per_run: number
  avg_initial_stats: Record<string, number> | null
  avg_final_stats: Record<string, number> | null
  lootbox_acquire_rate: number
  recent_trend: {
    last_5_win_rate: number
    last_5_avg_fights: number
    last_5_avg_level: number | null
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

function analyze(stats: RunRecord[]): AnalysisReport {
  const now = new Date().toISOString()

  // Filter valid runs (have at least 1 fight)
  const validRuns = stats.filter(r => r.fights && r.fights.length > 0)
  const errorRuns = stats.filter(r => r.errors && r.errors.length > 0 && (!r.fights || r.fights.length === 0))
  const successfulRuns = validRuns.filter(r => !r.errors || r.errors.length === 0)

  // Aggregate fights
  const allFights = validRuns.flatMap(r => r.fights)
  const wins = allFights.filter(f => f.result === 'victory')
  const losses = allFights.filter(f => f.result === 'defeat')
  const draws = allFights.filter(f => f.result === 'draw')
  const winRate = allFights.length > 0 ? wins.length / allFights.length : 0

  // XP analysis
  const fightsWithXp = allFights.filter(f => f.xp !== null) as FightRecord[]
  const avgXp = fightsWithXp.length > 0
    ? fightsWithXp.reduce((s, f) => s + (f.xp ?? 0), 0) / fightsWithXp.length
    : 0
  const xpPerWin = wins.filter(f => f.xp !== null) as FightRecord[]
  const avgXpWin = xpPerWin.length > 0
    ? xpPerWin.reduce((s, f) => s + (f.xp ?? 0), 0) / xpPerWin.length
    : 0
  const xpPerLoss = losses.filter(f => f.xp !== null) as FightRecord[]
  const avgXpLoss = xpPerLoss.length > 0
    ? xpPerLoss.reduce((s, f) => s + (f.xp ?? 0), 0) / xpPerLoss.length
    : 0

  // Durations
  const avgDuration = allFights.length > 0
    ? allFights.reduce((s, f) => s + f.fight_duration_ms, 0) / allFights.length
    : 0

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
  const runsWithInitialStats = validRuns.filter(r => r.initial_stats) as (RunRecord & { initial_stats: Record<string, number> })[]
  const avgInitialStats: Record<string, number> = {}
  if (runsWithInitialStats.length > 0) {
    const allKeys = new Set(runsWithInitialStats.flatMap(r => Object.keys(r.initial_stats)))
    for (const key of allKeys) {
      const vals = runsWithInitialStats.map(r => r.initial_stats[key]).filter(v => v !== undefined)
      avgInitialStats[key] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    }
  }

  const runsWithFinalStats = validRuns.filter(r => r.final_character_stats) as (RunRecord & { final_character_stats: Record<string, number> })[]
  const avgFinalStats: Record<string, number> = {}
  if (runsWithFinalStats.length > 0) {
    const allKeys = new Set(runsWithFinalStats.flatMap(r => Object.keys(r.final_character_stats)))
    for (const key of allKeys) {
      const vals = runsWithFinalStats.map(r => r.final_character_stats[key]).filter(v => v !== undefined)
      avgFinalStats[key] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    }
  }

  // Lootbox rate
  const runsWithLootbox = validRuns.filter(r => r.lootbox && r.lootbox.available === true)
  const lootboxOpened = runsWithLootbox.filter(r => r.lootbox?.opened === true)
  const lootboxAcquireRate = runsWithLootbox.length > 0 ? lootboxOpened.length / runsWithLootbox.length : 0

  // Recent trend (last 5 valid runs)
  const last5 = validRuns.slice(-5)
  const last5Fights = last5.flatMap(r => r.fights)
  const last5Wins = last5Fights.filter(f => f.result === 'victory')
  const last5WinRate = last5Fights.length > 0 ? last5Wins.length / last5Fights.length : 0
  const last5AvgFights = last5.length > 0
    ? last5.reduce((s, r) => s + r.fights.length, 0) / last5.length
    : 0
  const last5Levels = last5
    .map(r => r.final_stats?.level)
    .filter(l => l !== null && l !== undefined) as number[]
  const last5AvgLevel = last5Levels.length > 0
    ? last5Levels.reduce((s, l) => s + l, 0) / last5Levels.length
    : null

  // Issues detection
  const issues: string[] = []
  const suggestions: string[] = []

  if (winRate < 0.3) issues.push(`Win rate is very low (${(winRate * 100).toFixed(1)}%) — game may be too hard for new characters`)
  if (winRate > 0.8) issues.push(`Win rate is very high (${(winRate * 100).toFixed(1)}%) — game may be too easy`)
  if (avgXpWin < 50) issues.push(`Avg XP per win is only ${avgXpWin.toFixed(0)} — may feel unrewarding`)
  if (avgFightDuration() > 30000) issues.push(`Avg fight duration ${(avgDuration / 1000).toFixed(1)}s is too long`)

  // XP balance check
  const xpWinRatio = avgXpWin > 0 && avgXpLoss > 0 ? avgXpWin / avgXpLoss : 0
  if (xpWinRatio < 2) suggestions.push(`XP win/loss ratio is ${xpWinRatio.toFixed(1)}x (expected ~4x). Consider adjusting COMBAT.XP_WIN or XP_LOSS in gameRules.ts (currently 100/25)`)

  // Level progression check
  if (avgLevelGained < 1 && validRuns.length >= 3) {
    suggestions.push(`Characters gain only ${avgLevelGained.toFixed(2)} levels per run on average. Consider increasing XP gains or reducing level thresholds.`)
  }

  // Stats balance
  if (Object.keys(avgInitialStats).length > 0) {
    for (const [key, val] of Object.entries(avgInitialStats)) {
      if (val < 7) suggestions.push(`Average initial ${key.toUpperCase()} is ${val.toFixed(1)} — very low. Consider adjusting STATS.MIN_VALUE (currently 6).`)
      if (val > 13) suggestions.push(`Average initial ${key.toUpperCase()} is ${val.toFixed(1)} — very high. Consider adjusting STATS.MAX_VALUE (currently 14).`)
    }
  }

  // Error rate
  const errorRate = stats.length > 0 ? errorRuns.length / stats.length : 0
  if (errorRate > 0.3) {
    issues.push(`High error rate: ${(errorRate * 100).toFixed(0)}% of runs failed completely`)
  }

  return {
    generated_at: now,
    total_runs: stats.length,
    total_fights: allFights.length,
    successful_runs: successfulRuns.length,
    error_runs: errorRuns.length,
    win_rate: Math.round(winRate * 1000) / 1000,
    avg_fights_per_run: validRuns.length > 0 ? Math.round((validRuns.reduce((s, r) => s + r.fights.length, 0) / validRuns.length) * 100) / 100 : 0,
    avg_xp_per_fight: Math.round(avgXp * 100) / 100,
    avg_xp_per_win: Math.round(avgXpWin * 100) / 100,
    avg_xp_per_loss: Math.round(avgXpLoss * 100) / 100,
    avg_fight_duration_ms: Math.round(avgDuration),
    level_distribution: levelDist,
    avg_level_gained_per_run: Math.round(avgLevelGained * 100) / 100,
    avg_initial_stats: Object.keys(avgInitialStats).length > 0 ? avgInitialStats : null,
    avg_final_stats: Object.keys(avgFinalStats).length > 0 ? avgFinalStats : null,
    lootbox_acquire_rate: Math.round(lootboxAcquireRate * 1000) / 1000,
    recent_trend: {
      last_5_win_rate: Math.round(last5WinRate * 1000) / 1000,
      last_5_avg_fights: Math.round(last5AvgFights * 100) / 100,
      last_5_avg_level: last5AvgLevel !== null ? Math.round(last5AvgLevel * 100) / 100 : null,
    },
    issues,
    suggestions,
  }

  // Helper for avgFightDuration referenced above
  function avgFightDuration(): number {
    return avgDuration
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

  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  ${bold}QA Stats Analysis Report${reset}`)
  console.log(`  ${cyan}${report.generated_at}${reset}`)
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log(`  ${bold}Runs:${reset} ${report.total_runs} total, ${report.successful_runs} successful, ${report.error_runs} errors`)
  console.log(`  ${bold}Fights:${reset} ${report.total_fights} (avg ${report.avg_fights_per_run}/run)`)
  console.log('')
  console.log(`  ── ${bold}Combat Balance${reset} ──`)
  console.log(`  Win rate:       ${report.win_rate > 0.5 ? green : red}${(report.win_rate * 100).toFixed(1)}%${reset}`)
  console.log(`  Avg XP/fight:   ${report.avg_xp_per_fight.toFixed(0)}`)
  console.log(`  Avg XP/win:     ${green}${report.avg_xp_per_win.toFixed(0)}${reset}`)
  console.log(`  Avg XP/loss:    ${red}${report.avg_xp_per_loss.toFixed(0)}${reset}`)
  console.log(`  Avg duration:   ${(report.avg_fight_duration_ms / 1000).toFixed(1)}s`)
  console.log('')
  console.log(`  ── ${bold}Level Progression${reset} ──`)
  console.log(`  Avg levels/run: ${report.avg_level_gained_per_run.toFixed(2)}`)
  console.log(`  Level dist:     ${JSON.stringify(report.level_distribution)}`)
  console.log(`  Recent avg lvl: ${report.recent_trend.last_5_avg_level !== null ? report.recent_trend.last_5_avg_level.toFixed(1) : 'N/A'}`)
  console.log('')
  console.log(`  ── ${bold}Stats${reset} ──`)
  if (report.avg_initial_stats) {
    console.log(`  Initial avg:    ${JSON.stringify(report.avg_initial_stats)}`)
  }
  if (report.avg_final_stats) {
    console.log(`  Final avg:      ${JSON.stringify(report.avg_final_stats)}`)
  }
  console.log('')
  console.log(`  ── ${bold}Lootbox${reset} ──`)
  console.log(`  Acquire rate:   ${(report.lootbox_acquire_rate * 100).toFixed(0)}%`)
  console.log('')
  console.log(`  ── ${bold}Recent Trend (last 5)${reset} ──`)
  console.log(`  Win rate:       ${(report.recent_trend.last_5_win_rate * 100).toFixed(1)}%`)
  console.log(`  Avg fights:     ${report.recent_trend.last_5_avg_fights.toFixed(1)}`)
  console.log(`  Avg level:      ${report.recent_trend.last_5_avg_level !== null ? report.recent_trend.last_5_avg_level.toFixed(1) : 'N/A'}`)
  console.log('')

  if (report.issues.length > 0) {
    console.log(`  ${bold}${red}Issues:${reset}`)
    for (const issue of report.issues) {
      console.log(`    ❌ ${issue}`)
    }
    console.log('')
  }

  if (report.suggestions.length > 0) {
    console.log(`  ${bold}${yellow}Suggestions:${reset}`)
    for (const suggestion of report.suggestions) {
      console.log(`    💡 ${suggestion}`)
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
