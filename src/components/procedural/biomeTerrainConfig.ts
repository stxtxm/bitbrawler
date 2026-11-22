export interface BiomeTerrainLayerDef {
  id: string;
  speed: number;
}

export interface BiomeTerrainConfig {
  sky: [number, string][];
  volcanoFar: string;
  volcanoNear: string;
  crater: string;
  lava: string;
  lavaBright: string;
  ground: string;
  groundVein: string;
  ash: string;
  embers: string[];
  layers: BiomeTerrainLayerDef[];
}

export const VOLCANIC_TERRAIN: Record<string, BiomeTerrainConfig> = {
  volcanic: {
    sky: [
      [0, '#8a2a14'],
      [0.4, '#c85a22'],
      [0.7, '#f09a42'],
      [1, '#ffc868'],
    ],
    volcanoFar: '#4a2014',
    volcanoNear: '#2e1208',
    crater: '#ff8a2a',
    lava: '#ff5a1a',
    lavaBright: '#ffd060',
    ground: '#2a1610',
    groundVein: '#ff6a2a',
    ash: 'rgba(214, 194, 182, 0.55)',
    embers: ['#ffd060', '#ff8a2a', '#ffb84a'],
    layers: [
      { id: 'volcanoFar', speed: 0.2 },
      { id: 'ash', speed: 0.35 },
      { id: 'volcanoNear', speed: 0.5 },
      { id: 'lava', speed: 0.7 },
      { id: 'ground', speed: 1.0 },
      { id: 'ember', speed: 1.2 },
    ],
  },
};

export interface MountainTerrainConfig {
  sky: [number, string][];
  peakFar: string;
  peakNear: string;
  snow: string;
  mist: string;
  ground: string;
  groundRock: string;
  pine: string;
  pineDark: string;
  particles: string[];
  layers: BiomeTerrainLayerDef[];
}

export const MOUNTAIN_TERRAIN: Record<string, MountainTerrainConfig> = {
  mountain: {
    sky: [
      [0, '#2a3d66'],
      [0.35, '#5a7aa8'],
      [0.7, '#93b6d8'],
      [1, '#d7ebf7'],
    ],
    peakFar: '#5f7290',
    peakNear: '#3b4d63',
    snow: '#eef6ff',
    mist: 'rgba(210, 228, 245, 0.22)',
    ground: '#5a6470',
    groundRock: '#3f4852',
    pine: '#2f5a44',
    pineDark: '#1f3d2e',
    particles: ['#ffffff', '#dcecff', '#bfd9f5'],
    layers: [
      { id: 'peakFar', speed: 0.18 },
      { id: 'mist', speed: 0.3 },
      { id: 'peakNear', speed: 0.45 },
      { id: 'ground', speed: 1.0 },
      { id: 'snow', speed: 1.15 },
    ],
  },
  abyssal: {
    sky: [
      [0, '#120b2b'],
      [0.35, '#2b1f52'],
      [0.7, '#5a3d88'],
      [1, '#8e6abf'],
    ],
    peakFar: '#3b2f5c',
    peakNear: '#24193f',
    snow: '#d9c6ff',
    mist: 'rgba(150, 120, 220, 0.18)',
    ground: '#2b2340',
    groundRock: '#191226',
    pine: '#4f3d76',
    pineDark: '#352955',
    particles: ['#cdb7ff', '#9f86ff', '#ffffff'],
    layers: [
      { id: 'peakFar', speed: 0.18 },
      { id: 'mist', speed: 0.3 },
      { id: 'peakNear', speed: 0.45 },
      { id: 'ground', speed: 1.0 },
      { id: 'snow', speed: 1.15 },
    ],
  },
  eclipse: {
    sky: [
      [0, '#1a1008'],
      [0.35, '#3a2412'],
      [0.7, '#7a4a1f'],
      [1, '#d49a4a'],
    ],
    peakFar: '#4a3426',
    peakNear: '#2f2016',
    snow: '#ffdca8',
    mist: 'rgba(255, 190, 120, 0.16)',
    ground: '#3a2d24',
    groundRock: '#241a14',
    pine: '#5a3d24',
    pineDark: '#3d2818',
    particles: ['#ffd48a', '#ffb45a', '#fff0c8'],
    layers: [
      { id: 'peakFar', speed: 0.18 },
      { id: 'mist', speed: 0.3 },
      { id: 'peakNear', speed: 0.45 },
      { id: 'ground', speed: 1.0 },
      { id: 'snow', speed: 1.15 },
    ],
  },
};

export function getLayerSpeed(cfg: BiomeTerrainConfig | MountainTerrainConfig, id: string): number {
  const layer = cfg.layers.find((l) => l.id === id);
  return layer ? layer.speed : 1.0;
}
