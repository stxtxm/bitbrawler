import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SceneBackground } from '../../components/SceneBackground';
import { BACKGROUNDS, getBackgroundDef, VOLCANIC_BACKGROUND, VOID_ABYSS_BACKGROUND } from '../../data/backgrounds';
import { BOSS_ASSETS } from '../../data/bossAssets';
import { BackgroundDef, BackgroundElementType } from '../../data/backgrounds';

const ALL_ELEMENT_TYPES: BackgroundElementType[] = [
    'halo', 'star', 'rock', 'rune', 'wisp', 'peak', 'lava', 'ember', 'smoke', 'crack',
];

const minimalDef = (types: BackgroundElementType[], label?: string): BackgroundDef => ({
    id: 'test_scene',
    label,
    accent: '#ff7b2e',
    gradient: 'linear-gradient(#000, #222)',
    elements: types.map((type, i) => ({
        type,
        x: 10 + i * 8,
        y: 20,
        size: 6,
        color: '#ffffff',
    })),
});

describe('Background engine — registry', () => {
    it('every registered background is a complete, renderable def', () => {
        const ids = Object.keys(BACKGROUNDS);
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
            const def = BACKGROUNDS[id];
            expect(def.id).toBe(id);
            expect(def.accent).toBeTruthy();
            expect(def.gradient).toContain('gradient');
            expect(def.elements.length).toBeGreaterThan(0);
            for (const el of def.elements) {
                expect(ALL_ELEMENT_TYPES).toContain(el.type);
                expect(el.x).toBeGreaterThanOrEqual(0);
                expect(el.x).toBeLessThanOrEqual(100);
                expect(el.y).toBeGreaterThanOrEqual(0);
                expect(el.y).toBeLessThanOrEqual(100);
                expect(el.size).toBeGreaterThan(0);
            }
        }
    });

    it('supports multiple re-usable backgrounds (volcanic + others)', () => {
        expect(Object.keys(BACKGROUNDS).length).toBeGreaterThanOrEqual(2);
        expect(getBackgroundDef('volcanic')).toBeDefined();
    });

    it('returns undefined for an unknown background id', () => {
        expect(getBackgroundDef('does_not_exist')).toBeUndefined();
    });

    it('every boss references a background registered in the engine', () => {
        for (const boss of BOSS_ASSETS) {
            const def = getBackgroundDef(boss.background.id);
            expect(def, `${boss.id} uses unregistered background ${boss.background.id}`).toBeDefined();
            expect(boss.background).toBe(def);
        }
    });

    it('volcanic background uses the volcanic element vocabulary', () => {
        const types = VOLCANIC_BACKGROUND.elements.map((el) => el.type);
        expect(types).toContain('peak');
        expect(types).toContain('lava');
        expect(types).toContain('ember');
        expect(types).toContain('smoke');
        expect(types).toContain('crack');
    });

    it('volcanic background carries no badge label (it must not mask the fight)', () => {
        expect(VOLCANIC_BACKGROUND.label).toBeUndefined();
    });

    it('volcanic lava stays OFF the ground line so fighters stand on rock', () => {
        const lavas = VOLCANIC_BACKGROUND.elements.filter((el) => el.type === 'lava');
        expect(lavas.length).toBeGreaterThan(0);
        for (const lava of lavas) {
            expect(lava.y).toBeLessThanOrEqual(60);
        }
        // A wide basalt slab grounds the fighters.
        const ground = VOLCANIC_BACKGROUND.elements
            .find((el) => el.type === 'rock' && (el.width ?? 0) >= 400);
        expect(ground).toBeDefined();
        expect((ground?.y ?? 0)).toBeGreaterThanOrEqual(80);
    });
});

