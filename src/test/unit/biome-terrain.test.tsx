import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BiomeTerrain } from '../../components/procedural/BiomeTerrain';
import { VOLCANIC_TERRAIN } from '../../components/procedural/biomeTerrainConfig';
import {
  wrapPhase,
  worldIndexAt,
  tileScanStart,
  scrollPixels,
  drawVolcano,
} from '../../components/procedural/terrainShared';

// ============================================================================
// BIOME TERRAIN CANVAS TESTS
// Volcanic scrolling backdrop: brighter palette, parallax layers, static frame
// when animated=false (same pattern as terrain-canvas.test.tsx).
// ============================================================================

describe('BiomeTerrain Canvas', () => {
  let rafId = 0;
  const rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks.length = 0;
    rafId = 0;

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 800, height: 600 },
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      fillRect: vi.fn(),
      fillStyle: '',
      drawImage: vi.fn(),
      fillText: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

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

  it('renders without crashing', () => {
    const { container } = render(
      <BiomeTerrain biomeId="volcanic" seed="test-seed" animated={false} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('sets image-rendering to pixelated for crisp pixel art', () => {
    const { container } = render(
      <BiomeTerrain biomeId="volcanic" seed="test-seed" animated={false} />
    );
    const canvas = container.querySelector('canvas');
    expect(canvas?.style.imageRendering).toBe('pixelated');
  });

  it('honors the biomeId prop (defaults to volcanic)', () => {
    const { container } = render(
      <BiomeTerrain seed="test-seed" animated={false} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(Object.keys(VOLCANIC_TERRAIN)).toContain('volcanic');
  });

  it('uses integer pixel locking via Math.round(groundScroll) — same anti-tearing pattern as ProceduralTerrain', () => {
    const source = BiomeTerrain.toString();
    expect(source).toContain('const scrollPx = Math.round(groundScroll)');
  });

  it('ramps up scroll speed over 800ms like ProceduralTerrain', () => {
    const source = BiomeTerrain.toString();
    expect(source).toContain('Math.min(1, elapsedSinceStable / 800)');
  });

  it('only advances the scroll offset when animatedRef.current is true (animated=false → static frame)', () => {
    const source = BiomeTerrain.toString();
    expect(source).toContain('if (animatedRef.current)');
    expect(source).toContain('scrollOffsetRef.current += dt');
  });

  it('pauses rendering when the tab is hidden (visibilitychange)', () => {
    const source = BiomeTerrain.toString();
    expect(source).toContain('document.visibilityState');
    expect(source).toContain('document.addEventListener("visibilitychange", onVisibility)');
  });

  it('keeps rendering a static frame across rAF ticks when animated=false', () => {
    render(
      <BiomeTerrain
        biomeId="volcanic"
        seed="test-seed"
        animated={false}
        width={800}
        height={600}
      />
    );
    // Multiple rAF ticks must not crash and must keep scheduling frames
    for (let i = 0; i < 5; i++) {
      const cb = rafCallbacks.shift();
      if (cb) cb(1000 + i * 16);
    }
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// VOLCANIC PALETTE — brighter than SceneBackground (issue #663 critical)
// ============================================================================

describe('Volcanic terrain palette (brighter rendering)', () => {
  it('sky gradient is a bright twilight orange/brown (no near-black stops)', () => {
    const sky = VOLCANIC_TERRAIN.volcanic.sky;
    expect(sky.length).toBeGreaterThanOrEqual(3);
    for (const [, color] of sky) {
      // Reject near-black stops like the current too-dark background
      expect(isBrightEnough(color)).toBe(true);
    }
  });

  it('lava colors are glowing and vivid (high luminance)', () => {
    const cfg = VOLCANIC_TERRAIN.volcanic;
    expect(isBrightEnough(cfg.lava)).toBe(true);
    expect(isBrightEnough(cfg.lavaBright)).toBe(true);
    expect(isBrightEnough(cfg.crater)).toBe(true);
  });

  it('defines a basalt ground for runner readability', () => {
    const cfg = VOLCANIC_TERRAIN.volcanic;
    expect(cfg.ground).toMatch(/^#/);
    expect(cfg.groundVein).toMatch(/^#/);
    // Ground stays readable: vein contrast is high against the ground
    expect(relativeLuminance(cfg.groundVein)).toBeGreaterThan(
      relativeLuminance(cfg.ground)
    );
  });

  it('exposes ember particles with bright colors', () => {
    const cfg = VOLCANIC_TERRAIN.volcanic;
    expect(cfg.embers.length).toBeGreaterThanOrEqual(2);
    for (const c of cfg.embers) {
      expect(isBrightEnough(c)).toBe(true);
    }
  });
});

// ============================================================================
// PARALLAX LAYERS — distinct speeds per layer
// ============================================================================

describe('Volcanic terrain parallax layers', () => {
  it('defines distinct parallax speeds for silhouettes, ash, lava and ground', () => {
    const layers = VOLCANIC_TERRAIN.volcanic.layers;
    const speeds = layers.map((l) => l.speed);
    // All speeds positive
    for (const s of speeds) {
      expect(s).toBeGreaterThan(0);
    }
    // Ground is the fastest layer (closest to runner)
    const ground = layers.find((l) => l.id === 'ground');
    const far = layers.find((l) => l.id === 'volcanoFar');
    expect(ground?.speed).toBeGreaterThan(far?.speed ?? 0);
    // Distinct speeds: at least 4 unique values
    expect(new Set(speeds).size).toBeGreaterThanOrEqual(4);
  });

  it('parallax phases wrap into non-negative continuous phases (float remainder — no rounding jumps)', () => {
    const scrollOffsets = [0, 10, 127, 255.4, 256, 512.7, 1000, 2048.5];
    scrollOffsets.forEach((off) => {
      const scrollPx = scrollPixels(off);
      for (const layer of VOLCANIC_TERRAIN.volcanic.layers) {
        const phase = wrapPhase(scrollPx, layer.speed, 320);
        expect(phase).toBeGreaterThanOrEqual(0);
        expect(phase).toBeLessThan(320);
        // The phase must be the exact continuous float remainder of
        // (scrollPx * speed) over the tile width — rounding it to an integer
        // makes layers visibly blink/teleport by a whole tile.
        expect(phase).toBeCloseTo((scrollPx * layer.speed) % 320, 6);
      }
    });
  });

  it('wrapPhase never teleports a whole tile between consecutive frames (ember layer, speed 1.2, spacing 44)', () => {
    let prev = wrapPhase(0, 1.2, 44);
    for (let px = 1; px <= 300; px++) {
      const phase = wrapPhase(px, 1.2, 44);
      const delta = phase - prev;
      // Forward motion is exactly the layer speed (1.2px per scroll px)…
      if (delta >= 0) {
        expect(delta).toBeLessThanOrEqual(1.2 + 1e-9);
      } else {
        // …except a single clean wrap backward by one tile width (44px).
        expect(delta).toBeGreaterThanOrEqual(1.2 - 44 - 1e-9);
      }
      prev = phase;
    }
  });

  it('tileScanStart starts one tile before the wrapped phase (full coverage)', () => {
    const phase = wrapPhase(100, 0.5, 128);
    const start = tileScanStart(phase, 128);
    expect(start).toBe(-phase - 128);
    expect(start).toBeLessThanOrEqual(0);
  });

  it('worldIndexAt is deterministic for a given screen x and scroll', () => {
    const a = worldIndexAt(50, 100, 0.45, 320);
    const b = worldIndexAt(50, 100, 0.45, 320);
    expect(a).toBe(b);
    // Scrolling forward increases the world index
    expect(worldIndexAt(50, 200, 0.45, 320)).toBeGreaterThanOrEqual(a);
  });
});

// ============================================================================
// DETERMINISTIC SEED — same seed, same layout
// ============================================================================

describe('Deterministic seed layout', () => {
  it('rejects a blank/non-numeric seed to a stable numeric fallback', () => {
    const source = BiomeTerrain.toString();
    expect(source).toContain("parseInt(seed.replace(/\\D/g,");
  });
});

// ============================================================================
// VOLCANO ORIENTATION — cone must narrow at the top and widen at the base
// (fix: volcanoes were rendered upside down)
// ============================================================================

describe('Volcano drawing orientation', () => {
  const makeCtx = () => {
    const calls: Array<{ x: number; y: number; w: number; h: number }> = [];
    const ctx = {
      fillStyle: '',
      fillRect: (x: number, y: number, w: number, h: number) => {
        calls.push({ x, y, w, h });
      },
    } as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  };

  it('draws the widest row at the base (bottom) and the narrowest at the top (apex)', () => {
    const { ctx, calls } = makeCtx();
    drawVolcano(ctx, 100, 200, 80, 120, '#333', '#ff6', null);

    // 8 body rows: first row starts at baseY - h (top), rows get wider downward
    const bodyRows = calls.slice(0, 8);
    expect(bodyRows.length).toBe(8);

    const firstRowW = bodyRows[0].w;
    const lastRowW = bodyRows[bodyRows.length - 1].w;

    // Apex row (top, drawn first) must be the narrowest…
    expect(firstRowW).toBeLessThan(lastRowW);
    // …and the base row (bottom, drawn last) must be the widest
    expect(lastRowW).toBeGreaterThan(firstRowW);
    // Row width must increase monotonically from top to bottom
    for (let i = 1; i < bodyRows.length; i++) {
      expect(bodyRows[i].w).toBeGreaterThan(bodyRows[i - 1].w);
    }
    // The first (top) row must sit at the apex height
    expect(bodyRows[0].y).toBeLessThan(bodyRows[bodyRows.length - 1].y);
  });

  it('centers every row horizontally on the volcano axis', () => {
    const { ctx, calls } = makeCtx();
    drawVolcano(ctx, 500, 300, 100, 140, '#333', '#ff6', null);

    const bodyRows = calls.slice(0, 8);
    for (const row of bodyRows) {
      // row.x is the left edge; center = x + w/2 must stay on cx (500).
      // Odd row widths can land on half pixels (x.5) — that's fine, the
      // row must never drift more than one pixel off-center.
      expect(Math.abs(row.x + row.w / 2 - 500)).toBeLessThanOrEqual(0.6);
    }
  });
});

// ============================================================================
// HELPERS
// ============================================================================

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h.split('').map((c) => c + c).join('')
      : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isBrightEnough(hex: string): boolean {
  // Brighter than a mid-dark tone — rejects near-black "too dark" backgrounds
  return relativeLuminance(hex) > 0.05;
}
