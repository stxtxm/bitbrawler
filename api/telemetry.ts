/**
 * /api/telemetry — anonymous retention telemetry (#1230, part 2).
 *
 * Web-standard handler shared by the Cloudflare Pages Function
 * (`functions/api/telemetry.ts`) and the unit tests. It stores one row per
 * event in `telemetry_events` with the service role key; the table is NOT
 * readable by the anon key (RLS enabled, no policies).
 *
 * Deploy-before-migrate contract: when the table does not exist yet, the
 * endpoint answers 202 `{ stored:false, reason:'migration_pending' }` instead
 * of failing loudly. The game keeps working and the rows start flowing the
 * moment the migration is executed.
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

type StoredProp = string | number | boolean

export interface TelemetryRow {
  install_id: string
  event: TelemetryEventName
  level?: number
  props: Record<string, StoredProp>
}

export interface TelemetryEnv {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

const MAX_BODY_BYTES = 2048
const MAX_PROPS = 8
const MAX_PROP_STRING = 64
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROP_KEY_RE = /^[a-z][a-z0-9_]{0,23}$/

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const isEventName = (value: string): value is TelemetryEventName =>
  (TELEMETRY_EVENTS as readonly string[]).includes(value)

function sanitizeProps(raw: unknown): Record<string, StoredProp> | null {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const entries = Object.entries(raw as Record<string, unknown>)
  if (entries.length > MAX_PROPS) return null
  const out: Record<string, StoredProp> = {}
  for (const [key, value] of entries) {
    if (!PROP_KEY_RE.test(key)) return null
    if (typeof value === 'string') {
      if (value.length > MAX_PROP_STRING) return null
      out[key] = value
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null
      out[key] = value
    } else if (typeof value === 'boolean') {
      out[key] = value
    } else {
      return null
    }
  }
  return out
}

export type ValidationResult =
  | { ok: true; row: TelemetryRow }
  | { ok: false; status: number; error: string }

/** Pure validation, exported so the allow-list is testable on its own. */
export function validateTelemetryPayload(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, status: 400, error: 'invalid payload' }
  }
  const body = input as Record<string, unknown>

  if (typeof body.install_id !== 'string' || !UUID_RE.test(body.install_id)) {
    return { ok: false, status: 400, error: 'invalid install_id' }
  }
  if (typeof body.event !== 'string' || !isEventName(body.event)) {
    return { ok: false, status: 422, error: 'unknown event' }
  }

  let level: number | undefined
  if (body.level !== undefined && body.level !== null) {
    if (typeof body.level !== 'number' || !Number.isInteger(body.level) || body.level < 1 || body.level > 999) {
      return { ok: false, status: 400, error: 'invalid level' }
    }
    level = body.level
  }

  const props = sanitizeProps(body.props)
  if (props === null) {
    return { ok: false, status: 400, error: 'invalid props' }
  }

  return {
    ok: true,
    row: {
      install_id: body.install_id.toLowerCase(),
      event: body.event,
      ...(level !== undefined ? { level } : {}),
      props,
    },
  }
}

/**
 * Stores one validated event. Every response is best effort: telemetry must
 * never make the game fail, so storage errors are reported to the caller but
 * never thrown.
 */
export async function storeTelemetry(
  row: TelemetryRow,
  env: TelemetryEnv,
): Promise<Response> {
  const missing = (['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const).filter(
    (key) => !env[key],
  )
  if (missing.length > 0) {
    return json(503, { error: 'missing_env', missing })
  }

  const baseUrl = (env.SUPABASE_URL as string).replace(/\/+$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY as string

  let response: Response
  try {
    response = await fetch(`${baseUrl}/rest/v1/telemetry_events`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    })
  } catch {
    return json(502, { error: 'storage_unreachable' })
  }

  if (response.ok) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })

  const detail = await response.text().catch(() => '')
  // PostgREST answers PGRST205 (or a plain 404) when the table is absent.
  // Expected until the migration issue is executed: accept and drop the row.
  if (response.status === 404 || detail.includes('PGRST205')) {
    return json(202, { stored: false, reason: 'migration_pending' })
  }
  return json(502, {
    error: 'storage_failed',
    status: response.status,
    detail: detail.slice(0, 200),
  })
}

export async function handleTelemetry(
  request: Request,
  env: TelemetryEnv = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    })
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(413, { error: 'payload too large' })
  }

  let text: string
  try {
    text = await request.text()
  } catch {
    return json(400, { error: 'unreadable body' })
  }
  if (text.length > MAX_BODY_BYTES) {
    return json(413, { error: 'payload too large' })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return json(400, { error: 'invalid json' })
  }

  const validated = validateTelemetryPayload(parsed)
  if (!validated.ok) {
    return json(validated.status, { error: validated.error })
  }

  return storeTelemetry(validated.row, env)
}
