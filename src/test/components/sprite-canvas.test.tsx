import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { SpriteCanvas, SPRITE_IDLE_MS, SPRITE_RUN_MS } from '../../components/sprite/SpriteCanvas';
import { WEAPON_ANGLES, WEAPON_REST_ANGLE, weaponAngleFor, weaponStrikeAngle } from '../../components/sprite/weaponPoses';
import { PixelGridCanvas } from '../../components/sprite/PixelGridCanvas';
import { spritePixelScale } from '../../components/sprite/spritePixelScale';
import { IDLE_BLINK_FRAME, IDLE_BLINK_MS, generateSpriteFrames } from '../../components/sprite/spriteGenerator';
import { applyEquipmentOverlays } from '../../components/sprite/equipOverlays';

const perf = vi.hoisted(() => ({ low: false }));

vi.mock('../../hooks/useLowPerformanceMode', () => ({
  useLowPerformanceMode: () => perf.low,
}));

vi.mock('../../components/sprite/spriteGenerator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/sprite/spriteGenerator')>();
  return { ...actual, generateSpriteFrames: vi.fn(actual.generateSpriteFrames) };
});

vi.mock('../../components/sprite/equipOverlays', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/sprite/equipOverlays')>();
  return { ...actual, applyEquipmentOverlays: vi.fn(actual.applyEquipmentOverlays) };
});

beforeEach(() => {
  perf.low = false;
  vi.clearAllMocks();
});

