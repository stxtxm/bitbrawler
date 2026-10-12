import type { ItemRarity } from '../../types/Item';

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

export const SKIN_TONES_16 = [
  '#f5c6a5', '#eec39b', '#e0ac69', '#d1a27c', '#c68642',
  '#b87a4f', '#9c5f36', '#8d5524', '#6e3d2b', '#4a2511',
  '#f0d0b0', '#c9a06a',
  '#fae0d4', '#dfb186', '#8c5835', '#3b1d0c',
];

export const HAIR_TONES_16 = [
  '#2c3e50', '#4a4a4a', '#1a1a1a', '#6b3f2a', '#8b4513',
  '#b9935a', '#d2691e', '#f4a460', '#c0c0c0', '#e84393',
  '#ffeaa7', '#a29bfe', '#7bed9f', '#70a1ff', '#eccc68',
  '#ff6b81',
  '#ff758f', '#38ef7d', '#ff9900', '#f1f2f6', '#7d5fff', '#1e90ff',
];

export const CLOTH_TONES_16 = [
  '#e74c3c', '#c0392b', '#ff6b6b', '#3498db', '#2e86de',
  '#2ecc71', '#1dd1a1', '#9b59b6', '#a55eea', '#f39c12',
  '#feca57', '#e67e22', '#34495e', '#57606f', '#16a085',
  '#ff9ff3',
  '#ff4757', '#2ed573', '#1e272e', '#ffa502', '#5352ed', '#3742fa',
];

export const PANTS_TONES_16 = [
  '#2c3e50', '#34495e', '#57606f', '#7f8c8d', '#5d4037',
  '#1a1a1a', '#341f97', '#222f3e', '#3d3d3d', '#6b4f2a',
  '#182C61', '#2C3A47', '#1B1464', '#485460',
];

export const EYE_TONES_16 = [
  '#3498db', '#2ecc71', '#8e44ad', '#16a085', '#95a5a6',
  '#f1c40f', '#e74c3c', '#f39c12', '#7bed9f', '#70a1ff',
  '#ff3838', '#00d2d3', '#ff9f43', '#a29bfe', '#54a0ff',
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

