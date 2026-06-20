export type ParticleType = 'dust' | 'spark' | 'xp_star' | 'damage' | 'hit_ring' | 'crit' | 'miss' | 'heal';

interface ParticleDef {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text?: string;
  el: HTMLElement | null;
}

export class ParticleSystem {
  private particles: ParticleDef[] = [];
  private animFrameId: number | null = null;
  private lastTime = 0;
  private running = false;
  private container: HTMLElement | null = null;
  private maxParticles: number;

  constructor(maxParticles = 60) {
    this.maxParticles = maxParticles;
  }

  mount(container: HTMLElement) {
    this.container = container;
  }

  unmount() {
    this.stop();
    this.clear();
    this.container = null;
  }

  // Added 'value' parameter for damage/heal numbers
  emit(type: ParticleType, x: number, y: number, count = 1, value?: number) {
    if (!this.container) return;

    const actualCount = Math.min(count, this.maxParticles - this.particles.length);
    if (actualCount <= 0) return;

    for (let i = 0; i < actualCount; i++) {
      // Pass text/value to createParticle if available
      const partialData = { text: (type === 'damage' || type === 'heal') && value !== undefined ? String(value) : undefined };
      const partial = this.createParticle(type, x, y, i, actualCount, partialData);
      if (!partial) continue;

      const el = document.createElement('span');
      el.className = `particle particle-${type}`;
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.left = '0';
      el.style.top = '0';

      if (partial.text) {
        el.textContent = partial.text;
        el.style.fontSize = `${partial.size * 3}px`; // Make text particles larger
        el.style.color = partial.color;
        el.style.fontFamily = "'Press Start 2P',monospace";
        el.style.whiteSpace = 'nowrap';
        el.style.zIndex = '20'; // Ensure text is above shapes
      } else {
        el.style.width = `${partial.size}px`;
        el.style.height = `${partial.size}px`;
        el.style.background = partial.color;
        el.style.borderRadius = partial.size > 2 ? '1px' : '0'; // Slightly rounded for larger particles
        el.style.zIndex = '15'; // Shapes are behind text
      }

      this.container.appendChild(el);
      this.particles.push({ ...partial, el });
    }

    if (!this.running) {
      this.running = true;
      this.lastTime = performance.now();
      this.animFrameId = requestAnimationFrame(this.tick);
    }
  }

  // Updated signature to accept partialData
  private createParticle(type: ParticleType, x: number, y: number, index: number, total: number, partialData?: { text?: string }): Omit<ParticleDef, 'el'> | null {
    const colors: Record<ParticleType, string[]> = {
      dust: ['#8B7355', '#A0896C', '#6B5840'],
      spark: ['#FFD700', '#FFFFFF', '#FFA500'],
      xp_star: ['#FFD700', '#FFC107'],
      damage: ['#FF3333', '#FF5555'],
      hit_ring: ['#FFFFFF', '#FFD700', '#FF6B6B'],
      crit: ['#FFEC8B', '#FFD700', '#FFEC8B'], // Golden yellow for critical hits
      miss: ['#CCCCCC', '#EEEEEE', '#FFFFFF'], // Light gray/white for misses
      heal: ['#AFFFAC', '#90EE90', '#7FFF7F'], // Light green for healing
    };

    switch (type) {
      case 'dust':
        return {
          x: x + (Math.random() - 0.5) * 8,
          y,
          vx: (Math.random() - 0.5) * 1,
          vy: Math.random() * 0.5 + 0.3,
          life: 600, maxLife: 600, size: 2,
          color: colors.dust[Math.floor(Math.random() * colors.dust.length)],
        };
      case 'spark':
        return {
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 1,
          life: 400, maxLife: 400, size: 2,
          color: colors.spark[Math.floor(Math.random() * colors.spark.length)],
        };
      case 'xp_star':
        return {
          x, y,
          vx: 0,
          vy: -1.5,
          life: 2000, maxLife: 2000, size: 3,
          color: colors.xp_star[0],
          text: '+XP',
        };
      case 'damage': // Use text from partialData
        return {
          x, y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1,
          life: 1500, maxLife: 1500, size: 4,
          color: colors.damage[0],
          text: String(partialData?.text ?? ''),
        };
      case 'hit_ring': {
        const angle = (index / total) * Math.PI * 2;
        return {
          x, y,
          vx: Math.cos(angle) * 3,
          vy: Math.sin(angle) * 3,
          life: 300, maxLife: 300, size: 2,
          color: colors.hit_ring[Math.floor(Math.random() * colors.hit_ring.length)],
        };
      }
      case 'crit': { // Critical hit particle
        return {
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 2, // Slower horizontal spread
          vy: -2, // Faster upward movement
          life: 800, maxLife: 800, size: 4,
          color: colors.crit[Math.floor(Math.random() * colors.crit.length)],
          text: 'CRIT!',
        };
      }
      case 'miss': { // Miss particle
        return {
          x: x + (Math.random() - 0.5) * 10,
          y: y - 10 + (Math.random() - 0.5) * 5, // Start slightly higher
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1.2, // Slow upward drift
          life: 1200, maxLife: 1200, size: 3,
          color: colors.miss[Math.floor(Math.random() * colors.miss.length)],
          text: 'MISS',
        };
      }
      case 'heal': { // Healing particle
        return {
          x, y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1.5, // Slight upward movement
          life: 1200, maxLife: 1200, size: 4,
          color: colors.heal[0],
          text: String(partialData?.text ?? ''), // Use partialData to pass HP value
        };
      }
    }
    return null;
  }

  clear() {
    for (const p of this.particles) {
      if (p.el?.parentNode) p.el.parentNode.removeChild(p.el);
    }
    this.particles = [];
  }

  stop() {
    this.running = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  destroy() {
    this.stop();
    this.clear();
    this.container = null;
  }

  private tick = (now: number) => {
    if (!this.running) return;

    const delta = Math.min(now - this.lastTime, 50);
    this.lastTime = now;

    const alive: ParticleDef[] = [];
    for (const p of this.particles) {
      p.life -= delta;
      if (p.life <= 0) {
        if (p.el?.parentNode) p.el.parentNode.removeChild(p.el);
        continue;
      }

      p.x += p.vx * (delta / 16);
      p.y += p.vy * (delta / 16);
      const progress = p.life / p.maxLife;

      if (p.el) {
        p.el.style.transform = `translate(${p.x}px,${p.y}px)`;
        p.el.style.opacity = String(Math.max(0, progress));
      }

      alive.push(p);
    }

    this.particles = alive;

    if (alive.length > 0) {
      this.animFrameId = requestAnimationFrame(this.tick);
    } else {
      this.running = false;
      this.animFrameId = null;
    }
  }
}
