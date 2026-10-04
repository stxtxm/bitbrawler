import type { IncomingMessage, ServerResponse } from 'http'
import handler from '../../api/idle-processor'

// Netlify Functions v2 accepts the Node http request/response pair, so the
// existing Vercel handler is reused verbatim instead of being ported.
// `config.path` keeps the public URL identical to the old Vercel route, which
// means the client fetch('/api/idle-processor') needs no change.
// The cast pins the signature: it fails the build if the core handler is ever
// refactored to a Web-standard (Request -> Response) handler.
export const config = { path: '/api/idle-processor' }

export default handler as (req: IncomingMessage, res: ServerResponse) => Promise<void>