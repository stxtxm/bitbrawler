import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CharacterCreation from '../../pages/CharacterCreation';
import { useGame } from '../../context/GameContext';
import { useConnectionGate } from '../../hooks/useConnectionGate';
import { Character } from '../../types/Character';

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

vi.mock('../../hooks/useConnectionGate', () => ({
  useConnectionGate: vi.fn(),
}));

vi.mock('../../utils/characterUtils', () => ({
  generateInitialStats: vi.fn(),
  generateCharacterName: vi.fn().mockReturnValue('TestName'),
}));

vi.mock('../../routes/lazyPages', () => ({
  prefetchArena: vi.fn(),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;
const mockUseConnectionGate = useConnectionGate as unknown as ReturnType<typeof vi.fn>;

const mockCharacter: Character = {
  seed: 'seed-creation',
  name: 'NEW HERO',
  gender: 'male',
  level: 1,
  experience: 0,
  strength: 7,
  vitality: 6,
  dexterity: 5,
  luck: 4,
  intelligence: 3,
  focus: 5,
  hp: 38,
  maxHp: 38,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
};

describe('Character creation stat icons', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { generateInitialStats } = await import('../../utils/characterUtils');
    (generateInitialStats as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockCharacter);
    mockUseGame.mockReturnValue({
      setCharacter: vi.fn(),
    });
    mockUseConnectionGate.mockReturnValue({
      ensureConnection: vi.fn().mockResolvedValue(true),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      connectionModal: { open: false, message: '' },
    });
  });

  it('renders pixel icons for each stat card and HP', async () => {
    const { container, getByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CharacterCreation />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getByText('STR')).toBeInTheDocument();
    });

    const statsReadout = container.querySelector('.stats-readout-compact');
    expect(statsReadout).not.toBeNull();
    expect(statsReadout?.querySelectorAll('.stat-card .stat-icon svg').length).toBe(6);
    expect(statsReadout?.querySelectorAll('.hp-stat-card .stat-icon svg').length).toBe(1);
  });
});
