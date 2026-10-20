/**
 * Anonymous player telemetry (#1230, part 2).
 *
 * Goal: measure real retention (D1/D7), real purchase behaviour and the level
 * where players actually stall — the QA bot is a smoke test, not an audience.
 *
 * Privacy rules (non-negotiable):
 *  - no PII: no character name, no IP, no user agent, no free text;
 *  - a random install id in localStorage is the only identifier, and it is
 *    deleted the moment the player turns the toggle off;
 *  - events are allow-listed client- and server-side; this module can only
 *    send the seven names below and flat primitive props.
 *
 * The module is inert outside production builds (and in tests) unless
 * VITE_TELEMETRY=1 is set, so `npm run dev` never pollutes the dataset.
 */

export const TELEMETRY_EVENTS = [
  'session_start',
  'session_end',
  'level_up',
  'lootbox_opened',
  'purchase',
  'boss_attempt',
  'wall_reached',
] as const

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[number]

type PropValue = string | number | boolean
export type TelemetryProps = Record<string, PropValue>

export type TelemetryTransport = (url: string, body: string, beacon: boolean) => void

const STORAGE_KEY = 'bitbrawler_telemetry_v1'
const ENDPOINT = '/api/telemetry'
const MAX_PROPS = 8
const MAX_STRING_LENGTH = 48
const MAX_WALL_LEVELS = 12
/** Consecutive losses at the same level before it counts as a wall. */
export const WALL_LOSS_STREAK = 3

interface TelemetryState {
  enabled: boolean
  installId: string | null
  firstSeen: number | null
  lastSeen: number | null
  /** Levels already reported as a wall, so one stall is emitted once. */
  walls: number[]
}

const DEFAULT_STATE: TelemetryState = {
  enabled: true,
  installId: null,
  firstSeen: null,
  lastSeen: null,
  walls: [],
}

let sessionStarted = false
let sessionStart = 0
let sessionEndSent = false
let currentLevel: number | null = null
let unloadHookInstalled = false
let unloadHandler: (() => void) | null = null
let availableOverride: boolean | null = null
let transport: TelemetryTransport = defaultTransport

/** Injected in unit tests; `null` restores the production switch. */
export function __setTelemetryAvailableForTests(value: boolean | null): void {
  availableOverride = value
}

/** Injected in unit tests to capture payloads without touching the network. */
export function __setTelemetryTransport(next: TelemetryTransport | null): void {
  transport = next ?? defaultTransport
}

/** Clears the in-memory session (localStorage is left to the caller). */
export function __resetTelemetrySessionForTests(): void {
  if (unloadHandler !== null && typeof window !== 'undefined') {
    window.removeEventListener('pagehide', unloadHandler)
  }
  unloadHandler = null
  sessionStarted = false
  sessionStart = 0
  sessionEndSent = false
  currentLevel = null
  unloadHookInstalled = false
  availableOverride = null
  transport = defaultTransport
}

const isAutomation = (): boolean =>
  typeof navigator !== 'undefined' && navigator.webdriver === true

const isAvailable = (): boolean => {
  // The QA bot is a Playwright browser: counting its daily runs as a player
  // would make D1/D7 look perfect. Automation never reports.
  if (isAutomation()) return false
  if (availableOverride !== null) return availableOverride
  if (typeof import.meta === 'undefined') return false
  const env = import.meta.env as Record<string, unknown> | undefined
  return env?.PROD === true || env?.VITE_TELEMETRY === '1'
}

const hasStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function readState(): TelemetryState {
  if (!hasStorage()) return { ...DEFAULT_STATE }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw) as Partial<TelemetryState>
    return {
      enabled: parsed.enabled !== false,
      installId: typeof parsed.installId === 'string' ? parsed.installId : null,
      firstSeen: typeof parsed.firstSeen === 'number' ? parsed.firstSeen : null,
      lastSeen: typeof parsed.lastSeen === 'number' ? parsed.lastSeen : null,
      walls: Array.isArray(parsed.walls)
        ? parsed.walls.filter((level): level is number => Number.isInteger(level) && level > 0)
        : [],
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function writeState(state: TelemetryState): void {
  if (!hasStorage()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked (private mode): telemetry silently degrades to
    // no-op rather than breaking the game.
  }
}

function generateInstallId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // RFC 4122 v4 fallback for runtimes without randomUUID.
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-'
    } else if (i === 14) {
      out += '4'
    } else if (i === 19) {
      out += hex[(Math.random() * 4 | 0) + 8]
    } else {
      out += hex[Math.random() * 16 | 0]
    }
  }
  return out
}

function defaultTransport(url: string, body: string, beacon: boolean): void {
  try {
    if (beacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      if (sent) return
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: beacon,
    }).catch(() => {
      // Best effort: telemetry must never surface an error to the player.
    })
  } catch {
    // Same contract for synchronous failures (blob/sendBeacon unavailable).
  }
}

