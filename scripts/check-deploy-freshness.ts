/**
 * CLI shell for the deploy freshness probe (issue #1228).
 *
 *   npx tsx scripts/check-deploy-freshness.ts            # rapport, exit 0/1/2
 *   npx tsx scripts/check-deploy-freshness.ts --json     # sortie machine
 *   npx tsx scripts/check-deploy-freshness.ts --issue    # ouvre/ferme le ticket
 *
 * Exit codes: 0 = fresh (ou mode --issue), 1 = stale, 2 = sonde impossible.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STALE_LABEL,
  assessFreshness,
  assetPathOf,
  buildStaleIssueBody,
  extractReferencedAssets,
  parseExpectedMarkers,
  pickTrackingIssue,
  type DeployMarkers,
} from '../src/utils/deployFreshness';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SITE = 'https://bitbrawler.pages.dev';

const REV_SOURCE = 'src/components/sprite/PixelGridCanvas.tsx';
const OFFERS_SOURCE = 'src/data/shopConstants.ts';

function expectedMarkers(): DeployMarkers {
  return parseExpectedMarkers(
    readFileSync(resolve(ROOT, REV_SOURCE), 'utf8'),
    readFileSync(resolve(ROOT, OFFERS_SOURCE), 'utf8'),
  );
}

function gh(args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf8', cwd: ROOT }).trim();
}

function ghOk(args: string[]): string {
  try {
    return gh(args);
  } catch {
    return '';
  }
}

function findTrackingIssue(): string | null {
  const raw = ghOk(['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,labels']);
  if (!raw) return null;
  try {
    return pickTrackingIssue(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Opens the tracking issue while stale, closes it once production catches up. */
function syncIssue(params: { fresh: boolean; missing: string[]; assetPath: string; url: string; markers: DeployMarkers }): void {
  const { fresh, missing, assetPath, url, markers } = params;
  const openIssue = findTrackingIssue();

  if (fresh) {
    if (openIssue) {
      gh(['issue', 'comment', openIssue, '--body', `✅ Production rattrapée : le bundle \`${assetPath}\` contient tous les marqueurs de master. Fermeture automatique (garde-fou de fraîcheur, #1228).`]);
      gh(['issue', 'close', openIssue, '--reason', 'completed']);
      console.log(`✓ issue #${openIssue} fermée (prod à jour)`);
    }
    return;
  }

  if (openIssue) {
    console.log(`↷ issue #${openIssue} déjà ouverte — pas de doublon`);
    return;
  }

  ghOk(['label', 'create', STALE_LABEL, '--color', 'b60205', '--description', 'Production sert un build plus ancien que master']);
  const created = gh([
    'issue', 'create',
    '--title', '🔴 Prod stale — le bundle live ne contient pas les marqueurs de master',
    '--label', STALE_LABEL,
    '--body', buildStaleIssueBody({ url, assetPath, markers, missing }),
  ]);
  console.log(`🚨 issue créée : ${created}`);
}

/** Budget de chunks scannés : borne les fetches d'un run horaire. */
const MAX_CHUNKS = 40

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

async function probe(url: string): Promise<{ assetPath: string; bundleText: string; chunkCount: number }> {
  const base = url.replace(/\/$/, '');
  const html = await fetchText(url);
  const assetPath = assetPathOf(html);
  if (!assetPath) throw new Error('aucun assets/index-*.js référencé par index.html');

  const entryText = await fetchText(`${base}/${assetPath}`);

  // L'app est code-split : les marqueurs les plus récents peuvent vivre dans un
  // chunk (`assets/SpriteCanvas-*.js` pour SPRITE_RENDER_REV et le flip PvP du
  // combat). Ne lire que le bundle d'entrée faisait crier « stale » sur une prod
  // parfaitement à jour (constaté le 19/10 à la reconnexion du git). Un chunk
  // illisible n'invalide pas la sonde : il peut avoir été purgé entre deux
  // déploiements.
  const chunkPaths = extractReferencedAssets(entryText, assetPath).slice(0, MAX_CHUNKS);
  const chunkTexts: string[] = [];
  const queue = [...chunkPaths];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    for (;;) {
      const path = queue.shift();
      if (!path) return;
      try {
        chunkTexts.push(await fetchText(`${base}/${path}`));
      } catch (error) {
        console.warn(`   ⚠️ chunk illisible : ${path} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  });
  await Promise.all(workers);

  return { assetPath, bundleText: [entryText, ...chunkTexts].join('\n'), chunkCount: chunkPaths.length };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const url = process.env.QA_BASE_URL || DEFAULT_SITE;
  const markers = expectedMarkers();

  console.log(`🔍 Fraîcheur déploiement — ${url}`);
  console.log(`   marqueurs attendus : rev=${markers.rev}, ${markers.prices.join(' ')}`);

  let assetPath: string;
  let chunkCount = 0;
  let verdict: ReturnType<typeof assessFreshness>;
  try {
    const probed = await probe(url);
    assetPath = probed.assetPath;
    chunkCount = probed.chunkCount;
    verdict = assessFreshness(probed.bundleText, markers);
  } catch (error) {
    console.error(`⚠️ Sonde impossible : ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }

  console.log(`   bundle servi : ${assetPath} (+ ${chunkCount} chunk(s) scanné(s))`);
  if (verdict.fresh) {
    console.log('✅ Prod à jour : tous les marqueurs de master sont présents.');
  } else {
    console.log(`❌ Prod STALE — marqueurs absents : ${verdict.missing.join(', ')}`);
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify({ url, assetPath, chunks: chunkCount, ...verdict, markers }, null, 2));
  }
  if (args.includes('--issue')) {
    // Le ticket EST le signal : on ne fait pas échouer le run du watchdog,
    // sinon chaque passage horaire afficherait un run rouge en plus du ticket.
    syncIssue({ ...verdict, assetPath, url, markers });
    process.exit(0);
  }

  process.exit(verdict.fresh ? 0 : 1);
}

void main();
