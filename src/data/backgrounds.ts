// ============================================================================
// Background Engine — reusable pixel background system
// ----------------------------------------------------------------------------
// A background is a pure data `BackgroundDef` (gradient + decorative elements +
// accent colors). The `SceneBackground` component + `_scene-background.scss`
// render it in ANY window (raid boss combat, future biomes, menus…).
//
// To add a NEW background you only append a def to `BACKGROUNDS` — no component
// or CSS change required. Existing built-ins: `volcanic` (animated volcano) and
// `void_abyss` (the Void Titan raid arena).
// ============================================================================

export type BackgroundElementType =
    | 'halo'
    | 'star'
    | 'rock'
    | 'rune'
    | 'wisp'
    | 'peak'
    | 'lava'
    | 'ember'
    | 'smoke'
    | 'crack';

export type BackgroundElement = {
    type: BackgroundElementType;
    /** horizontal position, % of the window */
    x: number;
    /** vertical position, % of the window */
    y: number;
    /** base square size in px (pixel style) */
    size: number;
    /** optional width override (stretched elements: lava pools, cracks, peaks) */
    width?: number;
    /** optional height override */
    height?: number;
    /** base color */
    color: string;
    /** optional glow color (shadow behind the element) */
    glow?: string;
    /** animation duration in seconds (overrides the type default) */
    speed?: number;
    /** animation delay in seconds */
    delay?: number;
    /** rotation in degrees (CSS `rotate`, independent from the animation) */
    rotate?: number;
};

export type BackgroundDef = {
    /** unique background id (registered in BACKGROUNDS) */
    id: string;
    /** short uppercase label shown in the window corner tag (optional) */
    label?: string;
    /** window chrome accent color (border, glow, tag) */
    accent: string;
    /** secondary accent color (tag text…) */
    accentAlt?: string;
    /** CSS background of the base layer */
    gradient: string;
    /** decorative pixel elements */
    elements: BackgroundElement[];
};

// ─── VOLCANIC ARENA — magma caldera ──────────────────────────────────────────
// Glowing volcano silhouettes, crater magma (high up — never on the ground),
// dark basalt slabs at the base so the fighters stand on solid rock, dim
// magma veins, rising embers and smoke columns. Warm ember/orange palette
// over a charred night sky.
// Positioned for the raid boss arena: the active volcano sits CENTERED behind
// the fighters (x ~50%), flanking cones complete the composition. No corner
// badge — the scene must never mask the fighters.

