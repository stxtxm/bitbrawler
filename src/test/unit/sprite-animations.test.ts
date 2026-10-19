import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Garde-fous du rendu pixel-art (incident « animations chelou »).
 *
 * 1. Les keyframes qui animent un SPRITE ne doivent contenir ni rotation ni
 *    translation fractionnaire : le navigateur rééchantillonne alors le bitmap
 *    (pixels de tailles inégales d'une frame à l'autre → scintillement).
 * 2. Les boîtes CSS `.pixel-character` ne doivent plus imposer un ratio 2:3
 *    (les sprites sont 24×42) : la hauteur passe par `--sprite-box-h` et la
 *    largeur suit le ratio natif.
 */

const STYLE_DIR = 'src/styles/components';
const FILES = [
  `${STYLE_DIR}/_combat-fight.scss`,
  `${STYLE_DIR}/_combat-intro.scss`,
  `${STYLE_DIR}/_combat-result.scss`,
  `${STYLE_DIR}/_idle-runner.scss`,
];

const SPRITE_KEYFRAMES = [
  'fighterIdle',
  'actorHit',
  'critFlash',
  'magicPulse',
  'actorMiss',
  'actorCounter',
  'receiveHit',
  'receiveCrit',
  'receiveMagic',
  'defeatCollapse',
  'runCycle',
  'attackLunge',
  'victoryJump',
  'monsterPopIn',
  'monsterDefeat',
  'monsterHitShake',
  'shadowSquash',
];

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

/** Extrait le bloc `@keyframes name { ... }` en équilibrant les accolades. */
function keyframeBlock(source: string, name: string): string | null {
  const start = source.indexOf(`@keyframes ${name}`);
  if (start < 0) return null;
  const open = source.indexOf('{', start);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

/** Multiplicateurs autorisés : base × multiplicateur doit donner un entier. */
const INTEGER_MULTIPLIERS: Record<string, string[]> = {
  '--lunge-shift': ['-1', '-0.4', '0.2', '0.4', '0.6', '1.4'], // base ±5 px
  '--lunge-strong': ['1'], // base ±7 px : aucun multiplicateur fractionnaire
  '--react-shift': ['0.5'], // base ±6 px
  '--react-shift-strong': ['1'],
  '--react-shift-soft': ['1'],
};

describe('animations de sprites', () => {
  const sources = Object.fromEntries(FILES.map((f) => [f, read(f)]));

  it('ne fait jamais tourner un sprite ni ne le translate en demi-pixels', () => {
    const problems: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      for (const name of SPRITE_KEYFRAMES) {
        const block = keyframeBlock(source, name);
        if (!block) continue;
        if (/rotate\(/.test(block)) problems.push(`${file} @keyframes ${name} : rotation`);
        // translateX/Y(-0.5px) & co : sous-pixel → rééchantillonnage
        if (/translate[XY]?\(\s*-?\d*\.\d+px/.test(block)) {
          problems.push(`${file} @keyframes ${name} : translation fractionnaire`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('ne multiplie les variables de recul/allonge que vers des pixels entiers', () => {
    const problems: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      const calcs = source.match(/calc\(var\(--(?:lunge|react)[\w-]*\)\s*\*\s*-?[\d.]+\)/g) ?? [];
      for (const calc of calcs) {
        const [, variable, multiplier] = calc.match(/calc\(var\((--[\w-]+)\)\s*\*\s*(-?[\d.]+)\)/) ?? [];
        const allowed = INTEGER_MULTIPLIERS[variable] ?? [];
        if (!allowed.includes(multiplier)) {
          problems.push(`${file} ${calc} : multiplicateur ${multiplier} non entier (base ${variable})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('dimensionne les sprites par --sprite-box-h, jamais par une boîte 2:3', () => {
    const problems: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      // règles `.pixel-character` contenant un sélecteur et un bloc
      const ruleRe = /([^{}]*\.pixel-character[^{}]*)\{([^{}]*)\}/g;
      for (const match of source.matchAll(ruleRe)) {
        const [, selector, body] = match;
        if (!/height\s*:/.test(body)) continue; // règle de style, pas de taille
        if (!/--sprite-box-h/.test(body)) {
          problems.push(`${file} ${selector.trim()} : hauteur sans --sprite-box-h`);
        }
        if (/width\s*:\s*\d*\.?\d+px/.test(body)) {
          problems.push(`${file} ${selector.trim()} : largeur imposée en px (ratio 2:3)`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('a supprimé les keyframes morts', () => {
    const idleRunner = sources[`${STYLE_DIR}/_idle-runner.scss`];
    expect(keyframeBlock(idleRunner, 'monsterFloat')).toBeNull();
  });

  it('garde le repli CSS sans frames synchronisé et par paliers', () => {
    const combat = sources[`${STYLE_DIR}/_combat-fight.scss`];
    const runner = sources[`${STYLE_DIR}/_idle-runner.scss`];
    // le bob CSS ne s'applique que si les frames ne tournent pas
    expect(combat).toMatch(/\.pixel-character\[data-anim='static'\]/);
    // déplacements discrets : steps(1) + translations entières
    expect(combat).toMatch(/animation:\s*fighterIdle[^;]*steps\(1/);
    expect(runner).toMatch(/animation:\s*runCycle[^;]*steps\(1/);
  });
});
