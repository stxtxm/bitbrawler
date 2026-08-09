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

export function getLayerSpeed(cfg: BiomeTerrainConfig, id: string): number {
  const layer = cfg.layers.find((l) => l.id === id);
  return layer ? layer.speed : 1.0;
}