describe('SceneBackground — renderer', () => {
    it('renders gradient layer, element layer, vignette and corner tag', () => {
        const { container } = render(<SceneBackground def={VOID_ABYSS_BACKGROUND} />);

        expect(container.querySelector('.scene-bg')).not.toBeNull();
        expect(container.querySelector('.scene-bg-gradient')).not.toBeNull();
        expect(container.querySelector('.scene-bg-vignette')).not.toBeNull();
        expect(container.querySelectorAll('.scene-bg-el').length).toBe(VOID_ABYSS_BACKGROUND.elements.length);
        expect(container.querySelector('.scene-bg-tag')?.textContent).toContain('RAID BOSS');
    });

    it('omits the corner tag when the def has no label', () => {
        const { container } = render(<SceneBackground def={minimalDef(['star'])} />);
        expect(container.querySelector('.scene-bg-tag')).toBeNull();
    });

    it('renders every supported element type without errors', () => {
        const def = minimalDef(ALL_ELEMENT_TYPES);
        const { container } = render(<SceneBackground def={def} />);
        expect(container.querySelectorAll('.scene-bg-el').length).toBe(ALL_ELEMENT_TYPES.length);
    });

    it('applies per-element position, size and animation timing', () => {
        const { container } = render(<SceneBackground def={VOLCANIC_BACKGROUND} />);
        const elements = Array.from(container.querySelectorAll<HTMLElement>('.scene-bg-el'));
        const ember = elements.find((el) => el.classList.contains('bg-el-ember'));
        expect(ember).toBeDefined();
        if (!ember) return;
        expect(ember.style.animationDuration).not.toBe('');
        expect(ember.style.left).toMatch(/%$/);
        expect(ember.style.top).toMatch(/%$/);
    });

    it('exposes width/height overrides for stretched elements (lava, crack, peak)', () => {
        const { container } = render(<SceneBackground def={VOLCANIC_BACKGROUND} />);
        const lava = Array.from(container.querySelectorAll<HTMLElement>('.scene-bg-el'))
            .find((el) => el.classList.contains('bg-el-lava'));
        expect(lava).toBeDefined();
        if (!lava) return;
        expect(Number.parseInt(lava.style.width, 10)).toBeGreaterThan(0);
        expect(lava.style.width).not.toBe(lava.style.height);
    });

    it('exposes accent vars on the root so the corner tag inherits them', () => {
        const { container } = render(<SceneBackground def={VOID_ABYSS_BACKGROUND} />);
        const root = container.querySelector<HTMLElement>('.scene-bg-root');
        expect(root).not.toBeNull();
        const rootVars = root?.style.cssText ?? '';
        expect(rootVars).toContain('--scene-accent');
        expect(rootVars).toContain(VOID_ABYSS_BACKGROUND.accent);
        // The tag is a SIBLING of the root (never z-clipped by its stacking
        // context) and carries its own vars.
        const tag = container.querySelector<HTMLElement>('.scene-bg-tag');
        expect(tag).not.toBeNull();
        const tagVars = tag?.style.cssText ?? '';
        expect(tagVars).toContain('--scene-accent');
        expect(tagVars).toContain(VOID_ABYSS_BACKGROUND.accent);
        // Root is aria-hidden (decorative), tag is not.
        expect(root?.getAttribute('aria-hidden')).toBe('true');
        expect(tag?.getAttribute('aria-hidden')).toBeNull();
    });

    it('renders the corner tag as a sibling AFTER the scene root', () => {
        const { container } = render(<SceneBackground def={VOID_ABYSS_BACKGROUND} />);
        const root = container.querySelector('.scene-bg-root');
        expect(root?.nextElementSibling?.classList.contains('scene-bg-tag')).toBe(true);
    });

    it('sets --bg-el-color from the element color for peak shaping', () => {
        const { container } = render(<SceneBackground def={VOLCANIC_BACKGROUND} />);
        const peak = Array.from(container.querySelectorAll<HTMLElement>('.scene-bg-el'))
            .find((el) => el.classList.contains('bg-el-peak'));
        expect(peak).toBeDefined();
        if (!peak) return;
        expect(peak.style.cssText).toContain('--bg-el-color');
    });
});