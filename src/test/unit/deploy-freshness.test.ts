import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STALE_LABEL,
  assessFreshness,
  assetPathOf,
  buildStaleIssueBody,
  extractReferencedAssets,
  parseExpectedMarkers,
  pickTrackingIssue,
} from '../../utils/deployFreshness';

const readSource = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('Fraîcheur du déploiement — sonde de production (#1228)', () => {
  // Incident : la prod a servi pendant des jours un bundle antérieur à master
  // (prix shop 24/48/41/73 au lieu de 27/53/45/80) sans AUCUN signal — HTTP 200,
  // QA verte, aucun crash. Seul le contenu du bundle trahissait le décalage.
  // Ces garde-fous garantissent que la sonde détecte ce cas exact.

  it('extrait les marqueurs réels du dépôt (rev + prix shop)', () => {
    const markers = parseExpectedMarkers(
      readSource('src/components/sprite/PixelGridCanvas.tsx'),
      readSource('src/data/shopConstants.ts'),
    );

    // La rev est bumpée à chaque changement de rendu : on vérifie la forme,
    // pas la valeur, pour ne pas casser le test à chaque bump.
    expect(markers.rev).toMatch(/^r[0-9]+[a-z0-9-]*$/i);
    expect(markers.prices).toHaveLength(4);
    for (const price of markers.prices) {
      expect(price).toMatch(/^price:[0-9]+$/);
    }
  });

  it('lit le chemin du bundle dans index.html', () => {
    const html = '<!doctype html><html><head><script type="module" crossorigin src="/assets/index-Cwvpqp-q.js"></script></head></html>';
    expect(assetPathOf(html)).toBe('assets/index-Cwvpqp-q.js');
    expect(assetPathOf('<html><body>pas de bundle</body></html>')).toBeNull();
  });

  it('considère la prod stale quand le bundle servi est celui d\'avant #1182', () => {
    const markers = { rev: 'r1150-cloudflare-live', prices: ['price:27', 'price:53', 'price:45', 'price:80'] };
    // Bundle réellement servi par bitbrawler.pages.dev le 2026-10-18.
    const staleBundle = 'const o=[{price:24,label:"Marchandise"},{price:48},{price:41},{price:73}];';

    const verdict = assessFreshness(staleBundle, markers);

    expect(verdict.fresh).toBe(false);
    expect(verdict.missing).toContain('price:27');
    expect(verdict.missing).toHaveLength(5);
  });

  it('valide une prod qui contient tous les marqueurs', () => {
    const markers = { rev: 'r1150-cloudflare-live', prices: ['price:27', 'price:53', 'price:45', 'price:80'] };
    const freshBundle = 'data-render-rev:"r1150-cloudflare-live",price:27,price:53,price:45,price:80';

    expect(assessFreshness(freshBundle, markers)).toEqual({ fresh: true, missing: [] });
  });

  it('détecte le cas limite : seul le marqueur de rev manque', () => {
    const markers = { rev: 'r9999-next-sprite-rev', prices: ['price:27'] };

    const verdict = assessFreshness('price:27 et rien d\'autre', markers);

    expect(verdict.fresh).toBe(false);
    expect(verdict.missing).toEqual(['r9999-next-sprite-rev']);
  });

  describe('scanne aussi les chunks code-split (incident du 19/10)', () => {
    // Le 19/10, à la reconnexion du git Cloudflare, la prod servait bien le fix
    // PvP et `r1150-cloudflare-live` — mais dans `assets/SpriteCanvas-*.js`.
    // Une sonde limitée au bundle d'entrée aurait crié « stale » indéfiniment
    // sur une prod parfaitement à jour.
    const entryBundle = 'const p=["assets/index-C1-O-J2W.js","assets/Arena-BIxOxmbE.js","assets/SpriteCanvas-HJ88hZjZ.js","assets/Arena-BIxOxmbE.js","assets/index-C1-O-J2W.css","assets/react-CEw6DVI2.js"];SHOP=[{price:27},{price:53},{price:45},{price:80}];';
    const spriteChunk = 'data-render-rev:"r1150-cloudflare-live",flip:"on",data-flip:"on";';

    it('extrait les chunks référencés — sans doublon, sans CSS, sans l\'entrée', () => {
      expect(extractReferencedAssets(entryBundle, 'assets/index-C1-O-J2W.js')).toEqual([
        'assets/Arena-BIxOxmbE.js',
        'assets/SpriteCanvas-HJ88hZjZ.js',
        'assets/react-CEw6DVI2.js',
      ]);
      expect(extractReferencedAssets('pas de chunks ici')).toEqual([]);
    });

    it('l\'entrée seule est déclarée stale, entrée + chunks est fraîche', () => {
      const markers = { rev: 'r1150-cloudflare-live', prices: ['price:27', 'price:53', 'price:45', 'price:80'] };

      // Reproduit le faux positif : les prix sont dans l'entrée, la rev non.
      expect(assessFreshness(entryBundle, markers)).toEqual({ fresh: false, missing: ['r1150-cloudflare-live'] });
      expect(assessFreshness([entryBundle, spriteChunk].join('\n'), markers)).toEqual({ fresh: true, missing: [] });
    });
  });

  describe('retrouve le ticket de suivi sans dépendre de l\'index de recherche', () => {
    // Le 2026-10-18, l'index de labels GitHub n'avait pas suivi un `issue edit`
    // frais : la recherche par label ne renvoyait rien et la sonde a créé un
    // doublon. On filtre donc la liste des issues ouvertes côté client.
    const openIssues = [
      { number: 1200, title: 'Autre chose', labels: [{ name: 'bug' }] },
      { number: 1228, title: '🔴 Prod stale — bitbrawler.pages.dev sert un build antérieur', labels: [STALE_LABEL] },
    ];

    it('par label', () => {
      expect(pickTrackingIssue([openIssues[1]])).toBe('1228');
    });

    it('par préfixe de titre, même sans label', () => {
      expect(pickTrackingIssue([{ number: 1234, title: '🔴 Prod stale — doublon' }])).toBe('1234');
    });

    it('ignore les issues sans rapport', () => {
      expect(pickTrackingIssue([openIssues[0]])).toBeNull();
      expect(pickTrackingIssue(null)).toBeNull();
      expect(pickTrackingIssue([])).toBeNull();
    });

    it('tolère des labels en chaîne simple', () => {
      expect(pickTrackingIssue([{ number: 42, title: 'x', labels: [STALE_LABEL] }])).toBe('42');
    });
  });

  it('le corps du ticket embarque la checklist dashboard et les marqueurs absents', () => {
    const body = buildStaleIssueBody({
      url: 'https://bitbrawler.pages.dev',
      assetPath: 'assets/index-Cwvpqp-q.js',
      markers: { rev: 'r1150-cloudflare-live', prices: ['price:27'] },
      missing: ['r1150-cloudflare-live', 'price:27'],
    });

    expect(body).toContain('assets/index-Cwvpqp-q.js');
    expect(body).toContain('`price:27`');
    expect(body).toContain('wrangler pages deploy dist');
    expect(body).toContain('automatic production deployments');
  });
});
