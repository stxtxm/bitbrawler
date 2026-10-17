import handler from './idle-processor'

/**
 * Shared Web-standard bridge for the idle processor.
 *
 * The core handler in `idle-processor.ts` is plain Node (`req.method`,
 * `req.on('data'|'end')`, `res.writeHead`, `res.end`) and reads its Supabase
 * credentials from `process.env`. Edge runtimes (Cloudflare Pages Functions)
 * speak the Web standard instead, so the host needs the same two shims:
 *
 *   1. Node req/res  <- Request / Response
 *   2. process.env   <- the host's env binding
 *
 * Both live here so the hosting adapter stays a thin one-file shim and the
 * idle maths remains single-sourced (and covered by one set of unit tests).
 */

interface ShimRequest {
  method: string;
  on(event: string, cb: (chunk?: Buffer) => void): void;
}

interface ShimResponse {
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string): void;
}

export interface HandlerEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export async function runIdleProcessor(
  req: Request,
  env: HandlerEnv = {},
): Promise<Response> {
  const payload =
    req.method === 'GET' || req.method === 'HEAD'
      ? Buffer.alloc(0)
      : Buffer.from(await req.arrayBuffer())

  let body = ''
  let status = 200
  let headers: Record<string, string> = {}

  const shimReq: ShimRequest = {
    method: req.method,
    on(event, cb) {
      if (event === 'data' && payload.length > 0) cb(payload)
      if (event === 'end') cb()
    },
  }
  const shimRes: ShimResponse = {
    writeHead(code, hdrs) {
      status = code
      headers = hdrs ?? {}
    },
    end(chunk) {
      body = chunk ?? ''
    },
  }

  // Cloudflare passes its bindings on the request context rather than through
  // process.env, so mirror them for the duration of the call. On hosts where
  // arguments are undefined and process.env already carries them.
  // Without nodejs_compat the Workers runtime has no `process` at all. Fail
  // with a readable message instead of Cloudflare's opaque "error code: 1101".
  const proc: Record<string, string | undefined> | null =
    typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : null
  if (!proc) {
    return new Response(
      JSON.stringify({ error: 'runtime missing process.env', fix: 'add compatibility_flags = ["nodejs_compat"] to wrangler.toml' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const saved: Record<string, string | undefined> = {}
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
    if (env[key] === undefined) continue
    saved[key] = proc[key]
    proc[key] = env[key]
  }

  try {
    await (handler as unknown as (r: ShimRequest, s: ShimResponse) => Promise<void>)(shimReq, shimRes)
  } catch (err) {
    // Without this, an unhandled throw becomes an opaque 502 from the runtime
    // with no trace of the cause — the exact shape of the failure that hid the
    // broken shim for hours. The core handler already answers its own failures,
    // so anything reaching here is an adapter-level bug.
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[idle-processor] unhandled:', err)
    return new Response(
      JSON.stringify({ error: 'Internal function error', detail }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  } finally {
    for (const key of Object.keys(saved) as Array<keyof typeof saved>) {
      if (saved[key] === undefined) delete proc[key]
      else proc[key] = saved[key]
    }
  }

  return new Response(body, { status, headers })
}