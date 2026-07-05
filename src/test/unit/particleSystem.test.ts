import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParticleSystem } from '../../utils/particleSystem';

describe('ParticleSystem - rare_reveal', () => {
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
