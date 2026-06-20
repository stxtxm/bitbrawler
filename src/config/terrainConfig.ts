/**
 * Centralized terrain configuration
 * All magic numbers and constants for the procedural terrain system
 */

// ============================================================================
// SCROLL SPEED CONFIGURATION (Coherent parallax speeds)
// ============================================================================

export const SCROLL_CONFIG = {
  // Base scroll speed in pixels per frame at 60 FPS
  BASE_SPEED: 1,

  // Layer-specific multipliers (0-1 = slower, parallax effect)
  LAYER_MULTIPLIERS: {
    sky: 0.1,      // Clouds drift slowly
    mountains: 0.3, // Mountains move slower than ground
    trees: 0.5,     // Trees parallax
    ground: 1.0,    // Ground layer scrolls at normal speed
    decorations: 1.2, // Decorations move slightly faster
  },

  // Mobile optimization (reduced FPS)
  MOBILE_FPS: 30,
  DESKTOP_FPS: 60,

  // Animation cycle durations (seconds)
  CLOUD_DRIFT_DURATION: 20,
  GRASS_SWAY_DURATION: 2,
  WATER_FLOW_DURATION: 1.5,

  // Infinite scroll configuration
  SCROLL_WRAP_DISTANCE: 1200, // Pixels before wrapping
} as const;

// ============================================================================
// NOISE & GENERATION CONFIGURATION
// ============================================================================

export const NOISE_CONFIG = {
  // Noise map resolution (lower = pixelated, higher = smooth)
  RESOLUTION: 4,
  MOBILE_RESOLUTION: 8, // Lower resolution on mobile

  // Cell size for rendering (pixels)
  CELL_SIZE: 4,
  MOBILE_CELL_SIZE: 8,

  // Noise parameters
  SCALE: 0.05,
  PERSISTENCE: 0.5,
  LACUNARITY: 2.0,

  // Cache settings
  CACHE_MAX_SEEDS: 10, // Cache max 10 unique noise maps
} as const;

// ============================================================================
// PARALLAX LAYER CONFIGURATION
// ============================================================================

export const PARALLAX_CONFIG = {
  // Number of depth layers
  DESKTOP_LAYERS: 4,
  MOBILE_LAYERS: 2, // Reduce layers on mobile

  // Layer definitions (from back to front)
  LAYERS: [
    {
      id: 'sky',
      type: 'background',
      depth: 0,
      speedMultiplier: 0.1,
      scrollable: false,
    },
    {
      id: 'mountains',
      type: 'silhouette',
      depth: 1,
      speedMultiplier: 0.3,
      scrollable: true,
    },
    {
      id: 'trees',
      type: 'procedural',
      depth: 2,
      speedMultiplier: 0.5,
      scrollable: true,
    },
    {
      id: 'ground',
      type: 'procedural',
      depth: 3,
      speedMultiplier: 1.0,
      scrollable: true,
    },
  ] as const,
} as const;

// ============================================================================
// BIOME CONFIGURATION
// ============================================================================

export const BIOME_CONFIG = {
  // Biome types
  BIOMES: ['meadow', 'forest', 'mountain', 'desert', 'water'] as const,

  // Biome transitions are smooth (blended over N pixels)
  TRANSITION_DISTANCE: 200,

  // Biome-specific colors
  COLORS: {
    meadow: {
      grass: '#6abf5e',
      dirt: '#5c4033',
      mountain: '#4a4a6a',
      accent: '#ffff00', // Flowers
    },
    forest: {
      grass: '#3a7d32',
      dirt: '#2d5a27',
      mountain: '#3a3a5a',
      accent: '#8b6914', // Trees
    },
    mountain: {
      grass: '#8b8b8b',
      dirt: '#6b6b6b',
      mountain: '#4a4a6a',
      accent: '#ffffff', // Snow
    },
    desert: {
      grass: '#d4af37',
      dirt: '#cdaa3d',
      mountain: '#8b7355',
      accent: '#ffa500', // Sand
    },
    water: {
      grass: '#4a9e3f',
      dirt: '#3a7d32',
      mountain: '#1a5a7a',
      accent: '#0099ff', // Water
    },
  } as const,
} as const;

