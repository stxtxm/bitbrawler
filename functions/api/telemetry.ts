import { handleTelemetry, type TelemetryEnv } from '../../api/telemetry'

// Minimal shape of the Cloudflare Pages handler context, declared locally like
// the idle processor does (no hosting-specific devDependencies).
interface PagesContext {
  request: Request
  env: TelemetryEnv
}

// Cloudflare Pages Function for /api/telemetry.
//
// The public path comes from the file location. The handler is Web-standard
// (Request -> Response) on purpose: the Workers runtime has no Node `http`
// req/res, and a Node-shaped handler dies with an opaque "error code: 1101".
const handle = ({ request, env }: PagesContext): Promise<Response> =>
  handleTelemetry(request, env)

export const onRequest = handle
export const onRequestPost = handle
export const onRequestGet = handle
