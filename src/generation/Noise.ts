const PERMUTATION = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];

// Cache permutation tables per seed (avoids rebuilding on every noise2D call)
const permCache = new Map<number, Uint8Array>();

function getPerm(seed: number): Uint8Array {
  let cached = permCache.get(seed);
  if (cached) return cached;
  cached = new Uint8Array(512);
  for (let i = 0; i < 256; i++) {
    cached[i] = cached[i + 256] = PERMUTATION[(i + seed) % 256];
  }
  // LRU: keep max 64 cached seeds
  if (permCache.size > 64) {
    const firstKey = permCache.keys().next().value!;
    permCache.delete(firstKey);
  }
  permCache.set(seed, cached);
  return cached;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + t * (b - a);

function grad(hash: number, x: number, y: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function noise2D(x: number, y: number, seed: number): number {
  const p = getPerm(seed);

  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);

  const u = fade(x);
  const v = fade(y);

  const A = p[X] + Y;
  const AA = p[A];
  const AB = p[A + 1];
  const B = p[X + 1] + Y;
  const BA = p[B];
  const BB = p[B + 1];

  return lerp(
    lerp(grad(p[AA], x, y), grad(p[BA], x - 1, y), u),
    lerp(grad(p[AB], x, y - 1), grad(p[BB], x - 1, y - 1), u),
    v,
  );
}

/**
 * Fractal Brownian Motion - layers multiple octaves of noise for natural terrain
 * Uses persistence and lacunarity for realistic detail at multiple scales
 */
export function fbm(
  x: number,
  y: number,
  seed: number,
  octaves: number = 4,
  persistence: number = 0.5,
  lacunarity: number = 2.0,
  scale: number = 0.05,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency, seed + i * 31) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

/**
 * Generate noise map using fBm for rich, multi-scale terrain detail
 */
export function generateNoiseMap(
  width: number,
  height: number,
  seed: number,
  scale: number = 0.05,
  octaves: number = 3,
): Uint8Array {
  const map = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = fbm(x, y, seed, octaves, 0.5, 2.0, scale);
      map[y * width + x] = Math.floor((val + 1) * 127.5);
    }
  }
  return map;
}
