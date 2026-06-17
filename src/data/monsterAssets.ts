import { Element } from '../types/Item';
import { StatKey } from '../utils/statUtils';

export type MonsterId = 'goblin' | 'ogre' | 'wraith';

export type MonsterDef = {
  id: MonsterId;
  name: string;
  element: Element;
  specialty: string;
  baseStats: Record<StatKey, number> & { hp: number };
  growthRates: Record<StatKey, number>;
  palette: Record<number, string>;
  pixels: number[][];
};

export const MONSTER_PALETTES: Record<MonsterId, Record<number, string>> = {
  goblin: {
    0: 'transparent',
    1: '#2d5a1e',
    2: '#4a8c3f',
    3: '#6abf5e',
    4: '#8b4513',
    5: '#d4a547',
    6: '#ff6b6b',
    7: '#ffffff',
  },
  ogre: {
    0: 'transparent',
    1: '#4a3728',
    2: '#7a5c3a',
    3: '#a87d4f',
    4: '#5c3a1e',
    5: '#ff4444',
    6: '#c49a6c',
    7: '#ffff00',
  },
  wraith: {
    0: 'transparent',
    1: '#1a0033',
    2: '#3d0066',
    3: '#6600cc',
    4: '#9933ff',
    5: '#cc66ff',
    6: '#00ffcc',
    7: '#ffffff',
  },
};

export const MONSTER_ASSETS: MonsterDef[] = [
  {
    id: 'goblin',
    name: 'Goblin',
    element: 'wind',
    specialty: 'Furtive Strike',
    baseStats: { strength: 5, vitality: 4, dexterity: 10, luck: 7, intelligence: 4, focus: 5, hp: 40 },
    growthRates: { strength: 0.5, vitality: 0.4, dexterity: 2.0, luck: 1.5, intelligence: 0.3, focus: 0.6 },
    palette: MONSTER_PALETTES.goblin,
    pixels: [
      [0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0],
      [0,0,0,2,3,3,2,0,0,0,0,0,0,0,0,0],
      [0,0,0,2,5,5,2,0,0,0,0,1,1,1,0,0],
      [0,0,0,2,2,2,2,0,0,0,1,2,2,2,1,0],
      [0,1,1,2,1,1,2,0,0,1,2,3,3,2,2,0],
      [1,2,2,2,7,7,2,1,1,2,3,3,3,3,2,0],
      [1,2,2,2,6,6,2,2,2,3,3,2,2,2,0,0],
      [0,1,2,2,2,2,2,2,3,3,2,2,0,0,0,0],
      [0,1,2,2,2,2,2,2,2,2,2,0,0,0,0,0],
      [0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0],
      [0,0,1,4,4,2,2,4,4,1,0,0,0,0,0,0],
      [0,1,4,4,4,2,2,4,4,4,1,0,0,0,0,0],
      [0,1,4,4,4,1,1,4,4,4,1,0,0,0,0,0],
      [0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    id: 'ogre',
    name: 'Ogre',
    element: 'earth',
    specialty: 'Stone Wall',
    baseStats: { strength: 8, vitality: 10, dexterity: 3, luck: 4, intelligence: 3, focus: 5, hp: 80 },
    growthRates: { strength: 1.8, vitality: 2.2, dexterity: 0.3, luck: 0.4, intelligence: 0.3, focus: 0.5 },
    palette: MONSTER_PALETTES.ogre,
    pixels: [
      [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0],
      [0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,0,1,2,7,7,7,7,2,1,0,0,0,0,0],
      [0,0,1,2,2,5,5,5,5,2,2,1,0,0,0,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
      [1,2,3,3,2,2,1,1,2,2,3,3,2,1,0,0],
      [1,2,3,3,2,2,1,1,2,2,3,3,2,1,0,0],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
      [0,1,2,4,4,2,2,2,2,4,4,2,1,0,0,0],
      [0,1,2,4,4,2,2,2,2,4,4,2,1,0,0,0],
      [0,1,2,2,2,1,0,0,1,2,2,2,1,0,0,0],
      [0,0,1,2,1,0,0,0,0,1,2,1,0,0,0,0],
      [0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0],
    ],
  },
  {
    id: 'wraith',
    name: 'Wraith',
    element: 'dark',
    specialty: 'Soul Drain',
    baseStats: { strength: 3, vitality: 4, dexterity: 5, luck: 5, intelligence: 10, focus: 8, hp: 35 },
    growthRates: { strength: 0.3, vitality: 0.4, dexterity: 0.6, luck: 0.6, intelligence: 2.0, focus: 1.8 },
    palette: MONSTER_PALETTES.wraith,
    pixels: [
      [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,1,1,0,0,0,0,0],
      [0,0,1,2,2,3,3,3,3,2,2,1,0,0,0,0],
      [0,1,2,3,3,4,4,4,4,3,3,2,1,0,0,0],
      [0,1,2,3,4,5,5,5,5,4,3,2,1,0,0,0],
      [0,0,1,2,4,5,7,7,5,4,2,1,0,0,0,0],
      [0,0,1,2,3,5,6,6,5,3,2,1,0,0,0,0],
      [1,1,2,2,3,4,4,4,4,3,2,2,1,1,0,0],
      [2,2,2,2,3,3,3,3,3,3,2,2,2,2,1,0],
      [3,3,2,2,2,2,2,2,2,2,2,2,3,3,1,0],
      [0,1,2,2,2,1,1,1,1,2,2,2,1,0,0,0],
      [0,0,1,2,1,0,0,0,0,1,2,1,0,0,0,0],
      [0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
];
