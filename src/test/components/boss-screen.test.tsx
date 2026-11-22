import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../types/Character';
import type { BossProgress } from '../../utils/bossUtils';

const { estimateSpy } = vi.hoisted(() => ({
  estimateSpy: vi.fn(() => ({
    winChance: 64,
    lossChance: 36,
    averageDamage: 820,
    minDamage: 410,
    maxDamage: 1600,
    attacksToKill: 7,
  })),
}));

vi.mock('../../utils/bossPreview', () => ({
  estimateBossOutcome: estimateSpy,
}));

import { BossScreen } from '../../components/arena/BossScreen';

const character: Character = {
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 25,
  experience: 1200,
  strength: 30,
  vitality: 28,
  dexterity: 24,
  luck: 18,
  intelligence: 16,
  focus: 20,
  hp: 320,
  maxHp: 400,
  wins: 12,
  losses: 3,
  fightsLeft: 4,
  lastFightReset: 0,
};

const progress: BossProgress = {
  bossId: 'void_titan',
  attacksLeft: 3,
  lastAttackReset: Date.now(),
  bossHp: 6500,
  bossMaxHp: 9000,
  bossLevel: 27,
  totalKills: 2,
  firstEncounterAt: 1,
  pityStacks: 2,
  consolationCount: 1,
};

const renderBoss = (overrides: Partial<Parameters<typeof BossScreen>[0]> = {}) => {
  const onFight = vi.fn();
  const onModeChange = vi.fn();
  render(
    <BossScreen
      character={character}
      effectiveCharacter={character}
      mode="boss"
      onModeChange={onModeChange}
      bossId="void_titan"
      bossProgress={progress}
      bossUnlocked
      attacksLeft={3}
      canFight
      onFight={onFight}
      {...overrides}
    />,
  );
  return { onFight, onModeChange };
};

describe('BossScreen', () => {
  beforeEach(() => {
    estimateSpy.mockClear();
  });

  it('shows the boss, the win/loss estimate and the rewards', () => {
    renderBoss();

    expect(screen.getAllByText('VOID TITAN').length).toBeGreaterThan(0);
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('36%')).toBeInTheDocument();
    expect(screen.getByText(/820 DMG \/ ATTACK/)).toBeInTheDocument();
    expect(screen.getByText(/7 ATTACKS TO SLAY/)).toBeInTheDocument();
    expect(screen.getByText('REWARDS')).toBeInTheDocument();
    expect(screen.getAllByText(/\+\d+ XP/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+\d+ 💎/).length).toBeGreaterThan(0);
  });

  it('shows the daily attack pips and launches the boss fight', () => {
    const { onFight } = renderBoss();

    expect(screen.getByText('3 / 5 AVAILABLE')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ATTACK BOSS' }));
    expect(onFight).toHaveBeenCalledTimes(1);
  });

  it('locks the screen below the unlock level', () => {
    renderBoss({
      character: { ...character, level: 10 },
      effectiveCharacter: { ...character, level: 10 },
      bossUnlocked: false,
      canFight: false,
      bossProgress: { ...progress, bossHp: 9000, pityStacks: 0 },
    });

    expect(screen.getByText('BOSS LOCKED')).toBeInTheDocument();
    expect(screen.getByText('REACH LEVEL 20 TO CHALLENGE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOCKED LVL 20' })).toBeDisabled();
    expect(screen.queryByText('64%')).not.toBeInTheDocument();
  });

  it('marks the boss tab as active and switches to PvE', () => {
    const { onModeChange } = renderBoss();

    expect(screen.getByRole('tab', { name: /BOSS/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /PVE/ }));
    expect(onModeChange).toHaveBeenCalledWith('pve');
  });

  it('hides the consolation rewards once the daily cap is reached', () => {
    renderBoss({
      bossProgress: { ...progress, consolationCount: 5 },
    });

    expect(screen.getByText('NO CONSOLATION LEFT TODAY')).toBeInTheDocument();
  });

  it('switches to the abyssal monarch theme', () => {
    const { container } = render(
      <BossScreen
        character={{ ...character, level: 58 }}
        effectiveCharacter={{ ...character, level: 58 }}
        mode="boss"
        onModeChange={vi.fn()}
        bossId="abyssal_monarch"
        bossProgress={{ ...progress, bossId: 'abyssal_monarch' }}
        bossUnlocked
        attacksLeft={2}
        canFight
        onFight={vi.fn()}
      />,
    );

    expect(screen.getAllByText('FROSTPEAK MONARCH').length).toBeGreaterThan(0);
    expect(container.querySelector('.boss-screen')).toHaveAttribute('data-boss', 'abyssal_monarch');
    expect(screen.getByText('SUMMIT RAID')).toBeInTheDocument();
  });

  it('shows boss selector after first kill and allows training on Void Titan while Frostpeak is locked', () => {
    const onSelectBoss = vi.fn();
    renderBoss({
      nextBossVisible: true,
      abyssalUnlocked: false,
      voidTitanKills: 1,
      selectedBossId: 'void_titan',
      onSelectBoss,
    });

    expect(screen.getByRole('radiogroup', { name: 'Boss target' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /VOID TITAN/i })).toHaveAttribute('aria-checked', 'true');
    const frostpeak = screen.getByRole('radio', { name: /FROSTPEAK/i });
    expect(frostpeak).toHaveAttribute('aria-checked', 'false');
    expect(frostpeak.className).toContain('locked');
    expect(screen.getByText(/LOCKED LVL 40/)).toBeInTheDocument();
    fireEvent.click(frostpeak);
    expect(onSelectBoss).toHaveBeenCalledWith('abyssal_monarch');
  });

  it('allows selecting unlocked Frostpeak boss', () => {
    const onSelectBoss = vi.fn();
    renderBoss({
      bossId: 'abyssal_monarch',
      bossProgress: { ...progress, bossId: 'abyssal_monarch', bossLevel: 40, bossMaxHp: 12000, bossHp: 12000 },
      nextBossVisible: true,
      abyssalUnlocked: true,
      voidTitanKills: 2,
      selectedBossId: 'abyssal_monarch',
      onSelectBoss,
      character: { ...character, level: 40 },
      effectiveCharacter: { ...character, level: 40 },
    });

    const frostpeak = screen.getByRole('radio', { name: /FROSTPEAK/i });
    expect(frostpeak).toHaveAttribute('aria-checked', 'true');
    expect(frostpeak.className).not.toContain('locked');
    fireEvent.click(screen.getByRole('radio', { name: /VOID TITAN/i }));
    expect(onSelectBoss).toHaveBeenCalledWith('void_titan');
  });
});
