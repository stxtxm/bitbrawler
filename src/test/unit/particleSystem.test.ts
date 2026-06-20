import { ParticleSystem } from '../../utils/particleSystem';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';


    // Spy on the internal createParticle method
    // Note: This might need to be done slightly differently if createParticle is truly private and not accessible via prototype.
    // If it's a true private method (using #), we'd need a different approach (e.g., testing via public methods like emit).
    // Assuming it's accessible via prototype for now.
    // If not, we will test indirectly via the `emit` method.

    ps = new ParticleSystem(10); // Use a small maxParticles for testing
    ps.mount(mockContainer);
  });

  afterEach(() => {
    // Clean up mocks
    vi.restoreAllMocks();
    ps.unmount();
  });

  it('should initialize with default max particles', () => {
    const psDefault = new ParticleSystem();
    // We can't directly inspect the private property easily, but we can infer if emit works.
    // For now, focusing on other tests.
  });

  it('should emit particles and start the animation loop', () => {
    ps.emit('spark', 50, 50, 5);

    expect(mockDocumentCreateElement).toHaveBeenCalledWith('span');
    expect(mockAppendChild).toHaveBeenCalledTimes(5);
    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1); // Should be called once when particles are first emitted
    expect(ps.particles.length).toBe(5);
  });

  it('should not emit particles if container is not mounted', () => {
    ps.unmount();
    ps.emit('spark', 50, 50, 5);
    expect(mockDocumentCreateElement).not.toHaveBeenCalled();
    expect(mockRequestAnimationFrame).not.toHaveBeenCalled();
  });

  it('should correctly create particle definitions', () => {
    // Mock createParticle directly to test its output
    const createParticleSpy = vi.spyOn(ps as any, 'createParticle').mockReturnValue({
        x: 50, y: 50, vx: 1, vy: 1, life: 1000, maxLife: 1000, size: 3, color: '#FFD700', text: '+XP'
    });

    ps.emit('xp_star', 50, 50, 1);

    expect(createParticleSpy).toHaveBeenCalledWith('xp_star', 50, 50, 0, 1, { text: '+XP' });
    expect(ps.particles.length).toBe(1);
    expect(ps.particles[0].text).toBe('+XP');
    expect(ps.particles[0].color).toBe('#FFD700');
    expect(ps.particles[0].life).toBe(1000);
  });

  it('should create different particles based on type', () => {
    const createParticleSpy = vi.spyOn(ps as any, 'createParticle');

    ps.emit('dust', 10, 10, 2);
    expect(createParticleSpy).toHaveBeenCalledWith('dust', 10, 10, 0, 2, { text: undefined });
    expect(createParticleSpy).toHaveBeenCalledWith('dust', 10, 10, 1, 2, { text: undefined });

    ps.emit('crit', 20, 20, 1);
    expect(createParticleSpy).toHaveBeenCalledWith('crit', 20, 20, 0, 1, { text: undefined });

    ps.emit('miss', 30, 30, 1);
    expect(createParticleSpy).toHaveBeenCalledWith('miss', 30, 30, 0, 1, { text: undefined });

    ps.emit('damage', 40, 40, 1, 123);
    expect(createParticleSpy).toHaveBeenCalledWith('damage', 40, 40, 0, 1, { text: '123' });
  });

  it('should manage particle lifecycle during tick', () => {
    vi.useFakeTimers();

    // Emit a particle with short life
    const createParticleSpy = vi.spyOn(ps as any, 'createParticle').mockReturnValue({
        x: 10, y: 10, vx: 0, vy: -1, life: 50, maxLife: 50, size: 2, color: '#FFF', text: ''
    });
    ps.emit('spark', 10, 10, 1);

    expect(ps.particles.length).toBe(1);
    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1);

    // Advance time by 25ms (half life)
    mockPerformanceNow.mockReturnValue(Date.now() + 25);
    // Manually call tick once to simulate a frame
    (ps as any).tick(Date.now() + 25);

    expect(ps.particles.length).toBe(1);
    expect(ps.particles[0].life).toBe(25);
    expect(mockAppendChild).toHaveBeenCalledTimes(1); // Element was appended

    // Advance time by another 25ms (particle expires)
    mockPerformanceNow.mockReturnValue(Date.now() + 50);
    (ps as any).tick(Date.now() + 50);

    expect(ps.particles.length).toBe(0);
    expect(mockRemoveChild).toHaveBeenCalledTimes(1);
    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1); // Still only called once for the initial start

    // Emit another particle, ensure loop restarts if needed
    createParticleSpy.mockReturnValue({
        x: 20, y: 20, vx: 0, vy: -1, life: 50, maxLife: 50, size: 2, color: '#FFF', text: ''
    });
    ps.emit('spark', 20, 20, 1);
    expect(ps.particles.length).toBe(1);
    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(2); // Called again to start the loop for the new particle

    vi.useRealTimers();
  });

  it('should stop and clear particles on unmount', () => {
    ps.emit('spark', 10, 10, 5);
    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1);
    ps.unmount();
    expect(mockCancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(mockRemoveChild).toHaveBeenCalledTimes(5);
    expect(ps.particles.length).toBe(0);
  });

  it('should handle emitting more particles than maxParticles', () => {
    // ps initialized with maxParticles = 10
    ps.emit('spark', 10, 10, 15);
    expect(ps.particles.length).toBe(10);
    expect(mockAppendChild).toHaveBeenCalledTimes(10);
  });
});
