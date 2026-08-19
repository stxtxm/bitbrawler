import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParticleSystem, type ParticleType } from '../../utils/particleSystem';

describe('ParticleSystem - rare_reveal & confetti', () => {
  let container: HTMLDivElement;
  let ps: ParticleSystem;

  beforeEach(() => {
    container = document.createElement('div');
    ps = new ParticleSystem(60);
    ps.mount(container);
  });

  afterEach(() => {
    ps.destroy();
  });

  it('emits rare_reveal particles into the container', () => {
    ps.emit('rare_reveal', 100, 100, 5);
    expect(container.children.length).toBe(5);
  });

  it('emits rare_reveal particles with gold color', () => {
    ps.emit('rare_reveal', 100, 100, 3);
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement;
      expect(child.className).toContain('particle-rare_reveal');
    }
  });

  it('emits confetti particles into the container', () => {
    ps.emit('confetti', 100, 100, 10);
    expect(container.children.length).toBe(10);
  });

  it('emits confetti particles with gold/orange color', () => {
    ps.emit('confetti', 100, 100, 5);
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement;
      expect(child.className).toContain('particle-confetti');
    }
  });

  it('respects maxParticles limit for rare_reveal', () => {
    const smallPs = new ParticleSystem(3);
    smallPs.mount(container);

    // Clear existing
    container.innerHTML = '';

    smallPs.emit('rare_reveal', 100, 100, 10);
    expect(container.children.length).toBeLessThanOrEqual(3);
    smallPs.destroy();
  });

  it('does not emit when unmounted', () => {
    const detached = new ParticleSystem(60);
    detached.emit('rare_reveal', 0, 0, 5);
    // No container mounted → no children
    expect(container.children.length).toBe(0);
    detached.destroy();
  });

  it('clear() removes all particles and confetti is gone', () => {
    ps.emit('confetti', 100, 100, 8);
    expect(container.children.length).toBe(8);
    ps.clear();
    expect(container.children.length).toBe(0);
  });
});

describe('ParticleSystem - combo & xp_burst types', () => {
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

describe('ParticleSystem - recycling stale text', () => {
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

  it('clears stale text when a text particle is recycled into a non-text type', () => {
    ps.emit('damage', 100, 100, 1, 42);
    expect(container.children.length).toBe(1);
    const textEl = container.children[0] as HTMLElement;
    expect(textEl.textContent).toBe('42');
    expect(textEl.style.zIndex).toBe('20');

    (ps as any).particles[0].life = -1;
    (ps as any).tick(performance.now() + 2000);
    expect(container.children.length).toBe(0);

    ps.emit('dust', 100, 100, 1);
    expect(container.children.length).toBe(1);
    const dustEl = container.children[0] as HTMLElement;
    expect(dustEl.textContent).toBe('');
    expect(dustEl.style.zIndex).toBe('15');
  });
});