// ============================================================================
// ANIMATION CONFIGURATION
// ============================================================================

export const ANIMATION_CONFIG = {
  // Grass sway animation
  GRASS_SWAY: {
    enabled: true,
    amplitude: 2, // pixels
    frequency: 0.5, // oscillations per second
  },

  // Cloud drift animation
  CLOUD_DRIFT: {
    enabled: true,
    amplitude: 20, // pixels
    frequency: 0.1, // oscillations per second
  },

  // Water flow animation
  WATER_FLOW: {
    enabled: true,
    amplitude: 1,
    frequency: 1.0,
  },

  // Particle effects
  PARTICLES: {
    enabled: true,
    maxParticles: 60,
    maxParticlesMobile: 20,
  },
} as const;

// ============================================================================
// 3D DEPTH EFFECTS CONFIGURATION
// ============================================================================

export const DEPTH_CONFIG = {
  // Shadow rendering
  SHADOWS_ENABLED: true,
  SHADOW_BLUR: 4,
  SHADOW_OPACITY: 0.3,

  // Perspective effects
  PERSPECTIVE_ENABLED: true,
  PERSPECTIVE_DEPTH: 0.1, // 10% depth scaling

  // Glow effects
  GLOW_ENABLED: true,
  GLOW_RADIUS: 8,
  GLOW_OPACITY: 0.2,

  // Disable 3D on very low-end devices
  DISABLE_3D_ON_LOW_END: true,
} as const;

// ============================================================================
// RESPONSIVE CONFIGURATION
// ============================================================================

export const RESPONSIVE_CONFIG = {
  // Breakpoints (pixels)
  BREAKPOINTS: {
    smallMobile: 380,  // Galaxy S8, very small phones
    mobile: 600,       // iPhone, Pixel 9a
    tablet: 768,       // iPad
    desktop: 1024,     // Desktop
  },

  // Quality settings per breakpoint
  QUALITY: {
    smallMobile: {
      layers: 2,
      fps: 30,
      noiseResolution: 8,
      cellSize: 8,
      particlesMax: 15,
      enable3d: false,
    },
    mobile: {
      layers: 3,
      fps: 30,
      noiseResolution: 6,
      cellSize: 6,
      particlesMax: 20,
      enable3d: false,
    },
    tablet: {
      layers: 4,
      fps: 45,
      noiseResolution: 5,
      cellSize: 5,
      particlesMax: 40,
      enable3d: true,
    },
    desktop: {
      layers: 4,
      fps: 60,
      noiseResolution: 4,
      cellSize: 4,
      particlesMax: 60,
      enable3d: true,
    },
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get quality settings based on viewport width
 */
export function getQualitySettings(width: number) {
  const bp = RESPONSIVE_CONFIG.BREAKPOINTS;

  if (width < bp.smallMobile) return RESPONSIVE_CONFIG.QUALITY.smallMobile;
  if (width < bp.mobile) return RESPONSIVE_CONFIG.QUALITY.mobile;
  if (width < bp.tablet) return RESPONSIVE_CONFIG.QUALITY.tablet;
  return RESPONSIVE_CONFIG.QUALITY.desktop;
}

/**
 * Get layer count based on viewport width
 */
export function getLayerCount(width: number): number {
  return getQualitySettings(width).layers;
}

/**
 * Get FPS target based on viewport width
 */
export function getFpsTarget(width: number): number {
  return getQualitySettings(width).fps;
}

/**
 * Calculate frame duration in milliseconds
 */
export function getFrameDuration(fps: number): number {
  return 1000 / fps;
}

/**
 * Get noise resolution based on viewport width
 */
export function getNoiseResolution(width: number): number {
  return getQualitySettings(width).noiseResolution;
}

/**
 * Check if 3D effects should be enabled
 */
export function shouldEnable3d(width: number): boolean {
  return getQualitySettings(width).enable3d;
}

/**
 * Get parallax speed multiplier for a layer
 */
export function getLayerSpeedMultiplier(layerId: string): number {
  const layer = PARALLAX_CONFIG.LAYERS.find((l) => l.id === layerId);
  return layer ? layer.speedMultiplier : 1.0;
}
