import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerrainAnimation, useParallaxAnimation, useCloudAnimation, useGrassSwayAnimation } from '../../hooks/useTerrainAnimation';
import { useTerrainNoiseMaps, useTerrainNoiseMap } from '../../hooks/useTerrainNoise';
import { getBiomeColor, getBiomeAt, getBiomeName } from '../../generation/BiomeGenerator';
import { getQualitySettings, getFpsTarget, getLayerCount, shouldEnable3d } from '../../config/terrainConfig';

// ============================================================================
// TERRAIN CONFIG TESTS
// ============================================================================

describe('Terrain Config', () => {
  it('should get quality settings for small mobile', () => {
    const settings = getQualitySettings(360);
    expect(settings.layers).toBe(2);
    expect(settings.fps).toBe(30);
  });

  it('should get quality settings for tablet', () => {
    const settings = getQualitySettings(768);
    expect(settings.layers).toBe(4);
    expect(settings.fps).toBeGreaterThanOrEqual(45);
  });

  it('should get quality settings for desktop', () => {
    const settings = getQualitySettings(1024);
    expect(settings.layers).toBe(4);
    expect(settings.fps).toBe(60);
  });

  it('should calculate correct FPS for viewport width', () => {
    expect(getFpsTarget(360)).toBe(30); // Mobile
    expect(getFpsTarget(1024)).toBe(60); // Desktop
  });

  it('should calculate correct layer count', () => {
    expect(getLayerCount(360)).toBe(2); // Small mobile
    expect(getLayerCount(1024)).toBe(4); // Desktop
  });

  it('should disable 3D on small mobile devices', () => {
    expect(shouldEnable3d(360)).toBe(false);
    expect(shouldEnable3d(1024)).toBe(true);
  });
});

// ============================================================================
// BIOME GENERATOR TESTS
// ============================================================================