export const VOLCANIC_BACKGROUND: BackgroundDef = {
    id: 'volcanic',
    accent: '#ff7b2e',
    accentAlt: '#ffd166',
    gradient:
        'radial-gradient(95% 55% at 50% 30%, rgba(255, 106, 41, 0.30) 0%, rgba(255, 106, 41, 0) 60%),' +
        'radial-gradient(150% 130% at 50% 110%, #2e121a 0%, #1c0c12 38%, #0b050d 72%, #050209 100%)',
    elements: [
        // Calder glow haze — high behind the summit.
        { type: 'halo', x: 50, y: 44, size: 215, color: 'rgba(255, 123, 46, 0.30)', speed: 3 },
        { type: 'halo', x: 50, y: 44, size: 118, color: 'rgba(255, 209, 102, 0.26)', speed: 2.2, delay: 0.6 },
        // Volcano silhouettes — main cone centered + flanking cones.
        { type: 'peak', x: 50, y: 88, size: 280, height: 205, color: '#1e0a12', speed: 7 },
        { type: 'peak', x: 20, y: 90, size: 130, height: 100, color: '#130610', speed: 8.5, delay: 0.4 },
        { type: 'peak', x: 80, y: 93, size: 130, height: 96, color: '#160710', speed: 9, delay: 0.9 },
        // Crater magma — SUMMIT ONLY (y ≤ 60), never reaches the floor.
        // Multiple overlapping irregular blobs = one rich molten pool, not ovals.
        { type: 'lava', x: 50, y: 40, size: 70, height: 12, color: '#ff9f1c', speed: 2.6 },
        { type: 'lava', x: 45, y: 43, size: 46, height: 9, color: '#ffd166', speed: 2.9, delay: 0.7 },
        { type: 'lava', x: 58, y: 40, size: 22, height: 6, color: '#ffb84d', speed: 3.1, delay: 1.1 },
        // Thin lava trickle spilling down the flank (still far above the ground).
        { type: 'lava', x: 57, y: 55, size: 14, width: 5, height: 24, color: '#ff8a2a', speed: 3.2, delay: 0.1 },
        // Granite ground — the fighters' solid basalt footing.
        { type: 'rock', x: 56, y: 94, size: 8, width: 480, height: 38, color: '#241016', speed: 6, delay: 1 },
        { type: 'rock', x: 50, y: 90, size: 8, width: 300, height: 14, color: '#170a11', speed: 6.5, delay: 0.5 },
        { type: 'rock', x: 10, y: 80, size: 26, color: '#1c0a12', speed: 7, delay: 0.5 },
        { type: 'rock', x: 20, y: 88, size: 16, color: '#120710', speed: 6.5, delay: 1.2 },
        { type: 'rock', x: 90, y: 82, size: 22, color: '#180a11', speed: 6.8, delay: 0.7 },
        { type: 'rock', x: 97, y: 89, size: 14, color: '#150a0e', speed: 7.2, delay: 1.5 },
        // A few dim magma veins inside the basalt (subtle, not pools).
        { type: 'crack', x: 34, y: 87, size: 5, width: 28, color: 'rgba(255, 107, 43, 0.45)', glow: 'rgba(255, 107, 43, 0.3)', speed: 2.4, delay: 0.4, rotate: -8 },
        { type: 'crack', x: 60, y: 92, size: 5, width: 24, color: 'rgba(255, 209, 102, 0.38)', glow: 'rgba(255, 209, 102, 0.28)', speed: 2.6, delay: 1.2, rotate: 7 },
        // Embers drifting up from the crater (upper band only).
        { type: 'ember', x: 50, y: 46, size: 4, color: '#ffd166', glow: 'rgba(255, 209, 102, 0.9)', speed: 8, delay: 0 },
        { type: 'ember', x: 54, y: 40, size: 3, color: '#ff9f1c', glow: 'rgba(255, 159, 28, 0.9)', speed: 9, delay: 0.8 },
        { type: 'ember', x: 46, y: 42, size: 3, color: '#ffb84d', glow: 'rgba(255, 184, 77, 0.9)', speed: 7.5, delay: 1.6 },
        { type: 'ember', x: 58, y: 36, size: 2, color: '#ffd166', glow: 'rgba(255, 209, 102, 0.9)', speed: 10, delay: 2.3 },
        { type: 'ember', x: 42, y: 50, size: 2, color: '#ff6b2b', glow: 'rgba(255, 107, 43, 0.8)', speed: 8.5, delay: 1.0 },
        { type: 'ember', x: 62, y: 52, size: 2, color: '#ffd166', glow: 'rgba(255, 209, 102, 0.8)', speed: 9, delay: 0.4 },
        // Smoke columns drifting from the summit.
        { type: 'smoke', x: 50, y: 38, size: 26, color: 'rgba(128, 96, 104, 0.5)', speed: 10, delay: 0.2 },
        { type: 'smoke', x: 56, y: 34, size: 18, color: 'rgba(112, 86, 96, 0.45)', speed: 12, delay: 2.1 },
        { type: 'smoke', x: 22, y: 52, size: 22, color: 'rgba(118, 94, 102, 0.4)', speed: 11, delay: 1.2 },
        { type: 'smoke', x: 78, y: 60, size: 16, color: 'rgba(100, 78, 88, 0.4)', speed: 12, delay: 0.9 },
    ],
};

