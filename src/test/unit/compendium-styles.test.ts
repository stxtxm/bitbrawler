import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const STYLE_FILE = 'src/styles/components/_compendium.scss';

const REQUIRED_SELECTORS = [
  '.compendium-panel',
  '.compendium-global',
  '.compendium-global__value',
  '.compendium-global__label',
  '.compendium-global__counts',
  '.compendium-card',
  '.compendium-card--item',
  '.compendium-card__art',
  '.compendium-card__name',
  '.compendium-card__meta',
  '.compendium-card__placeholder',
  '.compendium-icon',
  '.compendium-icon--unknown',
  '.bestiary-card',
  '.bestiary-card__sprite',
  '.bestiary-card__sprite--silhouette',
  '.bestiary-card__info',
  '.bestiary-card__element',
  '.bestiary-card__kills',
];

function readStyles(): string {
  return readFileSync(STYLE_FILE, 'utf8');
}

describe('compendium styles', () => {
  it('ships a dedicated partial with every class used by the compendium components', () => {
    const styles = readStyles();

    REQUIRED_SELECTORS.forEach((selector) => {
      expect(styles).toContain(selector);
    });
  });

  it('is imported by the compendium panel', () => {
    const source = readFileSync(
      'src/components/compendium/CompendiumPanel.tsx',
      'utf8',
    );

    expect(source).toContain("import '../../styles/components/_compendium.scss';");
  });
});