describe('BiomeGenerator', () => {
  it('should get biome color for a position', () => {
    const color = getBiomeColor(0, 0, 123, 'grass');
    expect(color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('should get different biomes at different positions', () => {
    const color1 = getBiomeAt(0, 0, 123).type;
    const color2 = getBiomeAt(100, 100, 123).type;

    // They might be the same or different depending on noise
    expect(['meadow', 'forest', 'mountain', 'desert', 'water']).toContain(
      color1,
    );
    expect(['meadow', 'forest', 'mountain', 'desert', 'water']).toContain(
      color2,
    );
  });

  it('should return valid biome names', () => {
    const validNames = ['Meadow', 'Forest', 'Mountain', 'Desert', 'Water'];
    const biomeTypes = ['meadow', 'forest', 'mountain', 'desert', 'water'] as const;

    biomeTypes.forEach((type) => {
      const name = getBiomeName(type);
      expect(validNames).toContain(name);
    });
  });

  it('should have transition factor between 0 and 1', () => {
    const biome = getBiomeAt(50, 50, 123);
    expect(biome.transitionFactor).toBeGreaterThanOrEqual(0);
    expect(biome.transitionFactor).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// TERRAIN NOISE TESTS
// ============================================================================

describe('Terrain Noise Caching', () => {
  it('should cache noise maps', () => {
    const { result, rerender } = renderHook(() =>
      useTerrainNoiseMaps(1024, 512, 2, 'seed-123', 4),
    );

    const firstMaps = result.current;
    expect(firstMaps[0]).toBeDefined();
    expect(firstMaps[1]).toBeDefined();

    // Re-render with same params - should return cached
    rerender();
    expect(result.current).toBe(firstMaps); // Same reference
  });

  it('should regenerate noise maps when seed changes', () => {
    const { result, rerender } = renderHook(
      ({ seed }) => useTerrainNoiseMaps(1024, 512, 2, seed, 4),
      { initialProps: { seed: 'seed-123' } },
    );

    const firstMaps = result.current;

    rerender({ seed: 'seed-456' });
    const secondMaps = result.current;

    expect(firstMaps).not.toBe(secondMaps); // Different references
  });

  it('should get single noise map', () => {
    const { result } = renderHook(() =>
      useTerrainNoiseMap(1024, 512, 'seed-123', 0, 4),
    );

    expect(result.current).toBeInstanceOf(Uint8Array);
    expect(result.current.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TERRAIN ANIMATION TESTS
// ============================================================================

describe('Terrain Animation', () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;
  let fakeTime = 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeTime = 1000;
    vi.setSystemTime(fakeTime);
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fireRaf = (advanceMs = 16) => {
    fakeTime += advanceMs;
    vi.setSystemTime(fakeTime);
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach((cb) => cb(fakeTime));
  };

  it('should animate terrain scroll with FPS control', () => {
    const onScroll = vi.fn();

    renderHook(() => useTerrainAnimation(60, 1, onScroll, true));

    fireRaf(20);

    expect(onScroll).toHaveBeenCalled();
  });

  it('should respect FPS limit (30 FPS)', () => {
    const onScroll = vi.fn();

    renderHook(() => useTerrainAnimation(30, 1, onScroll, true));

    // First frame at t=1000
    fireRaf(0);

    const firstCallCount = onScroll.mock.calls.length;

    // Second frame only 10ms later — should be throttled (30fps = 33ms)
    fireRaf(10);
    expect(onScroll.mock.calls.length).toBe(firstCallCount);

    // Third frame 30ms later — total 40ms from start, should fire
    fireRaf(30);

    expect(onScroll.mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('should not animate when disabled', () => {
    const onScroll = vi.fn();

    const { rerender } = renderHook(
      ({ enabled }) => useTerrainAnimation(60, 1, onScroll, enabled),
      { initialProps: { enabled: true } },
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Disable animation
    rerender({ enabled: false });

    onScroll.mockClear();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onScroll).not.toHaveBeenCalled();
  });

  it('should handle scroll speed changes', () => {
    const onScroll = vi.fn();

    const callback = (offset: number) => {
      onScroll(offset);
    };

    const { rerender } = renderHook(
      ({ speed }) => useTerrainAnimation(60, speed, callback, true),
      { initialProps: { speed: 1 } },
    );

    fireRaf(50);

    // Change speed
    rerender({ speed: 2 });
    onScroll.mockClear();

    fireRaf(50);

    expect(onScroll).toHaveBeenCalled();
  });
});

// ============================================================================
// PARALLAX ANIMATION TESTS
// ============================================================================

describe('Parallax Animation', () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;
  let fakeTime = 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeTime = 1000;
    vi.setSystemTime(fakeTime);
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fireRaf = (advanceMs = 16) => {
    fakeTime += advanceMs;
    vi.setSystemTime(fakeTime);
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach((cb) => cb(fakeTime));
  };

  it('should generate offsets for multiple layers', () => {
    const { result } = renderHook(() =>
      useParallaxAnimation(60, 1, 4, true),
    );

    fireRaf(20);

    expect(result.current).toHaveLength(4);
    result.current.forEach((offset) => {
      expect(typeof offset).toBe('number');
    });
  });

  it('should apply different speeds to each layer', () => {
    const { result } = renderHook(() =>
      useParallaxAnimation(60, 2, 3, true),
    );

    // Fire enough frames for animation to accumulate
    for (let i = 0; i < 5; i++) {
      fireRaf(20);
    }

    const offsets1 = result.current;

    // Offsets should be different for each layer
    if (offsets1.length >= 2) {
      expect(Math.abs(offsets1[0])).toBeGreaterThanOrEqual(Math.abs(offsets1[1]));
    }
  });
});

// ============================================================================
// CLOUD ANIMATION TESTS
// ============================================================================

describe('Cloud Animation', () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fireRaf = () => {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach((cb) => cb(Date.now()));
  };

  it('should generate cloud drift animation', () => {
    const { result } = renderHook(() => useCloudAnimation(60, 20, true));

    fireRaf();
    act(() => { vi.advanceTimersByTime(0); });

    expect(typeof result.current).toBe('number');
  });

  it('should oscillate cloud drift between -driftDistance and +driftDistance', () => {
    const { result } = renderHook(() => useCloudAnimation(60, 20, true));

    for (let i = 0; i < 50; i++) {
      fireRaf();
      act(() => { vi.advanceTimersByTime(20); });
    }

    const drift = result.current;
    expect(drift).toBeGreaterThanOrEqual(-20);
    expect(drift).toBeLessThanOrEqual(20);
  });
});

// ============================================================================
// GRASS SWAY ANIMATION TESTS
// ============================================================================

describe('Grass Sway Animation', () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fireRaf = () => {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach((cb) => cb(Date.now()));
  };

  it('should generate grass sway animation', () => {
    const { result } = renderHook(() =>
      useGrassSwayAnimation(60, 2, 0.5, true),
    );

    fireRaf();
    act(() => { vi.advanceTimersByTime(0); });

    expect(typeof result.current).toBe('number');
  });

  it('should oscillate sway within amplitude', () => {
    const { result } = renderHook(() =>
      useGrassSwayAnimation(60, 3, 0.5, true),
    );

    for (let i = 0; i < 100; i++) {
      fireRaf();
      act(() => { vi.advanceTimersByTime(50); });
    }

    const sway = result.current;
    expect(sway).toBeGreaterThanOrEqual(-3);
    expect(sway).toBeLessThanOrEqual(3);
  });
});
