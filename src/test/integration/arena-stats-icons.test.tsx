import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Arena from '../../pages/Arena';
import { useGame } from '../../context/GameContext';
import { useConnectionGate } from '../../hooks/useConnectionGate';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Character } from '../../types/Character';

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

const mockCharacter: Character = {
  seed: 'test-seed',
  name: 'Stat Hero',
  gender: 'male',
  level: 5,
  experience: 250,
  strength: 9,
  vitality: 7,
  dexterity: 6,
  luck: 5,
  intelligence: 4,
  focus: 5,
  hp: 50,
  maxHp: 50,
  wins: 3,
  losses: 2,
  fightsLeft: 2,
  lastFightReset: Date.now(),
  fightHistory: [],
  firestoreId: 'stat-id',
};

describe('Arena stat icons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConnectionGate.mockReturnValue({
      ensureConnection: vi.fn().mockResolvedValue(true),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      connectionModal: { open: false, message: '' },
    });
    mockUseOnlineStatus.mockReturnValue(true);
    mockUseGame.mockReturnValue({
      activeCharacter: mockCharacter,
      logout: vi.fn(),
      useFight: vi.fn(),
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      firebaseAvailable: true,
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
    });
  });

  it('renders pixel icons alongside compact stats', () => {
    const { container, getByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    );

    const statsGrid = container.querySelector('.stats-grid-compact');
    expect(statsGrid).not.toBeNull();
    expect(statsGrid?.querySelectorAll('.compact-stat-icon svg').length).toBe(6);

    ['STR', 'VIT', 'DEX', 'LUK', 'INT', 'FOC'].forEach((label) => {
      expect(getByText(label)).toBeInTheDocument();
    });
  });
});
