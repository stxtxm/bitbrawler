import type { ItemRarity } from '../../types/Item';
import { PIXEL_PALETTES } from '../PixelAssets';

const clampByte = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

export function shiftHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = clampByte(parseInt(full.slice(0, 2), 16) * factor);
  const g = clampByte(parseInt(full.slice(2, 4), 16) * factor);
  const b = clampByte(parseInt(full.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const shadeHex = (hex: string): string => shiftHex(hex, 0.62);
export const deepShadeHex = (hex: string): string => shiftHex(hex, 0.42);
export const highlightHex = (hex: string): string => shiftHex(hex, 1.28);

// A single source of truth for the natural ramps: the creation preview stores
// these colours in CharacterAppearance, while seed-only opponents resolve them
// here. Keeping both paths on the same arrays prevents a natural preview from
// turning into a neon opponent (or vice versa).
export const SKIN_TONES_16 = PIXEL_PALETTES.skins;
export const HAIR_TONES_16 = PIXEL_PALETTES.hair;
export const CLOTH_TONES_16 = PIXEL_PALETTES.clothes;
export const PANTS_TONES_16 = PIXEL_PALETTES.pants;
export const EYE_TONES_16 = PIXEL_PALETTES.eyes;

// Shirt and pants are picked as a pair, not independently. Fourteen matching
// schemes keep the silhouette readable; the old independent picks produced
// green-on-teal and orange-on-yellow fighters.
export interface OutfitScheme {
  readonly shirt: string;
  readonly pants: string;
}

export const OUTFIT_SCHEMES: readonly OutfitScheme[] = [
  { shirt: '#b03a3a', pants: '#2f3b4a' },
  { shirt: '#3f6f9f', pants: '#2b2f3a' },
  { shirt: '#4a7a5a', pants: '#3a3a30' },
  { shirt: '#8a5a3a', pants: '#2e2e2e' },
  { shirt: '#6a4a7a', pants: '#2f2f3a' },
  { shirt: '#c9a24a', pants: '#3a3028' },
  { shirt: '#4a6a7a', pants: '#2a2a2a' },
  { shirt: '#d0d0d0', pants: '#3a4a5a' },
  { shirt: '#a84a6a', pants: '#2f2f3a' },
  { shirt: '#5a5a6a', pants: '#2a2a2a' },
  { shirt: '#e0e0e0', pants: '#5a4030' },
  { shirt: '#2e4a6a', pants: '#1f2a36' },
  { shirt: '#7a2f2f', pants: '#3a3a3a' },
  { shirt: '#3a7a6a', pants: '#2a2a30' },
];

export const RARITY_TRIM: Record<ItemRarity, string> = {
  common: '#9aa0a6',
  uncommon: '#34c759',
  rare: '#0a84ff',
  epic: '#bf5af2',
  legendary: '#ffd60a',
};

export const OUTLINE_HEX = '#15172e';

export function mixHex(a: string, b: string, amountB: number): string {
  const parse = (hex: string): [number, number, number] => {
    const clean = hex.replace('#', '');
    const full = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const t = Math.max(0, Math.min(1, amountB));
  const r = clampByte(ar + (br - ar) * t);
  const g = clampByte(ag + (bg - ag) * t);
  const b2 = clampByte(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b2.toString(16).padStart(2, '0')}`;
}

