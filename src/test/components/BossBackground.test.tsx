import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BossBackground } from '../../components/BossBackground';
import { BOSS_ASSETS, BOSS_ID, getBossDef } from '../../data/bossAssets';

describe('BossBackground engine', () => {
    it('every boss in BOSS_ASSETS declares a complete background def', () => {
        expect(BOSS_ASSETS.length).toBeGreaterThan(0);
        for (const boss of BOSS_ASSETS) {
            expect(boss.background, `${boss.id} must declare a background`).toBeDefined();
            expect(boss.background.id).toBeTruthy();
            expect(boss.background.accent).toBeTruthy();
            expect(boss.background.gradient).toContain('gradient');
            expect(boss.background.elements.length).toBeGreaterThan(0);
        }
    });

    it('renders gradient, elements, corner tag and vignette for VOID TITAN', () => {
        const def = getBossDef(BOSS_ID);
        expect(def).toBeDefined();
        if (!def) return;

        const { container } = render(<BossBackground def={def.background} />);

        expect(container.querySelector('.boss-bg')).not.toBeNull();
        expect(container.querySelector('.boss-bg-gradient')).not.toBeNull();
        expect(container.querySelector('.boss-bg-vignette')).not.toBeNull();
        expect(container.querySelectorAll('.boss-bg-el').length).toBe(def.background.elements.length);
        expect(container.querySelector('.boss-bg-tag')?.textContent).toContain('RAID');
    });

    it('applies per-element position, size and animation timing', () => {
        const def = getBossDef(BOSS_ID);
        if (!def) return;
        const { container } = render(<BossBackground def={def.background} />);

        const elements = Array.from(container.querySelectorAll<HTMLElement>('.boss-bg-el'));
        const wisp = elements.find((el) => el.classList.contains('bg-el-wisp'));
        expect(wisp).toBeDefined();
        if (!wisp) return;

        // Wisp rise animation is linear and slow (drifting soul).
        expect(wisp.style.animationDuration).not.toBe('');
        expect(wisp.style.left).toMatch(/%$/);
        expect(wisp.style.top).toMatch(/%$/);
    });
});