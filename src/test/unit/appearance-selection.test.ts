import { describe, it, expect } from 'vitest';
import { generateAppearance } from '../../utils/characterUtils';
import { resolveSpriteFeatures } from '../../components/sprite/spriteGenerator';
import {
  EXOTIC_BODY_TYPES,
  EXOTIC_HEAD_TYPES,
  pickBodyType,
  pickHeadType,
} from '../../components/sprite/headSelection';
import { OUTFIT_SCHEMES } from '../../components/sprite/spritePalettes';
import { PIXEL_PALETTES } from '../../components/PixelAssets';

const isScheme = (shirt: string, pants: string): boolean =>
  OUTFIT_SCHEMES.some((scheme) => scheme.shirt === shirt && scheme.pants === pants);

describe('natural appearance selection', () => {
  it('picks the shirt and trousers as one coherent outfit', () => {
    const appearance = generateAppearance('male', 'natural-outfit');
    expect(isScheme(appearance.shirtColor!, appearance.pantsColor!)).toBe(true);
  });

  it('keeps seed-only opponents on the same natural ramps', () => {
    const features = resolveSpriteFeatures('natural-opponent', 'female');
    expect(isScheme(features.shirtColor, features.pantsColor)).toBe(true);
    expect(PIXEL_PALETTES.hair).toContain(features.hairColor);
    expect(PIXEL_PALETTES.eyes).toContain(features.eyeColor);
  });

  it('prefers a fully visible human face over a helmet, mask or visor', () => {
    const pool = ['male', 'male_cyber'] as const;
    expect(pickHeadType(pool, () => 0.5)).toBe('male');
    expect(pickHeadType(pool, () => 0.95)).toBe('male_cyber');
    expect(EXOTIC_HEAD_TYPES.has('male_cyber')).toBe(true);
  });

  it('prefers ordinary clothing over a costume body', () => {
    const pool = ['basic', 'cyber_suit'] as const;
    expect(pickBodyType(pool, () => 0.5)).toBe('basic');
    expect(pickBodyType(pool, () => 0.95)).toBe('cyber_suit');
    expect(EXOTIC_BODY_TYPES.has('cyber_suit')).toBe(true);
  });

  it('has no neon hair or red eyes left in the natural ramps', () => {
    expect(PIXEL_PALETTES.hair).not.toContain('#e84393');
    expect(PIXEL_PALETTES.hair).not.toContain('#a29bfe');
    expect(PIXEL_PALETTES.hair).not.toContain('#e8e8e8');
    expect(PIXEL_PALETTES.eyes).not.toContain('#e74c3c');
    expect(PIXEL_PALETTES.eyes).not.toContain('#f1c40f');
  });
});
