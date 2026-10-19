import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import Arena from '../../pages/Arena';
import { useGame } from '../../context/GameContext';
import { useConnectionGate } from '../../hooks/useConnectionGate';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { Character } from '../../types/Character';
import { renderWithRouter } from '../utils/router';

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

vi.mock('../../hooks/useConnectionGate', () => ({
  useConnectionGate: vi.fn(),
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;
const mockUseConnectionGate = useConnectionGate as unknown as ReturnType<typeof vi.fn>;
const mockUseOnlineStatus = useOnlineStatus as unknown as ReturnType<typeof vi.fn>;

const character: Character = {
  id: 'compendium-id',
  seed: 'seed',
  name: 'Collector',
  gender: 'male',
  level: 8,
  experience: 400,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 120,
  maxHp: 120,
  wins: 2,
  losses: 1,
  fightsLeft: 3,
  lastFightReset: 0,
  inventory: ['rusty_sword'],
  codex: ['rusty_sword'],
  monsterKills: { goblin: 2 },
  monsterEncounters: { goblin: 3 },
};

describe('Arena compendium', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue(true);
    mockUseConnectionGate.mockReturnValue({
      ensureConnection: vi.fn().mockResolvedValue(true),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      connectionModal: { open: false, message: '' },
    });
    mockUseGame.mockReturnValue({
      activeCharacter: character,
      logout: vi.fn(),
      useFight: vi.fn(),
      useBossFight: vi.fn(),
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      dbAvailable: true,
      retryConnection: vi.fn(),
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
      startMatchmaking: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      salvageItems: vi.fn(),
      setCharacter: vi.fn(),
      saveEquipment: vi.fn(),
      syncCharacterToBackend: vi.fn(),
      essence: 0,
    });
  });

  it('opens the compendium from settings and browses both tabs', () => {
    renderWithRouter(<Arena />);

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByLabelText('Open compendium'));

    expect(screen.getByText('COMPENDIUM')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Kills: 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Armory/i }));
    expect(screen.getByText('Rusty Sword')).toBeInTheDocument();
  });
});
