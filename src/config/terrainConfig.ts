/**
 * Centralized terrain configuration
 */

// ============================================================================
// SCROLL SPEED
// ============================================================================

export const SCROLL_CONFIG = {
  BASE_SPEED: 0.5,
  LAYER_MULTIPLIERS: {
    sky: 0.1,
    mountains: 0.3,
    trees: 0.5,
    ground: 1.0,
    decorations: 1.2,
  },
  MOBILE_FPS: 30,
  DESKTOP_FPS: 60,
  SCROLL_WRAP_DISTANCE: 2000,
} as const;

// ============================================================================
// NOISE & GENERATION
// ============================================================================

export const NOISE_CONFIG = {
  RESOLUTION: 3,
  MOBILE_RESOLUTION: 6,
  CELL_SIZE: 3,
  MOBILE_CELL_SIZE: 6,
  SCALE: 0.03,
  PERSISTENCE: 0.5,
  LACUNARITY: 2.0,
  OCTAVES: 3,
  CACHE_MAX_SEEDS: 10,
} as const;

// ============================================================================
// PARALLAX LAYERS
// ============================================================================

export const PARALLAX_CONFIG = {
  DESKTOP_LAYERS: 4,
  MOBILE_LAYERS: 2,
  LAYERS: [
    { id: 'sky', type: 'background', depth: 0, speedMultiplier: 0.1, scrollable: false },
    { id: 'mountains', type: 'silhouette', depth: 1, speedMultiplier: 0.3, scrollable: true },
    { id: 'trees', type: 'procedural', depth: 2, speedMultiplier: 0.5, scrollable: true },
    { id: 'ground', type: 'procedural', depth: 3, speedMultiplier: 1.0, scrollable: true },
  ] as const,
} as const;

// ============================================================================
// BIOMES
// ============================================================================

export const BIOME_CONFIG = {
  BIOMES: ['meadow', 'forest', 'mountain', 'desert', 'water'] as const,
  TRANSITION_DISTANCE: 200,
  COLORS: {
    meadow: {
      grass: '#5a9e4a',
      dirt: '#6b5340',
      mountain: '#5a5a7a',
      accent: '#e8d44d',
    },
    forest: {
      grass: '#2d6b25',
      dirt: '#3d2b1a',
      mountain: '#3a3a5a',
      accent: '#4a8c3a',
    },
    mountain: {
      grass: '#7a7a7a',
      dirt: '#5a5a5a',
      mountain: '#4a4a6a',
      accent: '#e8e8f0',
    },
    desert: {
      grass: '#c9a83a',
      dirt: '#b89830',
      mountain: '#8a7350',
      accent: '#e8b830',
    },
    water: {
      grass: '#3a8a6a',
      dirt: '#2a6a4a',
      mountain: '#1a5a7a',
      accent: '#4aa8e8',
    },
  } as const,
} as const;

// ============================================================================
// ANIMATION (kept for future use)
// ============================================================================

export const ANIMATION_CONFIG = {
  GRASS_SWAY: { enabled: true, amplitude: 2, frequency: 0.5 },
  CLOUD_DRIFT: { enabled: true, amplitude: 20, frequency: 0.1 },
  WATER_FLOW: { enabled: true, amplitude: 1, frequency: 1.0 },
  PARTICLES: { enabled: true, maxParticles: 60, maxParticlesMobile: 20 },
} as const;

// ============================================================================
// 3D DEPTH
// ============================================================================

export const DEPTH_CONFIG = {
  SHADOWS_ENABLED: true,
  SHADOW_BLUR: 4,
  SHADOW_OPACITY: 0.25,
  PERSPECTIVE_ENABLED: true,
  PERSPECTIVE_DEPTH: 0.1,
  GLOW_ENABLED: true,
  GLOW_RADIUS: 8,
  GLOW_OPACITY: 0.15,
  DISABLE_3D_ON_LOW_END: true,
} as const;

// ============================================================================
// RESPONSIVE
// ============================================================================

export const RESPONSIVE_CONFIG = {
  BREAKPOINTS: {
    smallMobile: 380,
    mobile: 600,
    tablet: 768,
    desktop: 1024,
  },
  QUALITY: {
    smallMobile: {
      layers: 2,
      fps: 30,
      noiseResolution: 6,
      cellSize: 6,
      particlesMax: 15,
      enable3d: false,
    },
    mobile: {
      layers: 3,
      fps: 30,
      noiseResolution: 4,
      cellSize: 4,
      particlesMax: 20,
      enable3d: false,
    },
    tablet: {
      layers: 4,
      fps: 45,
      noiseResolution: 3,
      cellSize: 3,
      particlesMax: 40,
      enable3d: true,
    },
    desktop: {
      layers: 4,
      fps: 60,
      noiseResolution: 3,
      cellSize: 3,
      particlesMax: 60,
      enable3d: true,
    },
  },
} as const;

// ============================================================================
// HELPERS
// ============================================================================

export function getQualitySettings(width: number) {
  const bp = RESPONSIVE_CONFIG.BREAKPOINTS;
  if (width < bp.smallMobile) return RESPONSIVE_CONFIG.QUALITY.smallMobile;
  if (width < bp.mobile) return RESPONSIVE_CONFIG.QUALITY.mobile;
  if (width < bp.tablet) return RESPONSIVE_CONFIG.QUALITY.tablet;
  return RESPONSIVE_CONFIG.QUALITY.desktop;
}

export function getLayerCount(width: number): number {
  return getQualitySettings(width).layers;
}

export function getFpsTarget(width: number): number {
  return getQualitySettings(width).fps;
}

export function getFrameDuration(fps: number): number {
  return 1000 / fps;
}

export function getNoiseResolution(width: number): number {
  return getQualitySettings(width).noiseResolution;
}

export function shouldEnable3d(width: number): boolean {
  return getQualitySettings(width).enable3d;
}

export function getLayerSpeedMultiplier(layerId: string): number {
  const layer = PARALLAX_CONFIG.LAYERS.find((l) => l.id === layerId);
  return layer ? layer.speedMultiplier : 1.0;
}
