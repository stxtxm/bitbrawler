import { Element } from '../types/Item';
import { BackgroundDef, VOLCANIC_BACKGROUND, ABYSSAL_RIFT_BACKGROUND } from './backgrounds';

// ─── Unique Raid Boss ─────────────────────────────────────────────────────────
// A single, fully-designed boss ("VOID TITAN"). Its level & stats are scaled off
// the attacking player at spawn time (see bossUtils), so no baseStats/growthRates
// are needed — only the cosmetic data (id, name, element, specialty, pixels).

export type BossId = 'void_titan' | 'abyssal_monarch';

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
export const ABYSSAL_BOSS_ID: BossId = 'abyssal_monarch';

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
  {
    id: ABYSSAL_BOSS_ID,
    name: 'ABYSSAL MONARCH',
    element: 'water',
    specialty: 'Trench Sovereign',
    description:
      'Sovereign of the crushing abyss, crowned in bioluminescent trenches. Only those who shattered the Void Titan and reached level 58 may challenge it. Its abyssal HP pool is twice the Titan’s — every strike peels the trench one league deeper. Rewards are abyssal: massive XP, 180 essence and a guaranteed abyssal cache.',
    background: ABYSSAL_RIFT_BACKGROUND,
    palette: {
      0: 'transparent',
      1: '#020410',
      2: '#0a1430',
      3: '#1a2a58',
      4: '#2a4a88',
      5: '#2af0ff',
      6: '#f0c040',
      7: '#e0f0ff',
      8: '#ff3b2e',
    },
    pixels: [
      [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,1,2,3,3,3,2,1,0,0,0,0,0],
      [0,0,0,1,2,3,4,6,4,3,2,1,0,0,0,0],
      [0,0,1,2,3,4,5,6,5,4,3,2,1,0,0,0],
      [0,1,2,3,4,5,7,6,7,5,4,3,2,1,0,0],
      [1,2,3,4,5,7,6,6,6,7,5,4,3,2,1,0],
      [1,2,4,4,5,7,8,8,8,7,5,4,4,2,1,0],
      [1,2,4,4,4,4,4,4,4,4,4,4,4,2,2,0],
      [0,1,3,4,4,4,4,4,4,4,4,4,3,1,0,0],
      [0,1,2,3,4,4,4,4,4,4,4,3,2,1,0,0],
      [0,0,1,2,3,3,4,4,4,3,3,2,1,0,0,0],
      [0,0,1,2,5,3,2,2,2,3,5,2,1,0,0,0],
      [0,0,0,1,6,2,1,0,1,2,6,1,0,0,0,0],
      [0,0,0,1,6,6,1,0,1,6,6,1,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
];

export function getBossDef(id: BossId = BOSS_ID): BossDef | undefined {
  return BOSS_ASSETS.find((boss) => boss.id === id);
}