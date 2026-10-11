import handler from '../../api/idle-processor'

// Netlify Functions v2 speaks the Web standard (Request -> Response). It does
// NOT hand over Node's http objects, so the Vercel handler cannot be exported
// as-is: it calls res.writeHead / res.end, which do not exist there.
// The core handler only needs req.method, req.on('data'|'end'),
// res.writeHead and res.end, so it is driven through a minimal shim instead of
// being forked. That keeps the idle maths single-sourced, and its existing
// unit tests still cover the real logic.
export const config = { path: '/api/idle-processor' }

interface ShimRequest {
  method: string;
  on(event: string, cb: (chunk?: Buffer) => void): void;
}

interface ShimResponse {
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string): void;
}

export default async function idleProcessor(req: Request): Promise<Response> {
  const payload = req.method === 'GET' || req.method === 'HEAD'
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
  }

  return new Response(body, { status, headers })
}