import { runIdleProcessor, type HandlerEnv } from '../../api/runIdleProcessor'

// Minimal shape of the Cloudflare Pages handler context. Declared locally
// instead of importing @cloudflare/workers-types so the repo keeps zero
// hosting-specific devDependencies.
interface PagesContext {
  request: Request;
  env: HandlerEnv;
}

// Cloudflare Pages Function for /api/idle-processor.
//
// The public path is dictated by the file location:
// functions/api/idle-processor.ts is served at /api/idle-processor, which is
// what the client and cron-job.org already call. No URL change, no client
// change.
//
// Credentials arrive as bindings on the handler context rather than through
// process.env. runIdleProcessor() bridges that, so the idle maths stays
// single-sourced and its unit tests still cover the real logic.
const handle = ({ request, env }: PagesContext): Promise<Response> =>
  runIdleProcessor(request, env)

export const onRequest = handle
export const onRequestPost = handle
export const onRequestGet = handle