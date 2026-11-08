// Cloudflare Pages Function: /api/agent-key?provider=<openrouter|zai>
//
// OIDC broker for agent model credentials. GitHub Actions workflows
// authenticate with a GitHub-issued OIDC ID token (audience: bitbrawler-agents).
// After verifying the token and the repository claim, the function returns the
// requested provider API key stored as a Cloudflare Pages secret.
//
// Supported providers (env secret name):
//   openrouter -> OPENROUTER_API_KEY  (e.g. Nemotron via OpenRouter)
//   zai        -> ZAI_API_KEY         (GLM via Z.AI)
//
// No GitHub secrets required: keys live only in Cloudflare environment vars.

interface PagesContext {
  request: Request
  env: { ZAI_API_KEY?: string; OPENROUTER_API_KEY?: string }
}

interface JWK {
  kid?: string
  kty: string
  n?: string
  e?: string
  alg?: string
  use?: string
}
interface JWKS { keys: JWK[] }
interface OIDCConfig { jwks_uri: string; issuer: string }

const GH_ISSUER = 'https://token.actions.githubusercontent.com'
const EXPECTED_AUD = 'bitbrawler-agents'
const EXPECTED_REPO = 'stxtxm/bitbrawler'
const OIDC_CONFIG_URL = `${GH_ISSUER}/.well-known/openid-configuration`

const PROVIDERS: Record<string, keyof PagesContext['env']> = {
  openrouter: 'OPENROUTER_API_KEY',
  zai: 'ZAI_API_KEY',
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function jsonPart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part))) as T
}

async function verify(token: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed JWT' }

  let header: { alg?: string; kid?: string }
  let payload: { iss?: string; aud?: string | string[]; exp?: number; repository?: string }
  try {
    header = jsonPart(parts[0])
    payload = jsonPart(parts[1])
  } catch {
    return { ok: false, reason: 'invalid JWT encoding' }
  }

  if (header.alg !== 'RS256') return { ok: false, reason: `unsupported alg ${header.alg}` }
  if (payload.iss !== GH_ISSUER) return { ok: false, reason: 'bad issuer' }
  const aud = payload.aud
  const audOk = aud === EXPECTED_AUD || (Array.isArray(aud) && aud.includes(EXPECTED_AUD))
  if (!audOk) return { ok: false, reason: 'bad audience' }
  if (payload.repository !== EXPECTED_REPO) return { ok: false, reason: `bad repository ${payload.repository ?? ''}` }
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp < now - 60) return { ok: false, reason: 'token expired' }

  const cfgRes = await fetch(OIDC_CONFIG_URL)
  if (!cfgRes.ok) return { ok: false, reason: 'cannot fetch OIDC config' }
  const cfg = (await cfgRes.json()) as OIDCConfig
  if (!cfg.jwks_uri || !cfg.jwks_uri.startsWith(GH_ISSUER)) return { ok: false, reason: 'invalid jwks_uri' }

  const jwksRes = await fetch(cfg.jwks_uri)
  if (!jwksRes.ok) return { ok: false, reason: 'cannot fetch JWKS' }
  const jwks = (await jwksRes.json()) as JWKS
  const jwk = jwks.keys.find((k) => k.kid === header.kid && k.kty === 'RSA')
  if (!jwk || !jwk.n || !jwk.e) return { ok: false, reason: 'matching JWK not found' }

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const sig = b64urlToBytes(parts[2])
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data)
  if (!valid) return { ok: false, reason: 'bad signature' }
  return { ok: true }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

const handle = async ({ request, env }: PagesContext): Promise<Response> => {
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const provider = (url.searchParams.get('provider') || '').toLowerCase()
  const envName = PROVIDERS[provider]
  if (!envName) return json({ error: 'unsupported provider', supported: Object.keys(PROVIDERS) }, 400)

  const key = env[envName]
  if (!key) return json({ error: `${envName} not configured on Cloudflare` }, 503)

  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'missing bearer token' }, 401)
  const token = auth.slice(7).trim()

  let result: { ok: true } | { ok: false; reason: string }
  try { result = await verify(token) } catch (e) { return json({ error: 'verification failed', detail: String(e) }, 401) }
  if (!result.ok) return json({ error: 'unauthorized', reason: result.reason }, 403)

  return json({ key })
}

export const onRequest = handle
