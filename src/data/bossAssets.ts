import { Element } from '../types/Item';

// ─── Unique Raid Boss ─────────────────────────────────────────────────────────
// A single, fully-designed boss ("VOID TITAN"). Its level & stats are scaled off
// the attacking player at spawn time (see bossUtils), so no baseStats/growthRates
// are needed — only the cosmetic data (id, name, element, specialty, pixels).

export type BossId = 'void_titan';

// ============================================================================
// Boss Combat Background Engine
// ----------------------------------------------------------------------------
// Every boss declares a `background` (BossBackgroundDef) in its asset entry.
// The engine (BossBackground component + _boss-combat.scss) renders it for the
// whole combat window: base gradient, decorative pixel elements, window chrome
// accent and a corner tag. To add a NEW boss you only fill this data + a sprite
// — no CombatView/CSS changes required.
// ============================================================================

export type BossBgElementType = 'halo' | 'star' | 'rock' | 'rune' | 'wisp';

export type BossBgElement = {
  type: BossBgElementType;
  /** horizontal position, % of the combat window */
  x: number;
  /** vertical position, % of the combat window */
  y: number;
  /** element size in px (pixel style) */
  size: number;
  /** base color */
  color: string;
  /** optional glow color (shadow behind the element) */
  glow?: string;
  /** animation duration in seconds (overrides the type default) */
  speed?: number;
  /** animation delay in seconds */
  delay?: number;
};

export type BossBackgroundDef = {
  /** unique background id (used for future theming hooks) */
  id: string;
  /** short uppercase label shown in the window corner tag (defaults to RAID BOSS) */
  label?: string;
  /** window chrome accent color (border, glow) */
  accent: string;
  /** secondary accent color (tag text…) */
  accentAlt?: string;
  /** CSS background of the base layer */
  gradient: string;
  /** decorative pixel elements */
  elements: BossBgElement[];
};

export type BossDef = {
  id: BossId;
  name: string;
  element: Element;
  specialty: string;
  description: string;
  palette: Record<number, string>;
  pixels: number[][];
  background: BossBackgroundDef;
};

export const BOSS_ID: BossId = 'void_titan';

// ─── VOID TITAN background — "Void Abyss" ─────────────────────────────────────
// Deep-purple abyss with a central rift halo, drifting star field, floating void
// rocks, corrupted crimson runes and rising soul wisps (the Titan's palette).

export const VOID_TITAN_BACKGROUND: BossBackgroundDef = {
  id: 'void_abyss',
  label: 'RAID BOSS',
  accent: '#8a4bd8',
  accentAlt: '#31d8ff',
  gradient:
    'radial-gradient(120% 100% at 50% 8%, #241448 0%, #170b2e 38%, #0a0416 78%, #04020a 100%)',
  elements: [
    // Central void rift — nested halos behind the boss.
    { type: 'halo', x: 72, y: 32, size: 160, color: 'rgba(138, 75, 216, 0.55)', speed: 4 },
    { type: 'halo', x: 72, y: 32, size: 92, color: 'rgba(49, 216, 255, 0.30)', speed: 3, delay: 0.8 },
    // Starfield (twinkle).
    { type: 'star', x: 8, y: 14, size: 3, color: '#f2e9ff', delay: 0.2 },
    { type: 'star', x: 22, y: 8, size: 2, color: '#31d8ff', delay: 0.6 },
    { type: 'star', x: 38, y: 18, size: 3, color: '#c4b5fd', delay: 1.1 },
    { type: 'star', x: 55, y: 9, size: 2, color: '#f2e9ff', delay: 0.4 },
    { type: 'star', x: 68, y: 20, size: 3, color: '#31d8ff', delay: 1.4 },
    { type: 'star', x: 85, y: 12, size: 2, color: '#c4b5fd', delay: 0.9 },
    { type: 'star', x: 93, y: 26, size: 3, color: '#f2e9ff', delay: 1.7 },
    { type: 'star', x: 12, y: 34, size: 2, color: '#31d8ff', delay: 2.1 },
    { type: 'star', x: 88, y: 40, size: 2, color: '#c4b5fd', delay: 0.3 },
    // Floating void rocks.
    { type: 'rock', x: 6, y: 58, size: 22, color: '#2b1646', speed: 6, delay: 0.4 },
    { type: 'rock', x: 15, y: 70, size: 14, color: '#120a24', speed: 7, delay: 1.2 },
    { type: 'rock', x: 88, y: 62, size: 18, color: '#2b1646', speed: 6.5, delay: 0.8 },
    { type: 'rock', x: 81, y: 78, size: 12, color: '#120a24', speed: 5.5, delay: 1.6 },
    // Corrupted runes glowing at ground level.
    { type: 'rune', x: 22, y: 82, size: 10, color: '#ff3b4e', glow: 'rgba(255, 59, 78, 0.7)', speed: 2.4, delay: 0.2 },
    { type: 'rune', x: 78, y: 84, size: 10, color: '#ff3b4e', glow: 'rgba(255, 59, 78, 0.7)', speed: 2.4, delay: 1.3 },
    { type: 'rune', x: 50, y: 86, size: 8, color: '#8a4bd8', glow: 'rgba(138, 75, 216, 0.7)', speed: 2.8, delay: 0.7 },
    // Soul wisps drifting upward.
    { type: 'wisp', x: 30, y: 70, size: 5, color: '#31d8ff', glow: 'rgba(49, 216, 255, 0.8)', speed: 9, delay: 0.5 },
    { type: 'wisp', x: 62, y: 76, size: 4, color: '#c4b5fd', glow: 'rgba(196, 181, 253, 0.8)', speed: 11, delay: 2.2 },
  ],
};

export const BOSS_ASSETS: BossDef[] = [
  {
    id: BOSS_ID,
    name: 'VOID TITAN',
    element: 'dark',
    specialty: 'Worldbreaker',
    description:
      'An ancient colossus forged in the void. It absorbs every blow and refuses to fall in a single day. Whittle down its HP pool across multiple attacks — it persists until you land the final strike.',
    background: VOID_TITAN_BACKGROUND,
    palette: {
      0: 'transparent',
      1: '#120a24',
      2: '#2b1646',
      3: '#592a80',
      4: '#8a4bd8',
      5: '#31d8ff',
      6: '#ff3b4e',
      7: '#f2e9ff',
    },
    pixels: [
      [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0],
      [0,0,0,0,1,2,4,3,3,4,2,1,0,0,0,0],
      [0,0,0,1,2,4,5,5,5,5,4,2,1,0,0,0],
      [0,0,1,2,4,5,7,7,7,7,5,4,2,1,0,0],
      [0,0,1,2,4,7,6,6,6,6,7,4,2,1,0,0],
      [0,1,2,4,4,7,6,6,6,6,7,4,4,2,1,0],
      [1,2,4,4,4,4,4,4,4,4,4,4,4,4,2,1],
      [1,2,4,4,4,4,4,4,4,4,4,4,4,4,2,1],
      [1,2,2,4,4,4,4,4,4,4,4,4,4,2,2,1],
      [0,1,2,4,4,4,4,4,4,4,4,4,4,2,1,0],
      [0,1,2,2,4,4,4,4,4,4,4,4,2,2,1,0],
      [0,0,1,2,2,2,4,4,4,4,2,2,2,1,0,0],
      [0,0,1,2,4,2,2,2,2,2,2,4,2,1,0,0],
      [0,0,0,1,2,2,1,0,0,1,2,2,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
    ],
  },
];

export function getBossDef(id: BossId = BOSS_ID): BossDef | undefined {
  return BOSS_ASSETS.find((boss) => boss.id === id);
}