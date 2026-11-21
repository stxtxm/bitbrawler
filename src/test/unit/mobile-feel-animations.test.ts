import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Garde-fous du « feeling mobile » : transitions de pages, modales
 * bottom-sheet, onglets d'inventaire et repli prefers-reduced-motion.
 *
 * jsdom ne résout pas les feuilles de style (getComputedStyle ne voit ni les
 * keyframes ni les transitions), on applique donc le pattern établi par
 * sprite-animations.test.ts : assertions sur la source SCSS.
 */

const ANIMATIONS = 'src/styles/base/_animations.scss';
const LAYOUT = 'src/styles/base/_layout.scss';
const CONTAINERS = 'src/styles/components/_containers.scss';
const INVENTORY = 'src/styles/pages/_arena-inventory.scss';

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

/** Extrait le bloc `sélecteur { ... }` le plus externe trouvé pour `needle`. */
function blockContaining(source: string, needle: string): string | null {
  const start = source.indexOf(needle);
  if (start < 0) return null;
  const open = source.indexOf('{', start);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/** Bloc SCSS équilibré démarrant par une déclaration de sélecteur exacte. */
function scssBlock(source: string, selector: string): string | null {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) return null;
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

describe('feeling mobile — animations et transitions', () => {
  it('définit les keyframes partagées pageEnter et modalSlideUp', () => {
    const source = read(ANIMATIONS);
    for (const name of ['pageEnter', 'modalSlideUp']) {
      expect(blockContaining(source, `@keyframes ${name}`)).not.toBeNull();
    }
  });

  it('anime l\'entrée des pages routées via .App > .container', () => {
    const layout = read(LAYOUT);
    expect(layout).toMatch(/\.App > \.container\s*\{[^}]*animation:\s*pageEnter/);
    // Une transition de page doit rester sous 400ms : au-delà, la navigation
    // paraît lente sur mobile.
    const duration = layout.match(/animation:\s*pageEnter\s+([\d.]+)s/)?.[1];
    expect(Number(duration)).toBeLessThanOrEqual(0.4);
  });

  it('fait monter les modales en bottom-sheet sur mobile', () => {
    const containers = read(CONTAINERS);
    const mobileBlock = containers.match(/@include mobile\s*\{([^{}]*)\}/)?.[0] ?? '';
    expect(mobileBlock).toContain('modalSlideUp');
    // La montée est encore plus courte que la page : une modale doit
    // répondre instantanément au doigt.
    expect(mobileBlock).toMatch(/modalSlideUp\s+[\d.]+s/);
  });

  it('garde un fade d\'overlay rapide (0.2s max)', () => {
    const overlay = blockContaining(read(CONTAINERS), '.retro-modal-overlay');
    expect(overlay).not.toBeNull();
    const duration = overlay!.match(/animation:\s*fadeIn\s+([\d.]+)s/)?.[1];
    expect(Number(duration)).toBeLessThanOrEqual(0.2);
  });

  it('anime le contenu des onglets inventaire/shop/fusion au switch', () => {
    const source = read(INVENTORY);
    // Règle groupée : les trois racines de contenu d'onglet fondent au montage.
    const grouped = source.match(
      /\.inventory-body,\s*\.inventory-shop-tab,\s*\.inventory-fusion-tab\s*\{[^}]*animation:\s*fadeIn/,
    );
    expect(grouped, 'règle groupée fadeIn manquante pour les onglets').not.toBeNull();
  });

  it('donne un retour tactile d\'enfoncement aux onglets d\'inventaire', () => {
    const source = read(INVENTORY);
    const tabBlock = scssBlock(source, '.inventory-tab');
    expect(tabBlock, 'bloc .inventory-tab introuvable').not.toBeNull();
    // L'onglet a un état :active (feedback au doigt) et une transition
    // incluant border-color (changement d'état actif fluide).
    expect(tabBlock).toContain(':active');
    expect(tabBlock).toMatch(/transition:[^;]*border-color/);
  });

  it('désactive les nouvelles animations sous prefers-reduced-motion', () => {
    const source = read(ANIMATIONS);
    const reducedBlock = blockContaining(source, '@media (prefers-reduced-motion: reduce)');
    expect(reducedBlock).not.toBeNull();
    expect(reducedBlock).toContain('.App > .container');
    expect(reducedBlock).toContain('.retro-modal');
  });
});
