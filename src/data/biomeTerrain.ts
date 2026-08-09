import { BiomeId } from './biomes';

export type TerrainStyle = {
  sky: string[];
  sun: string;
  far: string;
  mid: string;
  cone: string;
  coneLight: string;
  lava: string;
  lavaBright: string;
  ground: string;
  groundShade: string;
  crack: string;
  ash: string;
  ember: string[];
};

export type ConeDef = {
  pixels: number[][];
};

export const VOLCANO_CONES: ConeDef[] = [
  {
    pixels: [
      [0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 4, 1, 1, 0, 0, 0],
      [0, 0, 1, 2, 2, 4, 2, 2, 1, 0, 0],
      [0, 1, 2, 2, 2, 4, 2, 2, 2, 1, 0],
      [1, 2, 2, 2, 2, 3, 2, 2, 2, 2, 1],
      [1, 2, 2, 2, 2, 3, 2, 2, 2, 2, 1],
    ],
  },
  {
    pixels: [
      [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 4, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 2, 2, 4, 2, 2, 1, 0, 0],
      [0, 0, 1, 2, 2, 2, 4, 2, 2, 2, 1, 0],
      [0, 1, 2, 2, 2, 2, 3, 2, 2, 2, 2, 1],
      [1, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 1],
    ],
  },
  {
    pixels: [
      [0, 0, 0, 0, 3, 0, 0, 0, 0],
      [0, 0, 1, 1, 4, 1, 1, 0, 0],
      [0, 1, 2, 2, 4, 2, 2, 1, 0],
      [1, 2, 2, 2, 3, 2, 2, 2, 1],
    ],
  },
];

export const TERRAIN_STYLES: Record<BiomeId, TerrainStyle> = {
  plains: {
    sky: ['#8ed0f5', '#bfe6f9', '#dff3fc', '#eaf9fe'],
    sun: 'rgba(255, 250, 220, 0.9)',
    far: '#5a8a5a',
    mid: '#4a7a4a',
    cone: '#2f5e30',
    coneLight: '#3d743e',
    lava: '#8a9a5a',
    lavaBright: '#b8cc6a',
    ground: '#4a7a3a',
    groundShade: '#2f5a2a',
    crack: 'rgba(200, 190, 120, 0.35)',
    ash: '#3f5a3a',
    ember: ['#e8f0c0', '#c8d890', '#a8c070'],
  },
  volcanic: {
    sky: ['#ffc06a', '#ff8c3a', '#c95e26', '#5e2418'],
    sun: 'rgba(255, 205, 110, 0.85)',
    far: '#a04828',
    mid: '#7a3018',
    cone: '#4a180e',
    coneLight: '#6b2a16',
    lava: '#ff9f1c',
    lavaBright: '#ffd166',
    ground: '#2e1510',
    groundShade: '#1f0c08',
    crack: 'rgba(255, 140, 60, 0.6)',
    ash: '#3a2a26',
    ember: ['#ffd166', '#ff9f1c', '#ff6b2b'],
  },
};
