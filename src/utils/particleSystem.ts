export type ParticleType = 'dust' | 'spark' | 'xp_star' | 'damage' | 'hit_ring' | 'crit' | 'miss' | 'heal' | 'hit' | 'magic';

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

type ParticleSeed = Omit<ParticleDef, 'el'>;

const PARTICLE_COLORS: Record<ParticleType, string[]> = {
  dust: ['#8B7355', '#A0896C', '#6B5840'],
  spark: ['#FFD700', '#FFFFFF', '#FFA500'],
  xp_star: ['#FFD700', '#FFC107'],
  damage: ['#FF3333', '#FF5555'],
  hit_ring: ['#FFFFFF', '#FFD700', '#FF6B6B'],
  hit: ['#FFFFFF', '#FFE9A0', '#FFD700'],
  magic: ['#A0E9FF', '#00D4FF', '#7DF9FF'],
  crit: ['#FFEC8B', '#FFD700', '#FFEC8B'],
  miss: ['#CCCCCC', '#EEEEEE', '#FFFFFF'],
  heal: ['#AFFFAC', '#90EE90', '#7FFF7F'],
};

const pickColor = (type: ParticleType): string => {
  const colors = PARTICLE_COLORS[type];
  return colors[Math.floor(Math.random() * colors.length)];
};

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

  emit(type: ParticleType, x: number, y: number, count = 1, value?: number) {
    if (!this.container) return;

    const actualCount = Math.min(count, this.maxParticles - this.particles.length);
    if (actualCount <= 0) return;

    const text = (type === 'damage' || type === 'heal') && value !== undefined ? String(value) : undefined;

    for (let i = 0; i < actualCount; i++) {
      const partial = this.createParticle(type, x, y, i, actualCount, text);
      if (!partial) continue;

      const el = document.createElement('span');
      el.className = `particle particle-${type}`;
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.left = '0';
      el.style.top = '0';

      if (partial.text) {
        el.textContent = partial.text;
        el.style.fontSize = `${partial.size * 3}px`;
        el.style.color = partial.color;
        el.style.fontFamily = "'Press Start 2P',monospace";
        el.style.whiteSpace = 'nowrap';
        el.style.zIndex = '20';
      } else {
        el.style.width = `${partial.size}px`;
        el.style.height = `${partial.size}px`;
        el.style.background = partial.color;
        el.style.borderRadius = partial.size > 2 ? '1px' : '0';
        el.style.zIndex = '15';
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

  private createParticle(type: ParticleType, x: number, y: number, index: number, total: number, text?: string): ParticleSeed | null {
    switch (type) {
      case 'dust':
        return {
          x: x + (Math.random() - 0.5) * 8,
          y,
          vx: (Math.random() - 0.5) * 1,
          vy: Math.random() * 0.5 + 0.3,
          life: 600, maxLife: 600, size: 2,
          color: pickColor('dust'),
        };
      case 'spark':
        return {
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 1,
          life: 400, maxLife: 400, size: 2,
          color: pickColor('spark'),
        };
      case 'xp_star':
        return {
          x, y,
          vx: 0,
          vy: -1.5,
          life: 2000, maxLife: 2000, size: 3,
          color: PARTICLE_COLORS.xp_star[0],
          text: '+XP',
        };
      case 'damage':
        return {
          x, y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1,
          life: 1500, maxLife: 1500, size: 4,
          color: PARTICLE_COLORS.damage[0],
          text: text ?? '',
        };
      case 'hit_ring': {
        const angle = (index / total) * Math.PI * 2;
        return {
          x, y,
          vx: Math.cos(angle) * 3,
          vy: Math.sin(angle) * 3,
          life: 300, maxLife: 300, size: 2,
          color: pickColor('hit_ring'),
        };
      }
      case 'crit':
        return {
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 2,
          vy: -2,
          life: 800, maxLife: 800, size: 4,
          color: pickColor('crit'),
          text: 'CRIT!',
        };
      case 'hit':
        return {
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 2,
          vy: -1.2,
          life: 700, maxLife: 700, size: 3,
          color: pickColor('hit'),
        };
      case 'magic':
        return {
          x,
          y,
          vx: (Math.random() - 0.5) * 3,
          vy: -2.2,
          life: 900, maxLife: 900, size: 4,
          color: pickColor('magic'),
          text: 'MAGIC!',
        };
      case 'miss':
        return {
          x: x + (Math.random() - 0.5) * 10,
          y: y - 10 + (Math.random() - 0.5) * 5,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1.2,
          life: 1200, maxLife: 1200, size: 3,
          color: pickColor('miss'),
          text: 'MISS',
        };
      case 'heal':
        return {
          x, y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1.5,
          life: 1200, maxLife: 1200, size: 4,
          color: PARTICLE_COLORS.heal[0],
          text: text ?? '',
        };
    }
    return null;
  }

  clear() {
    for (const particle of this.particles) {
      if (particle.el?.parentNode) particle.el.parentNode.removeChild(particle.el);
    }
    this.particles.length = 0;
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
    let writeIndex = 0;

    for (let readIndex = 0; readIndex < this.particles.length; readIndex++) {
      const particle = this.particles[readIndex];
      particle.life -= delta;
      if (particle.life <= 0) {
        if (particle.el?.parentNode) particle.el.parentNode.removeChild(particle.el);
        continue;
      }

      particle.x += particle.vx * (delta / 16);
      particle.y += particle.vy * (delta / 16);
      const progress = particle.life / particle.maxLife;

      if (particle.el) {
        particle.el.style.transform = `translate(${particle.x}px,${particle.y}px)`;
        particle.el.style.opacity = String(Math.max(0, progress));
      }

      this.particles[writeIndex] = particle;
      writeIndex += 1;
    }

    this.particles.length = writeIndex;

    if (writeIndex > 0) {
      this.animFrameId = requestAnimationFrame(this.tick);
    } else {
      this.running = false;
      this.animFrameId = null;
    }
  };
}
