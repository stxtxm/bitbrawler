import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { CombatView } from '../../components/CombatView';
import { Character } from '../../types/Character';
import * as combatUtils from '../../utils/combatUtils';
import * as xpUtils from '../../utils/xpUtils';
import { ParticleSystem, type ParticleType } from '../../utils/particleSystem';

describe('CombatView combat speed', () => {
  const mountedContainers = new Map<ParticleSystem, HTMLElement>();

  beforeEach(() => {
    vi.clearAllMocks();
    mountedContainers.clear();
    vi.spyOn(ParticleSystem.prototype, 'mount').mockImplementation(function (this: ParticleSystem, container: HTMLElement) {
      mountedContainers.set(this, container);
    });
    vi.spyOn(ParticleSystem.prototype, 'emit').mockImplementation(function (this: ParticleSystem, type: ParticleType, _x: number, _y: number) {
      const container = mountedContainers.get(this);
      if (!container) return;
      const particle = document.createElement('span');
      particle.className = `particle particle-${type}`;
      container.appendChild(particle);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const player: Character = {
    name: 'Hero',
    level: 5,
    hp: 100, maxHp: 100,
    strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
    experience: 0, wins: 0, losses: 0, fightsLeft: 5, lastFightReset: 0,
    gender: 'male', seed: 'abc'
  };

  const opponent: Character = {
    ...player,
    name: 'Villain',
    seed: 'def'
  };

  const mockThreeRounds = () => {
    vi.spyOn(combatUtils, 'simulateCombat').mockReturnValue({
      winner: 'attacker',
      rounds: 3,
      details: [
        'Hero hits Villain for 10 DMG',
        'Hero hits Villain for 12 DMG',
        'Hero lands a final blow for 66 DMG',
      ],
      timeline: [
        { attackerHp: 100, defenderHp: 100 },
        { attackerHp: 100, defenderHp: 90 },
        { attackerHp: 100, defenderHp: 78 },
        { attackerHp: 100, defenderHp: 12 },
      ],
    });
  };

  const roundValue = (): string | undefined =>
    document.querySelector('.round-value')?.textContent;

  const playedRounds = (): number =>
    document.querySelectorAll('.particle-layer.right .particle-damage').length;

  it('resolves rounds twice as fast when combatSpeed is 2', () => {
    vi.useFakeTimers();
    mockThreeRounds();

    render(
      <CombatView
        player={player}
        opponent={opponent}
        matchType="balanced"
        combatSpeed={2}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    act(() => { vi.advanceTimersByTime(1100); });
    act(() => { vi.advanceTimersByTime(700); });
    act(() => { vi.advanceTimersByTime(80); });

    expect(document.querySelector('.combat-action')).not.toBeNull();

    act(() => { vi.advanceTimersByTime(320); });
    expect(playedRounds()).toBe(1);

    act(() => { vi.advanceTimersByTime(320); });
    expect(playedRounds()).toBe(2);
    expect(roundValue()).toBe('2/3');

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the default x1 pacing when combatSpeed is not provided', () => {
    vi.useFakeTimers();
    mockThreeRounds();

    render(
      <CombatView
        player={player}
        opponent={opponent}
        matchType="balanced"
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    act(() => { vi.advanceTimersByTime(2500); });
    act(() => { vi.advanceTimersByTime(1500); });
    act(() => { vi.advanceTimersByTime(80); });

    expect(document.querySelector('.combat-action')).not.toBeNull();

    act(() => { vi.advanceTimersByTime(320); });
    expect(playedRounds()).toBe(0);

    act(() => { vi.advanceTimersByTime(320); });
    expect(playedRounds()).toBe(1);

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reaches the result phase faster with combatSpeed 2', () => {
    vi.useFakeTimers();
    mockThreeRounds();

    vi.spyOn(xpUtils, 'calculateFightXp').mockReturnValue(90);

    render(
      <CombatView
        player={player}
        opponent={opponent}
        matchType="balanced"
        combatSpeed={2}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    act(() => { vi.advanceTimersByTime(1100); });
    act(() => { vi.advanceTimersByTime(700); });
    act(() => { vi.advanceTimersByTime(60); });

    act(() => { vi.advanceTimersByTime(1700); });

    expect(screen.getByText('+90 XP')).toBeInTheDocument();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the speed toggle during combat and calls onToggleCombatSpeed on click', () => {
    vi.useFakeTimers();
    mockThreeRounds();

    const onToggleCombatSpeed = vi.fn();
    const { container } = render(
      <CombatView
        player={player}
        opponent={opponent}
        matchType="balanced"
        combatSpeed={1}
        onToggleCombatSpeed={onToggleCombatSpeed}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    act(() => { vi.advanceTimersByTime(2500); });
    act(() => { vi.advanceTimersByTime(2000); });

    const toggle = container.querySelector('.combat-speed-toggle') as HTMLElement;
    expect(toggle).not.toBeNull();
    expect(toggle.textContent).toContain('x1');

    fireEvent.click(toggle);
    expect(onToggleCombatSpeed).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not render the speed toggle without a handler', () => {
    vi.useFakeTimers();
    mockThreeRounds();

    const { container } = render(
      <CombatView
        player={player}
        opponent={opponent}
        matchType="balanced"
        combatSpeed={1}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    act(() => { vi.advanceTimersByTime(2500); });
    act(() => { vi.advanceTimersByTime(2000); });

    expect(container.querySelector('.combat-speed-toggle')).toBeNull();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