// ─── VOID ABYSS — Void Titan arena (dark raid theme) ─────────────────────────

export const VOID_ABYSS_BACKGROUND: BackgroundDef = {
    id: 'void_abyss',
    label: 'RAID BOSS',
    accent: '#8a4bd8',
    accentAlt: '#31d8ff',
    gradient:
        'radial-gradient(120% 100% at 50% 8%, #241448 0%, #170b2e 38%, #0a0416 78%, #04020a 100%)',
    elements: [
        // Central void rift — nested halos behind the boss.
        { type: 'halo', x: 72, y: 32, size: 160, color: 'rgba(138, 75, 216, 0.55)', speed: 4 },
        { type: 'halo', x: 72, y: 32, size: 92, color: 'rgba(49, 216, 255, 0.30)', speed: 3, delay: 0.8 },
        // Starfield (twinkle).
        { type: 'star', x: 8, y: 14, size: 3, color: '#f2e9ff', delay: 0.2 },
        { type: 'star', x: 22, y: 8, size: 2, color: '#31d8ff', delay: 0.6 },
        { type: 'star', x: 38, y: 18, size: 3, color: '#c4b5fd', delay: 1.1 },
        { type: 'star', x: 55, y: 9, size: 2, color: '#f2e9ff', delay: 0.4 },
        { type: 'star', x: 68, y: 20, size: 3, color: '#31d8ff', delay: 1.4 },
        { type: 'star', x: 85, y: 12, size: 2, color: '#c4b5fd', delay: 0.9 },
        { type: 'star', x: 93, y: 26, size: 3, color: '#f2e9ff', delay: 1.7 },
        { type: 'star', x: 12, y: 34, size: 2, color: '#31d8ff', delay: 2.1 },
        { type: 'star', x: 88, y: 40, size: 2, color: '#c4b5fd', delay: 0.3 },
        // Floating void rocks.
        { type: 'rock', x: 6, y: 58, size: 22, color: '#2b1646', speed: 6, delay: 0.4 },
        { type: 'rock', x: 15, y: 70, size: 14, color: '#120a24', speed: 7, delay: 1.2 },
        { type: 'rock', x: 88, y: 62, size: 18, color: '#2b1646', speed: 6.5, delay: 0.8 },
        { type: 'rock', x: 81, y: 78, size: 12, color: '#120a24', speed: 5.5, delay: 1.6 },
        // Corrupted runes glowing at ground level.
        { type: 'rune', x: 22, y: 82, size: 10, color: '#ff3b4e', glow: 'rgba(255, 59, 78, 0.7)', speed: 2.4, delay: 0.2 },
        { type: 'rune', x: 78, y: 84, size: 10, color: '#ff3b4e', glow: 'rgba(255, 59, 78, 0.7)', speed: 2.4, delay: 1.3 },
        { type: 'rune', x: 50, y: 86, size: 8, color: '#8a4bd8', glow: 'rgba(138, 75, 216, 0.7)', speed: 2.8, delay: 0.7 },
        // Soul wisps drifting upward.
        { type: 'wisp', x: 30, y: 70, size: 5, color: '#31d8ff', glow: 'rgba(49, 216, 255, 0.8)', speed: 9, delay: 0.5 },
        { type: 'wisp', x: 62, y: 76, size: 4, color: '#c4b5fd', glow: 'rgba(196, 181, 253, 0.8)', speed: 11, delay: 2.2 },
    ],
};

// ─── Registry ────────────────────────────────────────────────────────────────
// Add new backgrounds here — the engine picks them up automatically.

export const BACKGROUNDS: Record<string, BackgroundDef> = {
    volcanic: VOLCANIC_BACKGROUND,
    void_abyss: VOID_ABYSS_BACKGROUND,
};

export function getBackgroundDef(id: string): BackgroundDef | undefined {
    return BACKGROUNDS[id];
}