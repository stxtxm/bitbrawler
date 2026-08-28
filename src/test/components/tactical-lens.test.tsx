import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TacticalLens } from '../../components/arena/TacticalLens';
import { Character } from '../../types/Character';
import { getTacticalHint } from '../../utils/tacticalLens';

const baseChar: Character = {
  name: 'Player',
  gender: 'male',
  seed: 'seed1',
  level: 10,
  hp: 100,
  maxHp: 100,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  experience: 0,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  inventory: [],
  equippedItems: { weapon: null, armor: null, accessory: null },
};

const makeTank: Character = {
  ...baseChar,
  name: 'TankBot',
  seed: 'tank',
  strength: 5,
  vitality: 20,
  dexterity: 5,
  luck: 5,
  intelligence: 5,
  focus: 5,
  equippedItems: { weapon: 'stone_cleaver', armor: null, accessory: null },
};

describe('TacticalLens component', () => {
  it('renders tactical lens with hint', () => {
    const player: Character = { ...baseChar, inventory: ['ember_blade'], equippedItems: { weapon: 'ember_blade', armor: null, accessory: null } };
    const hint = getTacticalHint(player, makeTank)!;
    const fn = vi.fn();
    render(<TacticalLens opponent={makeTank} hint={hint} onOpenInventory={fn} />);
    expect(screen.getByTestId('tactical-lens')).toBeInTheDocument();
    expect(screen.getByTestId('tactical-hint').textContent).toContain('TANK');
    expect(screen.getByTestId('tactical-switch-btn')).toBeInTheDocument();
  });

  it('shows archetype and weakness', () => {
    const player: Character = { ...baseChar };
    const hint = getTacticalHint(player, makeTank)!;
    render(<TacticalLens opponent={makeTank} hint={hint} onOpenInventory={vi.fn()} />);
    expect(screen.getByTestId('tactical-archetype').textContent).toContain('TANK');
    expect(screen.getByTestId('tactical-weakness')).toBeInTheDocument();
  });

  it('switch button calls onOpenInventory with weakness', async () => {
    const player: Character = { ...baseChar, inventory: ['ember_blade'], equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null } };
    const hint = getTacticalHint(player, makeTank)!;
    const fn = vi.fn();
    render(<TacticalLens opponent={makeTank} hint={hint} onOpenInventory={fn} />);
    screen.getByTestId('tactical-switch-btn').click();
    expect(fn).toHaveBeenCalledWith('fire');
  });
});