describe('SpriteCanvas', () => {
  it('renders on an integer pixel grid (pixel-perfect)', () => {
    const { container } = render(<SpriteCanvas seed="canvas-hero" gender="male" scale={4} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    const w = Number(canvas?.getAttribute('width'));
    const h = Number(canvas?.getAttribute('height'));
    // Sans boîte CSS, la cible reste la taille intrinsèque historique
    // (grille 24×42 × (scale/2) × SPRITE_DISPLAY_SCALE) arrondie au nombre
    // ENTIER de pixels physiques : fini l'échelle fractionnaire (2,3 ici) qui
    // donnait des pixels de tailles inégales — c'est cette irrégularité qui
    // faisait « grésiller » les animations.
    expect(w).toBe(48);
    expect(h).toBe(84);
    expect(w / 24).toBe(h / 42); // ratio natif du sprite, aucun étirement
    expect(Number.isInteger(w / 24)).toBe(true); // pixels physiques entiers
    expect(canvas?.style.width).toBe('48px');
    expect(canvas?.style.height).toBe('84px');
  });

  it('déduit l’échelle entière de la boîte CSS et du DPR du téléphone', () => {
    const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (prop: string) => (prop === '--sprite-box-h' ? '108px' : ''),
    } as unknown as CSSStyleDeclaration);
    const prevDpr = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 2.625, configurable: true });
    try {
      const { container } = render(<SpriteCanvas seed="canvas-hero" gender="male" scale={6} />);
      const canvas = container.querySelector('canvas');
      // 108 px CSS × 2,625 / 42 lignes = 6,75 → 7 px physiques par pixel de
      // sprite : 7 est entier, donc chaque pixel reste carré et régulier.
      expect(canvas?.getAttribute('width')).toBe(String(24 * 7));
      expect(canvas?.getAttribute('height')).toBe(String(42 * 7));
      // Affiché à sa taille physique exacte → aucun rééchantillonnage.
      expect(canvas?.style.width).toBe(`${(24 * 7) / 2.625}px`);
      expect(canvas?.style.height).toBe(`${(42 * 7) / 2.625}px`);
    } finally {
      spy.mockRestore();
      Object.defineProperty(window, 'devicePixelRatio', { value: prevDpr, configurable: true });
    }
  });

  it('flags baked glow when aura is set, without css filters', () => {
    const { container } = render(<SpriteCanvas seed="aura-hero" gender="female" aura="fire" />);
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('data-glow')).toBe('on');
    expect(canvas?.style.filter ?? '').not.toContain('drop-shadow');
  });

  it('renders without crashing when equipped items are unknown ids', () => {
    const { container } = render(
      <SpriteCanvas
        seed="gear-hero"
        gender="male"
        equippedItems={{ weapon: 'nope', armor: null, accessory: null }}
      />,
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('cycles animation frames on a timer and cleans up on unmount', () => {
    vi.useFakeTimers();
    const { container, unmount } = render(
      <SpriteCanvas seed="anim-hero" gender="female" animate="run" />,
    );
    expect(container.querySelector('canvas')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector('canvas')).not.toBeNull();
    unmount();
    vi.useRealTimers();
  });

  it('scales attack frames with combat speed so the impact frame still lines up', () => {
    vi.useFakeTimers();
    render(
      <SpriteCanvas
        seed="speed-attack-hero"
        gender="male"
        animate="attack"
        speed={2}
        equippedItems={{ weapon: 'rusty_sword', armor: null, accessory: null }}
      />,
    );

    // La frame d'impact prend l'amplitude mesurée pour l'arme équipée
    // (épée rouillée → famille « blade »), sinon la pointe sort de la grille.
    const usedImpactAngle = () =>
      vi
        .mocked(applyEquipmentOverlays)
        .mock.calls.some((call) => call[3]?.weaponAngle === weaponStrikeAngle('blade'));

    // 130 ms per attack frame at x1 → 65 ms at x2. Frame 3 is the impact.
    act(() => {
      vi.advanceTimersByTime(194);
    });
    expect(usedImpactAngle()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(usedImpactAngle()).toBe(true);

    vi.useRealTimers();
  });

  it('keeps the weapon anchored to the hand during the run (no fake sway)', () => {
    vi.useFakeTimers();
    render(
      <SpriteCanvas
        seed="weapon-run-hero"
        gender="male"
        animate="run"
        equippedItems={{ weapon: 'rusty_sword', armor: null, accessory: null }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const calls = vi.mocked(applyEquipmentOverlays).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const opts = call[3] as { swayX?: number; weaponAngle?: number } | undefined;
      // The hilt never slides through the fist and the arm is glued to the
      // body during the run: rotating the weapon by itself there read as a
      // floppy rubber prop. The run pose keeps the rigid rest angle.
      expect(opts?.swayX ?? 0).toBe(0);
      expect(opts?.weaponAngle ?? WEAPON_REST_ANGLE).toBe(WEAPON_REST_ANGLE);
    }
    vi.useRealTimers();
  });

  it('plans a rigid whole-weapon angle for every animation', () => {
    expect(weaponAngleFor('idle', 7)).toBe(WEAPON_REST_ANGLE);
    expect(weaponAngleFor('run', 1)).toBe(WEAPON_REST_ANGLE);
    expect(weaponAngleFor('run', 4)).toBe(WEAPON_REST_ANGLE);
    expect(weaponAngleFor('attack', 3)).not.toBe(WEAPON_REST_ANGLE);
    expect(weaponAngleFor('victory', 2)).not.toBe(WEAPON_REST_ANGLE);
    expect(weaponAngleFor('hit', 1)).toBeGreaterThan(WEAPON_REST_ANGLE);
    expect(WEAPON_ANGLES.attack.length).toBe(5);
    // Recul et garde au repos, chambre à la verticale : la frappe est le seul
    // écart vers l'extérieur. Reculer le poing ne fait pas pivoter l'arme (le
    // bord droit de la grille est déjà atteint), c'est la chambre qui l'arme.
    expect(weaponAngleFor('attack', 1)).toBe(WEAPON_REST_ANGLE);
    expect(weaponAngleFor('attack', 2)).toBeLessThan(WEAPON_REST_ANGLE);
    expect(weaponAngleFor('attack', 3)).toBeGreaterThan(WEAPON_REST_ANGLE);
    expect(weaponAngleFor('attack', 4)).toBe(WEAPON_REST_ANGLE);
  });

  it("donne à chaque famille d'arme l'amplitude de frappe que la grille permet", () => {
    // 24 px de large, arme tenue sur le bord droit : une dague courte peut
    // balayer bien plus qu'un bâton, sinon la pointe sort du sprite et se fait
    // couper. C'est cette table qui décide de l'amplitude réelle en jeu.
    expect(weaponStrikeAngle('dagger')).toBeGreaterThan(weaponStrikeAngle('blade'));
    expect(weaponStrikeAngle('blade')).toBeGreaterThan(weaponStrikeAngle('staff'));
    expect(weaponStrikeAngle('staff')).toBeGreaterThan(0);
    // Plus ample que la garde, sinon la frappe ne se voit pas.
    for (const kind of ['blade', 'dagger', 'scepter', 'staff', 'spear', 'haft', 'scythe', 'bow'] as const) {
      expect(weaponStrikeAngle(kind)).toBeGreaterThan(WEAPON_REST_ANGLE * 0.4);
    }
    // Repli quand l'arme est inconnue (pas d'équipement résolu).
    expect(weaponStrikeAngle()).toBe(WEAPON_ANGLES.attack[3]);
  });
});

describe('SpriteCanvas liveliness', () => {
  it('keeps the mobile-first run and idle timings', () => {
    expect(SPRITE_RUN_MS).toBe(120);
    // Respiration posée : 400 ms par palier (l'ancien 280 ms gigotait).
    expect(SPRITE_IDLE_MS).toBe(400);
  });

  it("donne à la frame de clignement sa propre durée, plus courte que la respiration", () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const delays = (): number[] => spy.mock.calls.map(([, ms]) => Number(ms));
    render(<SpriteCanvas seed="blink-hero" gender="male" animate="idle" />);
    expect(delays()).toContain(SPRITE_IDLE_MS);
    expect(delays()).not.toContain(IDLE_BLINK_MS);
    for (let i = 0; i < IDLE_BLINK_FRAME; i++) {
      act(() => {
        vi.advanceTimersByTime(SPRITE_IDLE_MS);
      });
    }
    // Arrivé sur la frame de clignement, le minuteur passe à sa durée propre.
    expect(delays()).toContain(IDLE_BLINK_MS);
    spy.mockRestore();
    vi.useRealTimers();
  });

  it('builds animation frames when performance allows', () => {
    perf.low = false;
    render(<SpriteCanvas seed="hi-hero" gender="male" animate="run" />);
    expect(generateSpriteFrames).toHaveBeenCalled();
  });

  it('disables animation frames in low performance mode', () => {
    perf.low = true;
    render(<SpriteCanvas seed="low-hero" gender="male" animate="run" />);
    expect(generateSpriteFrames).not.toHaveBeenCalled();
  });

  it('disables attack frames too in low performance mode', () => {
    perf.low = true;
    render(<SpriteCanvas seed="low-attack" gender="male" animate="attack" />);
    expect(generateSpriteFrames).not.toHaveBeenCalled();
  });
});

describe('PixelGridCanvas', () => {
  it('renders any grid at the requested scale', () => {
    const { container } = render(
      <PixelGridCanvas grid={[[1, 0], [0, 1]]} palette={{ 1: '#ff0000' }} scale={8} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('width')).toBe('16');
    expect(canvas?.getAttribute('height')).toBe('16');
  });

  it('choisit toujours un nombre entier de pixels physiques par pixel de sprite', () => {
    // Boîte CSS de 108 px sur un Pixel 9a (DPR 2,625) : 108 × 2,625 / 42 = 6,75.
    expect(spritePixelScale({ boxHeight: 108, gridHeight: 42, fallbackScale: 3.45, dpr: 2.625 })).toBe(7);
    // Même boîte sur un écran DPR 1 : 108 / 42 = 2,57 → 3.
    expect(spritePixelScale({ boxHeight: 108, gridHeight: 42, fallbackScale: 3.45, dpr: 1 })).toBe(3);
    // Plus petit écran : 84 px de haut → 84 × 2,625 / 42 = 5,25 → 5.
    expect(spritePixelScale({ boxHeight: 84, gridHeight: 42, fallbackScale: 3.45, dpr: 2.625 })).toBe(5);
    // Sans boîte CSS, la cible est la taille intrinsèque historique, en px CSS.
    expect(spritePixelScale({ boxHeight: null, gridHeight: 42, fallbackScale: 2.875, dpr: 2.625 })).toBe(8);
    // Jamais zéro pixel (boîte minuscule) ni division par une grille vide.
    expect(spritePixelScale({ boxHeight: 8, gridHeight: 42, fallbackScale: 1, dpr: 1 })).toBe(1);
    expect(spritePixelScale({ boxHeight: null, gridHeight: 0, fallbackScale: 4, dpr: 2 })).toBe(1);
  });
});
