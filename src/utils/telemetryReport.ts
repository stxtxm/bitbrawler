/**
 * Pure aggregation for the telemetry report (#1230, part 2).
 *
 * Kept out of the CLI so D1/D7 maths is unit-tested without a database:
 * `scripts/telemetry-report.ts` only fetches rows and prints this summary.
 *
 * Definitions:
 *  - a "day" is the UTC date of `created_at` (timestamptz from Postgres);
 *  - retention only looks at `session_start`, one row per page load;
 *  - an install's cohort day is the day of its FIRST session_start;
 *  - Dn = share of a cohort that started a session exactly n days later;
 *  - a cohort is "mature" for Dn only once the dataset covers day + n.
 */

export interface TelemetryReportRow {
  install_id: string
  event: string
  created_at: string
  level: number | null
  props: Record<string, unknown> | null
}

export interface TelemetrySummary {
  totalEvents: number
  totalInstalls: number
  firstDay: string | null
  lastDay: string | null
  events: Array<{ event: string; count: number }>
  activeByDay: Array<{ day: string; installs: number }>
  cohorts: Array<{ day: string; installs: number; d1: number | null; d7: number | null }>
  d1: { retained: number; eligible: number; rate: number | null }
  d7: { retained: number; eligible: number; rate: number | null }
  levels: Array<{ level: number; installs: number }>
  purchases: { count: number; installs: number; avgPrice: number | null }
  walls: Array<{ level: number; count: number }>
  boss: { attempts: number; installs: number; wins: number; winRate: number | null }
}

const DAY_MS = 86_400_000

export const utcDay = (iso: string): string | null => {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return null
  return new Date(time).toISOString().slice(0, 10)
}

const dayNumber = (day: string): number =>
  Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS)

const addDays = (day: string, days: number): string =>
  new Date((dayNumber(day) + days) * DAY_MS).toISOString().slice(0, 10)

const rate = (retained: number, eligible: number): number | null =>
  eligible > 0 ? retained / eligible : null

const propPrice = (row: TelemetryReportRow): number | null => {
  const price = row.props?.price
  return typeof price === 'number' && Number.isFinite(price) ? price : null
}

export function summarizeTelemetry(rows: TelemetryReportRow[]): TelemetrySummary {
  const events = new Map<string, number>()
  const installs = new Set<string>()

  // install -> set of days with a session_start
  const sessionDays = new Map<string, Set<string>>()
  // install -> first session day
  const firstDay = new Map<string, string>()
  // install -> max level seen on any event
  const maxLevel = new Map<string, number>()

  let firstDayOverall: string | null = null
  let lastDayOverall: string | null = null

  for (const row of rows) {
    if (!row.install_id) continue
    events.set(row.event, (events.get(row.event) ?? 0) + 1)
    installs.add(row.install_id)

    const day = utcDay(row.created_at)
    if (day === null) continue
    if (firstDayOverall === null || day < firstDayOverall) firstDayOverall = day
    if (lastDayOverall === null || day > lastDayOverall) lastDayOverall = day

    if (typeof row.level === 'number' && Number.isFinite(row.level) && row.level > 0) {
      const level = Math.round(row.level)
      maxLevel.set(row.install_id, Math.max(maxLevel.get(row.install_id) ?? 0, level))
    }

    if (row.event !== 'session_start') continue
    const days = sessionDays.get(row.install_id) ?? new Set<string>()
    days.add(day)
    sessionDays.set(row.install_id, days)
    const known = firstDay.get(row.install_id)
    if (known === undefined || day < known) firstDay.set(row.install_id, day)
  }

  // Active installs per day (session_start only).
  const activeCounts = new Map<string, number>()
  for (const days of sessionDays.values()) {
    for (const day of days) activeCounts.set(day, (activeCounts.get(day) ?? 0) + 1)
  }
  const activeByDay = [...activeCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, installs: count }))

  const cohortDays = [...new Set([...firstDay.values()])].sort()
  const lastDayNumber = lastDayOverall === null ? null : dayNumber(lastDayOverall)

  const installsByCohort = new Map<string, string[]>()
  for (const [installId, day] of firstDay.entries()) {
    const list = installsByCohort.get(day) ?? []
    list.push(installId)
    installsByCohort.set(day, list)
  }

  const retainedOn = (day: string, offset: number): number => {
    const target = addDays(day, offset)
    return (installsByCohort.get(day) ?? [])
      .filter((installId) => sessionDays.get(installId)?.has(target)).length
  }

  const cohorts = cohortDays.map((day) => {
    const eligible = installsByCohort.get(day) ?? []
    const mature = (offset: number): boolean =>
      lastDayNumber !== null && dayNumber(day) + offset <= lastDayNumber

    return {
      day,
      installs: eligible.length,
      d1: mature(1) ? retainedOn(day, 1) / eligible.length : null,
      d7: mature(7) ? retainedOn(day, 7) / eligible.length : null,
    }
  })

  const pooled = (offset: 1 | 7): { retained: number; eligible: number; rate: number | null } => {
    let retained = 0
    let eligible = 0
    for (const cohort of cohorts) {
      if (cohort.installs === 0 || lastDayNumber === null) continue
      if (dayNumber(cohort.day) + offset > lastDayNumber) continue
      eligible += cohort.installs
      retained += retainedOn(cohort.day, offset)
    }
    return { retained, eligible, rate: rate(retained, eligible) }
  }

  const levels = [...maxLevel.values()].reduce<Map<number, number>>((map, level) => {
    map.set(level, (map.get(level) ?? 0) + 1)
    return map
  }, new Map())
  const levelHistogram = [...levels.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, count]) => ({ level, installs: count }))

  const purchases = rows.filter((row) => row.event === 'purchase')
  const purchaseInstalls = new Set(purchases.map((row) => row.install_id).filter(Boolean))
  const prices = purchases.map(propPrice).filter((price): price is number => price !== null)
  const avgPrice = prices.length > 0
    ? Math.round((prices.reduce((sum, price) => sum + price, 0) / prices.length) * 100) / 100
    : null

  const wallCounts = new Map<number, number>()
  for (const row of rows) {
    if (row.event !== 'wall_reached') continue
    const level = typeof row.level === 'number' ? Math.round(row.level) : 0
    if (level <= 0) continue
    wallCounts.set(level, (wallCounts.get(level) ?? 0) + 1)
  }
  const walls = [...wallCounts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, count]) => ({ level, count }))

  const bossRows = rows.filter((row) => row.event === 'boss_attempt')
  const bossInstalls = new Set(bossRows.map((row) => row.install_id).filter(Boolean))
  const bossWins = bossRows.filter((row) => row.props?.won === true).length

  return {
    totalEvents: rows.length,
    totalInstalls: installs.size,
    firstDay: firstDayOverall,
    lastDay: lastDayOverall,
    events: [...events.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([event, count]) => ({ event, count })),
    activeByDay,
    cohorts,
    d1: pooled(1),
    d7: pooled(7),
    levels: levelHistogram,
    purchases: { count: purchases.length, installs: purchaseInstalls.size, avgPrice },
    walls,
    boss: {
      attempts: bossRows.length,
      installs: bossInstalls.size,
      wins: bossWins,
      winRate: rate(bossWins, bossRows.length),
    },
  }
}
