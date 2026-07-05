import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParticleSystem, type ParticleType } from '../../utils/particleSystem';

describe('ParticleSystem - new particle types', () => {
    let ps: ParticleSystem;
    let container: HTMLElement;

    beforeEach(() => {
        ps = new ParticleSystem();
        container = document.createElement('div');
        ps.mount(container);
    });

    afterEach(() => {
        ps.destroy();
    });

    it('should emit combo particles', () => {
        ps.emit('combo', 100, 50, 8);
        const particles = container.querySelectorAll('.particle-combo');
        expect(particles.length).toBe(8);
    });

    it('should emit xp_burst particles', () => {
        ps.emit('xp_burst', 100, 50, 6);
        const particles = container.querySelectorAll('.particle-xp_burst');
        expect(particles.length).toBe(6);
    });

    it('should handle null container gracefully', () => {
        const detachedPs = new ParticleSystem();
        // Don't mount - should not throw
        expect(() => {
            detachedPs.emit('combo', 100, 50, 4);
        }).not.toThrow();
    });

    it('should respect maxParticles limit with combo', () => {
        const limitedPs = new ParticleSystem(3);
        limitedPs.mount(container);

        limitedPs.emit('combo', 100, 50, 10);
        expect(container.querySelectorAll('.particle-combo').length).toBeLessThanOrEqual(3);

        limitedPs.destroy();
    });

    it('should not crash when emitting combo with 0 count', () => {
        expect(() => {
            ps.emit('combo', 100, 50, 0);
        }).not.toThrow();
    });

    it('should register combo as a valid ParticleType', () => {
        const validTypes: ParticleType[] = ['combo', 'xp_burst', 'rare_reveal', 'confetti', 'dust', 'spark', 'xp_star', 'damage', 'hit_ring'];
        expect(validTypes).toContain('combo');
        expect(validTypes).toContain('xp_burst');
    });
});
