import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SceneBackground } from '../../components/SceneBackground';
import { BACKGROUNDS, getBackgroundDef, VOLCANIC_BACKGROUND } from '../../data/backgrounds';
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
});

describe('SceneBackground — renderer', () => {
    it('renders gradient layer, element layer, vignette and corner tag', () => {
        const { container } = render(<SceneBackground def={VOLCANIC_BACKGROUND} />);

        expect(container.querySelector('.scene-bg')).not.toBeNull();
        expect(container.querySelector('.scene-bg-gradient')).not.toBeNull();
        expect(container.querySelector('.scene-bg-vignette')).not.toBeNull();
        expect(container.querySelectorAll('.scene-bg-el').length).toBe(VOLCANIC_BACKGROUND.elements.length);
        expect(container.querySelector('.scene-bg-tag')?.textContent).toContain('VOLCANO');
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
        const { container } = render(<SceneBackground def={VOLCANIC_BACKGROUND} />);
        const root = container.querySelector<HTMLElement>('.scene-bg-root');
        expect(root).not.toBeNull();
        const rootVars = root?.style.cssText ?? '';
        expect(rootVars).toContain('--scene-accent');
        expect(rootVars).toContain(VOLCANIC_BACKGROUND.accent);
        // The tag is INSIDE the wrapper → inherits the accent vars.
        const tag = root?.querySelector('.scene-bg-tag');
        expect(tag).not.toBeNull();
        expect(
            String(
                (tag?.parentElement instanceof HTMLElement && tag?.parentElement.getAttribute('style')) ?? '',
            ),
        ).toContain('--scene-accent');
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