function sanitizeProps(props: TelemetryProps | undefined): TelemetryProps {
  const out: TelemetryProps = {}
  if (!props) return out
  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(out).length >= MAX_PROPS) break
    if (!/^[a-z][a-z0-9_]{0,23}$/.test(key)) continue
    if (typeof value === 'string') {
      if (value.length > 0) out[key] = value.slice(0, MAX_STRING_LENGTH)
    } else if (typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = value
    } else if (typeof value === 'boolean') {
      out[key] = value
    }
  }
  return out
}

function send(event: TelemetryEventName, props?: TelemetryProps, beacon = false): void {
  const state = readState()
  if (!state.installId) return
  const payload: Record<string, unknown> = {
    install_id: state.installId,
    event,
    props: sanitizeProps(props),
  }
  if (currentLevel !== null) payload.level = currentLevel
  transport(ENDPOINT, JSON.stringify(payload), beacon)
}

function installUnloadHook(): void {
  if (unloadHookInstalled || typeof window === 'undefined') return
  unloadHookInstalled = true
  unloadHandler = () => {
    if (!sessionStarted || sessionEndSent) return
    sessionEndSent = true
    send('session_end', { duration_s: Math.max(0, Math.round((Date.now() - sessionStart) / 1000)) }, true)
  }
  window.addEventListener('pagehide', unloadHandler, { once: true })
}

/** True when telemetry is available on this build AND the player allows it. */
export function isTelemetryEnabled(): boolean {
  return isAvailable() && readState().enabled
}

/**
 * Stored opt-in preference, independent of the build switch. The Settings
 * toggle must show what the player chose even in dev builds where nothing is
 * sent (VITE_TELEMETRY unset).
 */
export function getTelemetryPreference(): boolean {
  return readState().enabled
}

/**
 * Opt-out switch (Settings). Turning it off deletes the install id, the
 * first/last-seen timestamps and the wall history: the next opt-in starts a
 * brand-new anonymous install, it cannot be linked to the previous one.
 */
export function setTelemetryEnabled(enabled: boolean): void {
  const state = readState()
  state.enabled = enabled
  if (!enabled) {
    state.installId = null
    state.firstSeen = null
    state.lastSeen = null
    state.walls = []
  }
  writeState(state)
  // Either direction starts a fresh session: opt-out stops the current one
  // immediately, opt-in creates a brand-new install id on the next event.
  sessionStarted = false
  sessionEndSent = false
}

/** Level attached to every subsequent event (helps churn/wall analysis). */
export function setTelemetryLevel(level: number | null | undefined): void {
  currentLevel = typeof level === 'number' && Number.isFinite(level) && level > 0
    ? Math.round(level)
    : null
}

/**
 * Starts the session once per page load: creates the install id on first ever
 * run, records `session_start` with the hours since the previous session.
 */
export function initTelemetry(options?: { level?: number | null }): void {
  if (sessionStarted || !isTelemetryEnabled()) return
  if (options?.level !== undefined && options.level !== null) {
    setTelemetryLevel(options.level)
  }

  const state = readState()
  const now = Date.now()
  const firstSession = state.firstSeen === null
  const elapsedHours = !firstSession && state.lastSeen !== null
    ? Math.round(((now - state.lastSeen) / 3_600_000) * 10) / 10
    : null

  state.installId = state.installId ?? generateInstallId()
  state.firstSeen = state.firstSeen ?? now
  state.lastSeen = now
  writeState(state)

  sessionStarted = true
  sessionStart = now
  sessionEndSent = false
  installUnloadHook()

  send('session_start', {
    first_session: firstSession,
    ...(elapsedHours !== null ? { return_after_hours: elapsedHours } : {}),
  })
}

/**
 * Sends one allow-listed event. No-ops before `initTelemetry`, when the player
 * opted out, and outside production builds.
 */
export function trackEvent(event: TelemetryEventName, props?: TelemetryProps): void {
  if (!isTelemetryEnabled()) return
  if (!sessionStarted) {
    initTelemetry()
    if (!sessionStarted) return
  }
  if (!TELEMETRY_EVENTS.includes(event)) return
  send(event, props)
}

/**
 * Reports a stall once per level: three consecutive losses without a level-up.
 * `consecutiveLosses` comes from the fight history the game already keeps.
 */
export function trackFightOutcome(won: boolean, level: number, consecutiveLosses: number): void {
  if (won || consecutiveLosses < WALL_LOSS_STREAK) return
  if (!isTelemetryEnabled()) return
  const state = readState()
  if (state.walls.includes(level)) return
  state.walls = [...state.walls, level].slice(-MAX_WALL_LEVELS)
  writeState(state)
  // Carry the level explicitly: the wall must not depend on the ambient
  // currentLevel (offline/idle merges can move it between events).
  trackEvent('wall_reached', { losses: consecutiveLosses, level })
}

/** Exposed for the report/tests: the local install id, if telemetry ran. */
export function getTelemetryInstallId(): string | null {
  return readState().installId
}

export { STORAGE_KEY as TELEMETRY_STORAGE_KEY }
