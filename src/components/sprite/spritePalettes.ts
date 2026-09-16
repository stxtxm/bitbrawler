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
];

export const HAIR_TONES_16 = [
  '#2c3e50', '#4a4a4a', '#1a1a1a', '#6b3f2a', '#8b4513',
  '#b9935a', '#d2691e', '#f4a460', '#c0c0c0', '#e84393',
  '#ffeaa7', '#a29bfe', '#7bed9f', '#70a1ff', '#eccc68',
  '#ff6b81',
];

export const CLOTH_TONES_16 = [
  '#e74c3c', '#c0392b', '#ff6b6b', '#3498db', '#2e86de',
  '#2ecc71', '#1dd1a1', '#9b59b6', '#a55eea', '#f39c12',
  '#feca57', '#e67e22', '#34495e', '#57606f', '#16a085',
  '#ff9ff3',
];

export const PANTS_TONES_16 = [
  '#2c3e50', '#34495e', '#57606f', '#7f8c8d', '#5d4037',
  '#1a1a1a', '#341f97', '#222f3e', '#3d3d3d', '#6b4f2a',
];

export const EYE_TONES_16 = [
  '#3498db', '#2ecc71', '#8e44ad', '#16a085', '#95a5a6',
  '#f1c40f', '#e74c3c', '#f39c12', '#7bed9f', '#70a1ff',
];

export const RARITY_TRIM: Record<ItemRarity, string> = {
  common: '#9aa0a6',
  uncommon: '#34c759',
  rare: '#0a84ff',
  epic: '#bf5af2',
  legendary: '#ffd60a',
};
