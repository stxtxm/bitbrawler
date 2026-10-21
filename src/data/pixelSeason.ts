export const PIXEL_SEASON_ACTIVE_DAYS = 14
export const PIXEL_SEASON_REST_DAYS = 2
export const PIXEL_SEASON_CYCLE_DAYS = PIXEL_SEASON_ACTIVE_DAYS + PIXEL_SEASON_REST_DAYS
export const PIXEL_SEASON_TIER_COUNT = 30
export const PIXEL_SEASON_POINTS_PER_TIER = 100
export const PIXEL_SEASON_MAX_POINTS = PIXEL_SEASON_TIER_COUNT * PIXEL_SEASON_POINTS_PER_TIER
export const PIXEL_SEASON_ANCHOR_ISO = '2026-01-05'

const DAY_MS = 24 * 60 * 60 * 1000
const ANCHOR_MS = Date.parse(`${PIXEL_SEASON_ANCHOR_ISO}T00:00:00Z`)

export type PixelSeasonThemeId = 'neon-dojo' | 'crystal-cavern' | 'ember-forge'

export interface PixelSeasonTheme {
  id: PixelSeasonThemeId
  name: string
  tagline: string
  accent: string
}

export const PIXEL_SEASON_THEMES: PixelSeasonTheme[] = [
  { id: 'neon-dojo', name: 'NEON DOJO', tagline: 'Discipline et néons.', accent: '#63b3ff' },
  { id: 'crystal-cavern', name: 'CRYSTAL CAVERN', tagline: 'Éclats et échos.', accent: '#9b59b6' },
  { id: 'ember-forge', name: 'EMBER FORGE', tagline: 'Braises et acier.', accent: '#ff8c42' },
]

export type PixelSeasonAction = 'fight' | 'salvage' | 'idle' | 'streak'

export interface PixelSeasonMission {
  id: string
  action: PixelSeasonAction
  target: number
  points: number
  label: string
}

export const PIXEL_SEASON_MISSIONS: PixelSeasonMission[] = [
  { id: 'fight-1', action: 'fight', target: 20, points: 250, label: 'Gagner 20 combats' },
  { id: 'fight-2', action: 'fight', target: 50, points: 400, label: 'Gagner 50 combats' },
  { id: 'fight-3', action: 'fight', target: 90, points: 550, label: 'Gagner 90 combats' },
  { id: 'salvage-1', action: 'salvage', target: 10, points: 200, label: 'Salvager 10 objets' },
  { id: 'salvage-2', action: 'salvage', target: 25, points: 350, label: 'Salvager 25 objets' },
  { id: 'salvage-3', action: 'salvage', target: 40, points: 450, label: 'Salvager 40 objets' },
  { id: 'idle-1', action: 'idle', target: 10, points: 250, label: 'Vaincre 10 monstres idle' },
  { id: 'idle-2', action: 'idle', target: 25, points: 400, label: 'Vaincre 25 monstres idle' },
  { id: 'streak-1', action: 'streak', target: 10, points: 300, label: 'Atteindre une streak de 10' },
  { id: 'streak-2', action: 'streak', target: 20, points: 450, label: 'Atteindre une streak de 20' },
]

export type PixelSeasonFreeRewardType = 'essence' | 'lootbox' | 'cosmetic_frag'
export type PixelSeasonPremiumRewardType = 'skin' | 'palette' | 'frame'

export interface PixelSeasonFreeReward {
  tier: number
  type: PixelSeasonFreeRewardType
  amount: number
  label: string
}

export interface PixelSeasonPremiumReward {
  tier: number
  type: PixelSeasonPremiumRewardType
  amount: number
  label: string
}

