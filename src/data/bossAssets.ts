import { Element } from '../types/Item';
import { BackgroundDef, VOLCANIC_BACKGROUND } from './backgrounds';

// ─── Unique Raid Boss ─────────────────────────────────────────────────────────
// A single, fully-designed boss ("VOID TITAN"). Its level & stats are scaled off
// the attacking player at spawn time (see bossUtils), so no baseStats/growthRates
// are needed — only the cosmetic data (id, name, element, specialty, pixels).

export type BossId = 'void_titan';

// ============================================================================
// Boss Combat Background Engine
// ----------------------------------------------------------------------------
// Every boss declares a `background` (BackgroundDef from data/backgrounds.ts)
// in its asset entry. The generic engine (SceneBackground component +
// _scene-background.scss) renders it for the whole combat window: base gradient,
// decorative pixel elements, window chrome accent and a corner tag. To add a NEW
// boss you only fill this data + a sprite — no CombatView/CSS changes required.
// ============================================================================

export type BossDef = {
  id: BossId;
  name: string;
  element: Element;
  specialty: string;
  description: string;
  palette: Record<number, string>;
  pixels: number[][];
  background: BackgroundDef;
};

export const BOSS_ID: BossId = 'void_titan';

export const BOSS_ASSETS: BossDef[] = [
  {
    id: BOSS_ID,
    name: 'VOID TITAN',
    element: 'dark',
    specialty: 'Worldbreaker',
    description:
      'An ancient colossus forged in the void. It absorbs every blow and refuses to fall in a single day. Whittle down its HP pool across multiple attacks — it persists until you land the final strike.',
    background: VOLCANIC_BACKGROUND,
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