import { runIdleProcessor } from '../../api/runIdleProcessor'

// Netlify Functions v2 speaks the Web standard (Request -> Response). It does
// NOT hand over Node's http objects, so the Vercel-era handler cannot be
// exported as-is: it calls res.writeHead / res.end, which do not exist there.
// The shim lives in api/runIdleProcessor.ts, shared with the Cloudflare Pages
// adapter so the idle maths stays single-sourced.
export const config = { path: '/api/idle-processor' }

export default function idleProcessor(req: Request): Promise<Response> {
  return runIdleProcessor(req)
}