export const PIXEL_SEASON_FREE_REWARDS: PixelSeasonFreeReward[] = [
  { tier: 1, type: 'essence', amount: 5, label: '5 Essence' },
  { tier: 2, type: 'essence', amount: 10, label: '10 Essence' },
  { tier: 3, type: 'cosmetic_frag', amount: 1, label: 'Fragment cosmétique' },
  { tier: 4, type: 'essence', amount: 5, label: '5 Essence' },
  { tier: 5, type: 'lootbox', amount: 1, label: 'Lootbox commune' },
  { tier: 6, type: 'essence', amount: 15, label: '15 Essence' },
  { tier: 7, type: 'essence', amount: 5, label: '5 Essence' },
  { tier: 8, type: 'essence', amount: 10, label: '10 Essence' },
  { tier: 9, type: 'cosmetic_frag', amount: 1, label: 'Fragment cosmétique' },
  { tier: 10, type: 'lootbox', amount: 1, label: 'Lootbox commune' },
  { tier: 11, type: 'essence', amount: 15, label: '15 Essence' },
  { tier: 12, type: 'essence', amount: 10, label: '10 Essence' },
  { tier: 13, type: 'essence', amount: 5, label: '5 Essence' },
  { tier: 14, type: 'essence', amount: 15, label: '15 Essence' },
  { tier: 15, type: 'cosmetic_frag', amount: 1, label: 'Fragment cosmétique' },
  { tier: 16, type: 'essence', amount: 5, label: '5 Essence' },
  { tier: 17, type: 'essence', amount: 10, label: '10 Essence' },
  { tier: 18, type: 'essence', amount: 15, label: '15 Essence' },
  { tier: 19, type: 'essence', amount: 5, label: '5 Essence' },
  { tier: 20, type: 'lootbox', amount: 1, label: 'Lootbox commune' },
  { tier: 21, type: 'cosmetic_frag', amount: 1, label: 'Fragment cosmétique' },
  { tier: 22, type: 'essence', amount: 10, label: '10 Essence' },
  { tier: 23, type: 'essence', amount: 15, label: '15 Essence' },
  { tier: 24, type: 'essence', amount: 5, label: '5 Essence' },
  { tier: 25, type: 'lootbox', amount: 1, label: 'Lootbox commune' },
  { tier: 26, type: 'essence', amount: 10, label: '10 Essence' },
  { tier: 27, type: 'cosmetic_frag', amount: 1, label: 'Fragment cosmétique' },
  { tier: 28, type: 'essence', amount: 15, label: '15 Essence' },
  { tier: 29, type: 'essence', amount: 10, label: '10 Essence' },
  { tier: 30, type: 'lootbox', amount: 1, label: 'Lootbox commune' },
]

export const PIXEL_SEASON_PREMIUM_REWARDS: PixelSeasonPremiumReward[] = [
  { tier: 3, type: 'palette', amount: 1, label: 'Palette Neon-01' },
  { tier: 6, type: 'frame', amount: 1, label: 'Cadre Dojo' },
  { tier: 9, type: 'skin', amount: 1, label: 'Skin Ronin' },
  { tier: 12, type: 'palette', amount: 1, label: 'Palette Cavern-02' },
  { tier: 15, type: 'frame', amount: 1, label: 'Cadre Crystal' },
  { tier: 18, type: 'skin', amount: 1, label: 'Skin Monarch' },
  { tier: 21, type: 'palette', amount: 1, label: 'Palette Ember-03' },
  { tier: 24, type: 'frame', amount: 1, label: 'Cadre Magma' },
  { tier: 27, type: 'skin', amount: 1, label: 'Skin Titan' },
  { tier: 30, type: 'skin', amount: 1, label: 'Skin Pixel Legend' },
]

export interface SeasonCounters {
  fight: number
  salvage: number
  idle: number
  streak: number
}

export const EMPTY_SEASON_COUNTERS: SeasonCounters = {
  fight: 0,
  salvage: 0,
  idle: 0,
  streak: 0,
}

export type PixelSeasonPhase = 'active' | 'rest'

export interface PixelSeasonCalendar {
  seasonId: string
  theme: PixelSeasonTheme
  startDate: Date
  activeEndDate: Date
  restEndDate: Date
  phase: PixelSeasonPhase
  dayIndex: number
  activeDaysLeft: number
  restDaysLeft: number
}

export interface PixelSeasonLeaderboardEntry {
  rank: number
  name: string
  points: number
  isPlayer: boolean
}

const RIVAL_NAMES = ['NEON_RONIN', 'BYTE_QUEEN', 'GLITCH_WOLF', 'PIXEL_KING', 'LAG_NINJA']

function formatUtcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function parseSeasonStart(seasonId: string): number {
  const parsed = Date.parse(`${seasonId}T00:00:00Z`)
  return Number.isFinite(parsed) ? parsed : ANCHOR_MS
}

