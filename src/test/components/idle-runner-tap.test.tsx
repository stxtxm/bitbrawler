import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { IdleRunnerScene } from '../../components/IdleRunnerScene';
import { Character } from '../../types/Character';

const makeCharacter = (): Character => ({
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 5,
  experience: 0,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 100,
  maxHp: 100,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: 0,
  lastActive: 0,
  essence: 0,
  equippedItems: { weapon: null, armor: null, accessory: null },
});

const baseProps = {
  character: makeCharacter(),
  currentMonster: 'goblin' as const,
  scenePhase: 'combat' as const,
  lastCombatResult: null,
  lastCombatXp: 0,
  offlineGains: null,
  onClearOfflineGains: vi.fn(),
  recentLevelUp: null,
  currentStreak: 0,
  streakMilestone: null,
  onMonsterTap: vi.fn(),
  tapsUsed: 2,
  tapMax: 15,
};

describe('IdleRunnerScene — tap-to-damage UI', () => {
  beforeEach(() => {
    baseProps.onMonsterTap.mockClear();
    // ParticleSystem attaches to the container — stub any canvas-ish calls via
    // the real implementation (jsdom is fine with it because it only touches
    // getContext when mounting, which jsdom stubs).
    vi.stubGlobal('ResizeObserver', vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards taps on the monster during combat to the hook', () => {
    const { container } = render(<IdleRunnerScene {...baseProps} />);
    const slot = container.querySelector('.idle-monster-slot');
    expect(slot).not.toBeNull();
    expect(slot!.className).toContain('tappable');

    fireEvent.pointerDown(slot!);
    expect(baseProps.onMonsterTap).toHaveBeenCalledTimes(1);

    // Hit shake + hint are rendered for feedback
    expect(slot!.className).toContain('monster-hit');
  });

  it('does not forward taps when the scene is not in a fight phase', () => {
    const { container } = render(
      <IdleRunnerScene {...baseProps} scenePhase="running" />,
    );
    const slot = container.querySelector('.idle-monster-slot');
    expect(slot).not.toBeNull();
    expect(slot!.className).not.toContain('tappable');

    fireEvent.pointerDown(slot!);
    expect(baseProps.onMonsterTap).not.toHaveBeenCalled();
  });

  it('shows the TAP hint with the tap budget during a fight', () => {
    const { container } = render(<IdleRunnerScene {...baseProps} />);
    const hint = container.querySelector('.tap-hint');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toContain('TAP!');
    expect(hint!.textContent).toContain('2/15');
  });

  it('renders an essence float text on tap', () => {
    const { container } = render(<IdleRunnerScene {...baseProps} />);
    const slot = container.querySelector('.idle-monster-slot')!;
    fireEvent.pointerDown(slot);
    const floats = container.querySelectorAll('.tap-float');
    expect(floats.length).toBeGreaterThan(0);
    expect(floats[0].textContent).toContain('💎');
  });
});