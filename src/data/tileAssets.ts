export interface TileDef {
  id: string
  pixels: number[][]
  palette: Record<number, string>
}

export const TILE_PALETTES = {
  sky: ['#0f0c29', '#302b63', '#24243e', '#1a1a2e', '#16213e', '#0f3460'],
  warm: ['#ff7e5f', '#feb47b', '#f7971e', '#ffd200', '#4facfe', '#00f2fe'],
  ground: ['#2d5a27', '#3a7d32', '#4a9e3f', '#5c4033', '#6b4423', '#8b6914', '#4a3520'],
  stone: ['#696969', '#808080', '#a9a9a9', '#555555', '#333333'],
  foliage: ['#ff69b4', '#ffff00', '#ff6347', '#00ff7f', '#ff4500', '#9370db'],
  clouds: ['#ffffff', '#f0f0f0', '#e0e0e0'],
}

export const GRASS_TILE: TileDef = {
  id: 'grass_dirt',
  pixels: [
    [0,0,0,1,1,0,1,1,0,0,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [3,0,0,0,3,0,0,0,0,0,3,0,0,0,3,0],
    [3,3,0,0,3,3,0,0,0,0,3,3,0,0,3,3],
    [0,3,3,0,0,3,3,0,0,3,3,0,0,3,3,0],
    [3,0,3,3,0,0,3,0,0,3,0,0,0,3,0,3],
    [3,3,0,3,0,0,0,3,3,0,0,0,3,0,3,3],
    [0,3,3,0,0,3,3,3,3,3,3,0,0,3,3,0],
    [3,3,0,3,3,3,3,3,3,3,3,3,3,0,3,3],
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
    [4,4,3,3,4,4,3,4,4,3,4,4,3,4,4,3],
    [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
    [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
    [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  ],
  palette: { 1: '#6abf5e', 2: '#4a9e3f', 3: '#3a7d32', 4: '#5c4033' },
}

export const STONE_TILE: TileDef = {
  id: 'grass_stone',
  pixels: [
    [0,0,0,1,1,0,1,1,0,0,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [3,0,0,0,0,5,5,0,5,0,0,0,0,0,3,0],
    [3,3,0,0,5,5,5,5,5,5,0,0,0,0,3,3],
    [0,3,3,0,0,5,5,5,5,0,0,0,0,3,3,0],
    [3,0,3,3,0,0,5,5,0,0,5,0,0,3,0,3],
    [3,3,0,3,0,0,0,5,5,0,5,5,3,0,3,3],
    [0,3,3,0,0,5,5,5,5,5,5,0,0,3,3,0],
    [3,3,0,3,3,5,5,5,5,5,5,3,3,0,3,3],
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
    [4,4,3,3,4,4,3,4,4,3,4,4,3,4,4,3],
    [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
    [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
    [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  ],
  palette: { 1: '#6abf5e', 2: '#4a9e3f', 3: '#3a7d32', 4: '#5c4033', 5: '#808080' },
}

export const FLOWER_TILE: TileDef = {
  id: 'flower_bush',
  pixels: [
    [0,0,0,1,1,0,1,1,0,0,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,3,0,0,3,0,0,0,0,0,0,0],
    [3,0,0,0,3,3,0,0,3,3,0,0,0,0,3,0],
    [3,3,0,0,3,3,3,3,3,3,4,0,0,0,3,3],
    [0,3,3,0,0,3,3,3,3,0,4,4,0,3,3,0],
    [3,0,3,3,0,0,3,3,0,0,4,0,0,3,0,3],
    [3,3,0,3,0,0,0,3,3,0,0,0,3,0,3,3],
    [0,3,3,0,0,3,3,3,3,3,3,0,0,3,3,0],
    [3,3,0,3,3,3,3,3,3,3,3,3,3,0,3,3],
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
    [4,4,3,3,4,4,3,4,4,3,4,4,3,4,4,3],
    [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
    [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
    [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  ],
  palette: { 1: '#6abf5e', 2: '#4a9e3f', 3: '#3a7d32', 4: '#5c4033', 5: '#ff69b4' },
}

export const DIRT_TILE: TileDef = {
  id: 'dirt_deep',
  pixels: Array(16).fill(null).map(() => {
    const row = Array(16).fill(1)
    for (let i = 0; i < 3; i++) {
      const pos = Math.floor(Math.random() * 16)
      row[pos] = 2
    }
    return row
  }),
  palette: { 1: '#4a3520', 2: '#3a2510' },
}

export const MOUNTAIN_TILE: TileDef = {
  id: 'mountain',
  pixels: [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  palette: { 1: '#4a4a6a', 2: '#3a3a5a' },
}

export const CLOUD_TILES: TileDef[] = [
  {
    id: 'cloud_1',
    pixels: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
    palette: { 1: '#ffffff', 2: '#f0f0f0', 3: '#e0e0e0' },
  },
  {
    id: 'cloud_2',
    pixels: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
    palette: { 1: '#ffffff', 2: '#f5f5f5', 3: '#e8e8e8' },
  },
]

const GROUND_TILES = [GRASS_TILE, STONE_TILE, FLOWER_TILE]

export function renderTileAsCssUrl(tile: TileDef): string {
  const cellSize = 1
  const width = tile.pixels[0]?.length ?? 16
  const height = tile.pixels.length
  const viewWidth = width * cellSize
  const viewHeight = height * cellSize
  const palette = tile.palette

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}" shape-rendering="crispEdges">`
  
  for (let y = 0; y < tile.pixels.length; y++) {
    for (let x = 0; x < tile.pixels[y].length; x++) {
      const cell = tile.pixels[y][x]
      if (cell === 0) continue
      const fill = palette[cell] || 'transparent'
      svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`
    }
  }
  
  svg += '</svg>'
  
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function generateGroundSequence(length: number): TileDef[] {
  const result: TileDef[] = []
  for (let i = 0; i < length; i++) {
    const prev = result[i - 1]
    if (prev?.id === 'flower_bush') {
      result.push(GROUND_TILES[Math.floor(Math.random() * 2)])
    } else {
      result.push(GROUND_TILES[Math.floor(Math.random() * GROUND_TILES.length)])
    }
  }
  return result
}

export interface CloudInstance {
  type: TileDef
  x: number
  y: number
  scale: number
  opacity: number
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function generateCloudPositions(seed?: string): CloudInstance[] {
  const rand = seed ? seededRandom(parseInt(seed.replace(/\D/g, '') || '42', 10)) : Math.random
  const count = 3 + Math.floor(rand() * 3)
  const clouds: CloudInstance[] = []
  for (let i = 0; i < count; i++) {
    clouds.push({
      type: CLOUD_TILES[Math.floor(rand() * CLOUD_TILES.length)],
      x: (i / count) * 100 + rand() * 10 - 5,
      y: 2 + rand() * 6,
      scale: 1 + rand() * 2,
      opacity: 0.5 + rand() * 0.4,
    })
  }
  return clouds
}

export function getSkyGradient(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 7) return 'linear-gradient(180deg, #1a0a2e 0%, #ff7e5f 40%, #feb47b 100%)'
  if (hour >= 7 && hour < 9) return 'linear-gradient(180deg, #ff7e5f 0%, #feb47b 40%, #4facfe 100%)'
  if (hour >= 9 && hour < 17) return 'linear-gradient(180deg, #4facfe 0%, #00f2fe 40%, #e0f7fa 100%)'
  if (hour >= 17 && hour < 19) return 'linear-gradient(180deg, #4facfe 0%, #f7971e 40%, #ffd200 100%)'
  if (hour >= 19 && hour < 21) return 'linear-gradient(180deg, #f7971e 0%, #ff7e5f 40%, #1a0a2e 100%)'
  return 'linear-gradient(180deg, #0f0c29 0%, #302b63 40%, #24243e 100%)'
}