function getCycleIndex(seasonId: string): number {
  return Math.floor((parseSeasonStart(seasonId) - ANCHOR_MS) / (PIXEL_SEASON_CYCLE_DAYS * DAY_MS))
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

export function getPixelSeasonIdForDate(date: Date): string {
  const dayMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const cycle = Math.floor((dayMs - ANCHOR_MS) / (PIXEL_SEASON_CYCLE_DAYS * DAY_MS))
  return formatUtcDate(ANCHOR_MS + cycle * PIXEL_SEASON_CYCLE_DAYS * DAY_MS)
}

export function getPixelSeasonNextSeasonId(seasonId: string): string {
  return formatUtcDate(parseSeasonStart(seasonId) + PIXEL_SEASON_CYCLE_DAYS * DAY_MS)
}

export function getPixelSeasonTheme(seasonId: string): PixelSeasonTheme {
  const index = ((getCycleIndex(seasonId) % PIXEL_SEASON_THEMES.length) + PIXEL_SEASON_THEMES.length)
    % PIXEL_SEASON_THEMES.length
  return PIXEL_SEASON_THEMES[index]
}

export function getPixelSeasonCalendar(seasonId: string, now: Date): PixelSeasonCalendar {
  const startMs = parseSeasonStart(seasonId)
  const rawDayIndex = Math.floor((now.getTime() - startMs) / DAY_MS)
  const dayIndex = Math.min(Math.max(rawDayIndex, 0), PIXEL_SEASON_CYCLE_DAYS - 1)
  const phase: PixelSeasonPhase = dayIndex < PIXEL_SEASON_ACTIVE_DAYS ? 'active' : 'rest'
  return {
    seasonId,
    theme: getPixelSeasonTheme(seasonId),
    startDate: new Date(startMs),
    activeEndDate: new Date(startMs + PIXEL_SEASON_ACTIVE_DAYS * DAY_MS),
    restEndDate: new Date(startMs + PIXEL_SEASON_CYCLE_DAYS * DAY_MS),
    phase,
    dayIndex,
    activeDaysLeft: phase === 'active' ? PIXEL_SEASON_ACTIVE_DAYS - dayIndex : 0,
    restDaysLeft: phase === 'rest' ? PIXEL_SEASON_CYCLE_DAYS - dayIndex : PIXEL_SEASON_REST_DAYS,
  }
}

export function getPixelSeasonMissionProgress(mission: PixelSeasonMission, counters: SeasonCounters): number {
  return Math.min(mission.target, Math.max(0, counters[mission.action] ?? 0))
}

export function isPixelSeasonMissionComplete(mission: PixelSeasonMission, counters: SeasonCounters): boolean {
  return (counters[mission.action] ?? 0) >= mission.target
}

export function getPixelSeasonPoints(counters: SeasonCounters): number {
  return PIXEL_SEASON_MISSIONS.reduce(
    (sum, mission) => sum + (isPixelSeasonMissionComplete(mission, counters) ? mission.points : 0),
    0,
  )
}

export function getPixelSeasonTier(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0
  return Math.min(PIXEL_SEASON_TIER_COUNT, Math.floor(points / PIXEL_SEASON_POINTS_PER_TIER))
}

export function getPixelSeasonTierThreshold(tier: number): number {
  if (!Number.isInteger(tier) || tier <= 0) return 0
  return Math.min(PIXEL_SEASON_MAX_POINTS, tier * PIXEL_SEASON_POINTS_PER_TIER)
}

export function getPixelSeasonProgressPct(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0
  if (points >= PIXEL_SEASON_MAX_POINTS) return 100
  return Math.round((points / PIXEL_SEASON_MAX_POINTS) * 1000) / 10
}

export function getPixelSeasonPointsToNextTier(points: number): number {
  const tier = getPixelSeasonTier(points)
  if (tier >= PIXEL_SEASON_TIER_COUNT) return 0
  return getPixelSeasonTierThreshold(tier + 1) - Math.max(0, points)
}

export function getPixelSeasonFreeReward(tier: number): PixelSeasonFreeReward | undefined {
  return PIXEL_SEASON_FREE_REWARDS.find((reward) => reward.tier === tier)
}

export function getPixelSeasonPremiumReward(tier: number): PixelSeasonPremiumReward | undefined {
  return PIXEL_SEASON_PREMIUM_REWARDS.find((reward) => reward.tier === tier)
}

export function getClaimableFreeTiers(points: number, claimed: number[]): number[] {
  const tier = getPixelSeasonTier(points)
  return PIXEL_SEASON_FREE_REWARDS
    .filter((reward) => reward.tier <= tier && !claimed.includes(reward.tier))
    .map((reward) => reward.tier)
}

export function getClaimablePremiumTiers(points: number, claimed: number[], premiumUnlocked: boolean): number[] {
  if (!premiumUnlocked) return []
  const tier = getPixelSeasonTier(points)
  return PIXEL_SEASON_PREMIUM_REWARDS
    .filter((reward) => reward.tier <= tier && !claimed.includes(reward.tier))
    .map((reward) => reward.tier)
}

export function buildPixelSeasonLeaderboard(
  seasonId: string,
  playerName: string,
  points: number,
): PixelSeasonLeaderboardEntry[] {
  const rivals: PixelSeasonLeaderboardEntry[] = RIVAL_NAMES.map((name) => ({
    rank: 0,
    name,
    points: Math.min(3200, 600 + (hashString(`${seasonId}:${name}`) % 2600)),
    isPlayer: false,
  }))
  const entries: PixelSeasonLeaderboardEntry[] = [
    ...rivals,
    { rank: 0, name: playerName || 'YOU', points: Math.max(0, points), isPlayer: true },
  ]
  entries.sort((a, b) => (b.points - a.points) || a.name.localeCompare(b.name))
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }))
}
