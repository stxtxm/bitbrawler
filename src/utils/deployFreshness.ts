/**
 * Deploy freshness probe (issue #1228).
 *
 * Production served a bundle older than master for days without anything
 * noticing: the site answered HTTP 200, the QA runs were green, no error
 * anywhere — only the *content* of the JS bundle betrayed the gap (old shop
 * prices, no recent render markers). This module compares markers that exist in
 * the source against the bundle the live site actually serves, so the drift can
 * no longer stay silent.
 *
 * The markers are plain string literals, so they survive minification:
 *   - `SPRITE_RENDER_REV` (code revision, bumped on sprite-rendering changes)
 *   - every `SHOP_OFFERS` price (`price:30`, …) baked into the bundle
 *
 * The app is code-split, so a marker can live outside `assets/index-*.js`:
 * after the git integration was reconnected (2026-10-19) production served the
 * newest revision — PvP fix included — but only inside `assets/SpriteCanvas-*.js`.
 * Scanning the entry bundle alone therefore called a perfectly fresh production
 * « stale ». The probe concatenates the entry bundle with its referenced chunks.
 *
 * Pure helpers only — the CLI shell lives in `scripts/check-deploy-freshness.ts`.
 */

export const STALE_LABEL = 'deploy-stale'
export const STALE_TITLE_PREFIX = '🔴 Prod stale'

export interface DeployMarkers {
  /** `SPRITE_RENDER_REV` value, or null when the source has no marker. */
  rev: string | null
  /** Every shop price, as it appears in the minified bundle (`price:30`). */
  prices: string[]
}

export interface DeployVerdict {
  fresh: boolean
  missing: string[]
}

export interface DeployIssueRef {
  number: number
  title?: string
  labels?: Array<string | { name?: string }>
}

/** Extracts the expected bundle markers from the raw source files. */
export function parseExpectedMarkers(revSource: string, offersSource: string): DeployMarkers {
  const rev = revSource.match(/SPRITE_RENDER_REV\s*=\s*'([^']+)'/)?.[1] ?? null
  const prices = [...offersSource.matchAll(/price:\s*(\d+)/g)].map((match) => `price:${match[1]}`)
  return { rev, prices }
}

/** Path of the JS bundle referenced by the served index.html. */
export function assetPathOf(html: string): string | null {
  return html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? null
}

/**
 * JS assets referenced by the entry bundle — its code-split chunks.
 *
 * Markers can live in a lazy chunk (`assets/SpriteCanvas-*.js` carries
 * `SPRITE_RENDER_REV` and the PvP flip), so a probe that reads only the entry
 * bundle reports « stale » on a fresh production. Returns unique paths, entry
 * excluded.
 */
export function extractReferencedAssets(bundleText: string, entryPath?: string | null): string[] {
  const referenced = bundleText.match(/assets\/[A-Za-z0-9_.-]+\.js/g) ?? []
  const unique = [...new Set(referenced)]
  return entryPath ? unique.filter((path) => path !== entryPath) : unique
}

/**
 * Which expected markers are missing from the served bundle? An empty `missing`
 * list means production ships everything this commit contains.
 */
export function assessFreshness(bundleText: string, markers: DeployMarkers): DeployVerdict {
  const missing: string[] = []
  if (markers.rev && !bundleText.includes(markers.rev)) missing.push(markers.rev)
  for (const price of markers.prices) {
    if (!bundleText.includes(price)) missing.push(price)
  }
  return { fresh: missing.length === 0, missing }
}

/**
 * Finds the tracking issue among open issues.
 *
 * Deliberately does NOT use GitHub's label *search* index: it lags a few
 * seconds behind a fresh `issue edit`, which made the probe create a duplicate
 * issue on 2026-10-18 (the label had just been applied, the search returned
 * nothing). Callers pass a plain list of open issues instead.
 */
export function pickTrackingIssue(
  issues: DeployIssueRef[] | null | undefined,
  label = STALE_LABEL,
  titlePrefix = STALE_TITLE_PREFIX,
): string | null {
  const hit = (issues ?? []).find((issue) => {
    const labels = (issue.labels ?? []).map((entry) => (typeof entry === 'string' ? entry : entry?.name))
    return labels.includes(label) || String(issue.title ?? '').startsWith(titlePrefix)
  })
  return hit ? String(hit.number) : null
}

/** Body of the tracking issue opened while production is behind. */
export function buildStaleIssueBody(params: {
  url: string
  assetPath: string
  markers: DeployMarkers
  missing: string[]
}): string {
  const { url, assetPath, markers, missing } = params
  return [
    `# 🔴 Production stale — le bundle live n'est pas celui de master`,
    ``,
    `Détecté automatiquement par \`scripts/check-deploy-freshness.ts\` (watchdog horaire).`,
    ``,
    `- site : ${url}`,
    `- bundle servi : \`${assetPath}\``,
    `- marqueurs absents (donc jamais buildés) : ${missing.map((marker) => `\`${marker}\``).join(', ')}`,
    `- marqueurs attendus : \`${markers.rev ?? '-'}\`, ${markers.prices.map((price) => `\`${price}\``).join(', ')}`,
    ``,
    `## Ce que ça veut dire`,
    ``,
    `Le dernier déploiement **Production** de Cloudflare Pages est antérieur aux commits qui`,
    `introduisent ces marqueurs : aucun merge récent n'est visible des joueurs, sans aucune`,
    `erreur apparente (HTTP 200, QA verte, aucun crash).`,
    ``,
    `## Vérifications dashboard (humain)`,
    ``,
    `1. Pages → **bitbrawler** → *Deployments* : date du dernier déploiement **Production**.`,
    `2. *Settings → Builds & deployments* : la *Production branch* est-elle \`master\` ? Les`,
    `   *automatic production deployments* sont-ils activés ?`,
    `3. Dernier build : a-t-il échoué (erreur de build, quota de build, compte en pause) ?`,
    `4. Déploiement manuel possible : \`npm run build && npx wrangler pages deploy dist --project-name bitbrawler\``,
    ``,
    `Ce ticket se ferme tout seul dès que la prod sert à nouveau les marqueurs de master.`,
  ].join('\n')
}
