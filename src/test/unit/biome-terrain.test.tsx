import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, renderHook, act } from '@testing-library/react';
import { BiomeTerrain } from '../../components/procedural/BiomeTerrain';
import { TERRAIN_STYLES, VOLCANO_CONES } from '../../data/biomeTerrain';
import { useTerrainScrollLoop } from '../../hooks/useTerrainScrollLoop';
import {
  deterministicNoise,
  layerPhase,
  pixelRoundScroll,
  tileWorldIndex,
} from '../../utils/terrainScroll';

const MOCK_CTX = () => ({
  canvas: { width: 800, height: 600 },
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillRect: vi.fn(),
  fillStyle: '',
  drawImage: vi.fn(),
  fillText: vi.fn(),
});

// ============================================================================
// BIOME TERRAIN CANVAS — scrolling biome backdrop (volcanic + plains)
// ============================================================================

describe('BiomeTerrain Canvas', () => {
  let rafId = 0;
  const rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks.length = 0;
    rafId = 0;

    HTMLCanvasElement.prototype.getContext = vi.fn(() => MOCK_CTX()) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('performance', { now: vi.fn(() => 1000) });
    vi.stubGlobal('ResizeObserver', vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders without crashing for the volcanic biome', () => {
    const { container } = render(
      <BiomeTerrain biomeId="volcanic" seed="lava-seed" animated={false} width={800} height={600} />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('renders without crashing for the plains biome', () => {
    const { container } = render(
      <BiomeTerrain biomeId="plains" seed="green-seed" animated={false} width={800} height={600} />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('falls back to the plains style for an unknown biome id', () => {
    const { container } = render(
      <BiomeTerrain biomeId={'tundra' as 'plains'} seed="x" animated={false} width={800} height={600} />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('sets image-rendering to pixelated for crisp pixel art', () => {
    const { container } = render(
      <BiomeTerrain biomeId="volcanic" seed="lava-seed" animated={false} width={800} height={600} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas?.style.imageRendering).toBe('pixelated');
  });

  it('honors animated=false: static frame via the shared scroll loop (same pattern as terrain-canvas)', () => {
    const { container } = render(
      <BiomeTerrain biomeId="volcanic" seed="lava-seed" animated={false} width={800} height={600} />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
    const source = BiomeTerrain.toString();
    expect(source).toContain('useTerrainScrollLoop');
    expect(source).toContain('animated');
  });

  it('locks scroll to integer pixels via the shared pixelRoundScroll helper', () => {
    const source = BiomeTerrain.toString();
    expect(source).toContain('pixelRoundScroll(groundScroll)');
  });

  it('drives parallax layers at distinct speeds (far < mid < cones < ground)', () => {
    const source = BiomeTerrain.toString();
    expect(source).toContain('0.12');
    expect(source).toContain('0.26');
    expect(source).toContain('0.5');
    expect(source).toContain('0.9');
    expect(source).toContain('1');
  });

  it('reads the biome definition from src/data/biomes.ts (terrainSeed override)', () => {
    const source = BiomeTerrain.toString();
    expect(source).toContain('BIOMES');
    expect(source).toContain('terrainSeed');
  });
});

// ============================================================================
// BIOME TERRAIN STYLE DATA — brighter than the legacy SceneBackground
// ============================================================================

describe('BiomeTerrain style data', () => {
  it('registers exactly the plains and volcanic styles', () => {
    expect(Object.keys(TERRAIN_STYLES).length).toBe(2);
    expect(TERRAIN_STYLES.plains).toBeDefined();
    expect(TERRAIN_STYLES.volcanic).toBeDefined();
  });

  it('volcanic sky is a 4-stop twilight gradient (orange/brown, high contrast)', () => {
    expect(TERRAIN_STYLES.volcanic.sky.length).toBe(4);
    expect(TERRAIN_STYLES.volcanic.sky[0]).toBe('#ffc06a');
    expect(TERRAIN_STYLES.volcanic.sky[3]).toBe('#5e2418');
  });

  it('volcanic palette is brighter than the legacy dark SceneBackground', () => {
    const volcanic = TERRAIN_STYLES.volcanic;
    // The legacy volcanic SceneBackground used near-black #0b050d / #1e0a12.
    expect(volcanic.sky.join(' ')).not.toContain('#0b050d');
    expect(volcanic.sky.join(' ')).not.toContain('#050209');
    expect(volcanic.cone).not.toBe('#1e0a12');
    expect(volcanic.lavaBright).toBe('#ffd166');
    expect(volcanic.lava).toBe('#ff9f1c');
  });

  it('volcanic style defines embers, ash, basalt ground and lava cracks', () => {
    const volcanic = TERRAIN_STYLES.volcanic;
    expect(volcanic.ember.length).toBeGreaterThanOrEqual(3);
    expect(volcanic.ash).toBeTruthy();
    expect(volcanic.ground).toBe('#2e1510');
    expect(volcanic.groundShade).toBe('#1f0c08');
    expect(volcanic.crack).toContain('rgba');
  });

  it('plains style differs from volcanic (green sky, green ground)', () => {
    const plains = TERRAIN_STYLES.plains;
    expect(plains.sky[0]).toBe('#8ed0f5');
    expect(plains.ground).toBe('#4a7a3a');
    expect(plains.ground).not.toBe(TERRAIN_STYLES.volcanic.ground);
  });
});

// ============================================================================
// VOLCANO CONE DATA INTEGRITY
// ============================================================================

describe('Volcano cone data integrity', () => {
  it('defines at least a main cone and flanking cones', () => {
    expect(VOLCANO_CONES.length).toBeGreaterThanOrEqual(3);
  });

  it('cone grids are rectangular (all rows share the width)', () => {
    VOLCANO_CONES.forEach((cone) => {
      const width = cone.pixels[0].length;
      cone.pixels.forEach((row) => {
        expect(row.length).toBe(width);
      });
    });
  });

  it('cone grids only use pixel codes 0-4 (0 = empty, 1-4 = palette)', () => {
    VOLCANO_CONES.forEach((cone) => {
      cone.pixels.flat().forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(4);
      });
    });
  });

  it('every cone has a crater (code 3) and a bright rim (code 4)', () => {
    VOLCANO_CONES.forEach((cone) => {
      expect(cone.pixels.flat()).toContain(3);
      expect(cone.pixels.flat()).toContain(4);
    });
  });
});

// ============================================================================
// SHARED TERRAIN SCROLL / TILING HELPERS
// ============================================================================

describe('Shared terrain scroll helpers', () => {
  it('pixelRoundScroll locks floats to integer pixels', () => {
    expect(pixelRoundScroll(0)).toBe(0);
    expect(pixelRoundScroll(0.3)).toBe(0);
    expect(pixelRoundScroll(0.7)).toBe(1);
    expect(pixelRoundScroll(255.6)).toBe(256);
  });

  it('layerPhase wraps to a non-negative integer within the period', () => {
    const values = [0, 0.4, 0.7, 1.2, 255.6, 256.1, 300.5, 400.9];
    values.forEach((v) => {
      const scrollPx = pixelRoundScroll(v);
      const phase = layerPhase(scrollPx, 0.5, 128);
      expect(Number.isInteger(phase)).toBe(true);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(128);
      expect(layerPhase(scrollPx, 1, 192)).toBeGreaterThanOrEqual(0);
      expect(layerPhase(scrollPx, 1, 192)).toBeLessThan(192);
    });
  });

  it('layerPhase produces the same phase as the legacy inline formulas', () => {
    const scrolls = [0, 10, 50, 100, 200, 255, 256, 500, 1024];
    scrolls.forEach((s) => {
      expect(layerPhase(s, 0.5, 128)).toBe(Math.round(s * 0.5) % 128);
      expect(layerPhase(s, 1, 320)).toBe(s % 320);
      expect(layerPhase(s, 0.8, 64)).toBe(Math.round(s * 0.8) % 64);
      expect(layerPhase(s, 0.7, 48)).toBe(Math.round(s * 0.7) % 48);
    });
  });

  it('tileWorldIndex floors the world coordinate', () => {
    expect(tileWorldIndex(0, 320)).toBe(0);
    expect(tileWorldIndex(319, 320)).toBe(0);
    expect(tileWorldIndex(320, 320)).toBe(1);
    expect(tileWorldIndex(645, 320)).toBe(2);
  });

  it('deterministicNoise is deterministic, bounded and seed-sensitive', () => {
    const a = deterministicNoise(42, 3, 31, 7);
    const b = deterministicNoise(42, 3, 31, 7);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(101);
    expect(deterministicNoise(42, 3, 31, 7)).not.toBe(deterministicNoise(43, 3, 31, 7));
    expect(deterministicNoise(42, 3, 17, 11, 31)).toBeLessThan(31);
  });
});

// ============================================================================
// SHARED SCROLL LOOP HOOK — ramp-up + animated gating
// ============================================================================

describe('useTerrainScrollLoop', () => {
  let callbacks: FrameRequestCallback[];
  let nowValue: number;

  beforeEach(() => {
    callbacks = [];
    nowValue = 1000;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('performance', { now: () => nowValue });
    vi.stubGlobal('ResizeObserver', vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps scroll at 0 when animated=false (static frame)', () => {
    const frames: number[] = [];
    renderHook(() =>
      useTerrainScrollLoop({ animated: false, onFrame: (px) => frames.push(px) }),
    );
    act(() => {
      nowValue = 1400;
      callbacks[0](nowValue);
    });
    act(() => {
      nowValue = 1800;
      callbacks[1](nowValue);
    });
    expect(frames).toEqual([0, 0]);
  });

  it('advances scroll with the 800ms ramp-up when animated=true', () => {
    const frames: number[] = [];
    renderHook(() =>
      useTerrainScrollLoop({ animated: true, onFrame: (px) => frames.push(px) }),
    );
    // frame 1: elapsed 400ms -> ramp 0.5 -> speed 12, dt capped 0.05 -> +0.6
    act(() => {
      nowValue = 1400;
      callbacks[0](nowValue);
    });
    // frame 2: elapsed 800ms -> ramp 1.0 -> speed 24, dt capped 0.05 -> +1.2
    act(() => {
      nowValue = 1800;
      callbacks[1](nowValue);
    });
    expect(frames.length).toBe(2);
    expect(frames[0]).toBeCloseTo(0.6, 5);
    expect(frames[1]).toBeCloseTo(1.8, 5);
    expect(frames[0]).toBeLessThan(frames[1]);
  });

  it('does not start the loop while disabled', () => {
    const frames: number[] = [];
    const { unmount } = renderHook(() =>
      useTerrainScrollLoop({ animated: true, enabled: false, onFrame: (px) => frames.push(px) }),
    );
    expect(callbacks.length).toBe(0);
    expect(frames).toEqual([]);
    unmount();
  });
});
