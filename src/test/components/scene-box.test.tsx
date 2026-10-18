import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const perf = { low: false };

vi.mock('../../hooks/useLowPerformanceMode', () => ({
  useLowPerformanceMode: () => perf.low,
}));

vi.mock('../../components/IdleRunnerScene', () => ({
  IdleRunnerScene: () => <div data-testid="idle-runner-scene">IDLE SCENE</div>,
}));

import { BIOME_LIGHTING } from '../../components/arena/sceneLighting';
import { SceneBox } from '../../components/arena/SceneBox';
import type { ArenaIdleViewModel } from '../../components/arena/arenaTypes';
import type { Character } from '../../types/Character';

const baseCharacter: Character = {
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 3,
  experience: 120,
  strength: 8,
  vitality: 7,
  dexterity: 6,
  luck: 5,
  intelligence: 4,
  focus: 5,
  hp: 44,
  maxHp: 56,
  wins: 2,
  losses: 1,
  fightsLeft: 3,
  lastFightReset: 0,
};

const bossSlayer: Character = {
  ...baseCharacter,
  bossProgress: {
    bossId: 'void_titan',
    attacksLeft: 4,
    lastAttackReset: 0,
    bossHp: 0,
    bossMaxHp: 7008,
    bossLevel: 31,
    totalKills: 1,
    firstEncounterAt: 1,
  },
};

const abyssalExplorer: Character = {
  ...bossSlayer,
  level: 58,
  bossProgresses: { void_titan: { totalKills: 1 } },
} as Character;

const idle: ArenaIdleViewModel = {
  currentMonster: 'goblin',
  scenePhase: 'running',
  lastCombatResult: null,
  lastCombatXp: 18,
  offlineGains: null,
  clearOfflineGains: vi.fn(),
  currentStreak: 6,
  streakMilestone: null,
  efficiency: 1.2,
  xpPerMinute: 12,
  essencePerMinute: null,
  powerRatio: 1.4,
  remainingSeconds: 125,
  recentLevelUp: null,
  idleFightsCount: 4,
  totalKills: 9,
  efficiencyData: {
    powerRatio: 1.4,
    efficiency: 1.2,
    effectiveInterval: 8,
    xpPerMinute: 12,
    essencePerMinute: 0,
    streakBonus: 0,
    streakMilestone: null,
    nextLevelTime: 125,
    speedEfficiency: 1,
    statEssenceMultiplier: 1,
  },
};

const getBox = (container: HTMLElement) => {
  const box = container.querySelector('.scene-box');
  if (!(box instanceof HTMLElement)) throw new Error('missing .scene-box');
  return box;
};

describe('SceneBox v2 — ombre portée + éclairage biome', () => {
  beforeEach(() => {
    perf.low = false;
  });

  it('se rend sans GameProvider (composant props-only)', () => {
    const { container } = render(
      <SceneBox character={baseCharacter} effectiveCharacter={baseCharacter} pveMode idle={idle} />,
    );

    expect(container.querySelector('.scene-box')).toBeTruthy();
    expect(screen.getByTestId('idle-runner-scene')).toBeInTheDocument();
  });

  it('expose les variables d’éclairage du biome et un calque de lumière dédié', () => {
    const { container } = render(
      <SceneBox character={baseCharacter} effectiveCharacter={baseCharacter} pveMode idle={idle} />,
    );

    const box = getBox(container);
    const lighting = container.querySelector('.scene-lighting');

    expect(box).toHaveAttribute('data-biome', 'plains');
    expect(box.style.getPropertyValue('--scene-tint')).toBe(BIOME_LIGHTING.plains.tint);
    expect(box.style.getPropertyValue('--scene-shadow-spread')).toBe(BIOME_LIGHTING.plains.shadowSpread);
    expect(box.style.getPropertyValue('--scene-shadow-color')).toContain(BIOME_LIGHTING.plains.shadowRgb);
    expect(lighting).not.toBeNull();
    expect(lighting).toHaveAttribute('data-biome', 'plains');
  });

  it('fait suivre l’éclairage au biome (volcanique puis abyssal)', () => {
    const volcanic = render(
      <SceneBox character={bossSlayer} effectiveCharacter={bossSlayer} pveMode idle={idle} />,
    );
    const volcanicBox = getBox(volcanic.container);
    expect(volcanicBox).toHaveAttribute('data-biome', 'volcanic');
    expect(volcanicBox.style.getPropertyValue('--scene-tint')).toBe(BIOME_LIGHTING.volcanic.tint);
    expect(volcanicBox.style.getPropertyValue('--scene-shadow-spread')).toBe(BIOME_LIGHTING.volcanic.shadowSpread);

    const abyssal = render(
      <SceneBox character={abyssalExplorer} effectiveCharacter={abyssalExplorer} pveMode idle={idle} />,
    );
    const abyssalBox = getBox(abyssal.container);
    expect(abyssalBox).toHaveAttribute('data-biome', 'abyssal');
    expect(abyssalBox.style.getPropertyValue('--scene-tint')).toBe(BIOME_LIGHTING.abyssal.tint);
  });

  it('déclare une ombre portée sous le combattant PvP, pilotée par les variables du biome', () => {
    const { container } = render(
      <SceneBox character={baseCharacter} effectiveCharacter={baseCharacter} pveMode={false} idle={idle} />,
    );

    const wrap = container.querySelector('.fighter-character-wrap');
    const shadow = wrap?.querySelector('.scene-ground-shadow');

    expect(wrap).not.toBeNull();
    expect(shadow).not.toBeNull();
    expect(getBox(container).style.getPropertyValue('--scene-shadow-color')).toContain(
      BIOME_LIGHTING.plains.shadowRgb,
    );
  });

  it('laisse le runner PvE gérer l’ombre (pas de doublon) tout en publiant les variables', () => {
    const { container } = render(
      <SceneBox character={baseCharacter} effectiveCharacter={baseCharacter} pveMode idle={idle} />,
    );

    expect(screen.getByTestId('idle-runner-scene')).toBeInTheDocument();
    expect(container.querySelector('.scene-ground-shadow')).toBeNull();
    expect(getBox(container).style.getPropertyValue('--scene-shadow-color')).not.toBe('');
  });

  it('réduit les effets sans casser le rendu en mode faible performance', () => {
    perf.low = false;
    const rich = render(
      <SceneBox character={baseCharacter} effectiveCharacter={baseCharacter} pveMode idle={idle} />,
    );
    const richShadow = getBox(rich.container).style.getPropertyValue('--scene-shadow-color');
    rich.unmount();

    perf.low = true;
    const reduced = render(
      <SceneBox character={baseCharacter} effectiveCharacter={baseCharacter} pveMode idle={idle} />,
    );
    const reducedBox = getBox(reduced.container);

    expect(reducedBox).toHaveClass('scene-low-perf');
    expect(reducedBox).toHaveAttribute('data-low-perf', 'true');
    expect(screen.getByTestId('idle-runner-scene')).toBeInTheDocument();
    const lighting = reduced.container.querySelector('.scene-lighting');
    expect(lighting).toHaveAttribute('data-low-perf', 'true');
    expect(reducedBox.style.getPropertyValue('--scene-shadow-color')).not.toBe(richShadow);
  });
});
