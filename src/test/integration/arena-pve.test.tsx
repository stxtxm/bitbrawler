import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GameProvider, useGame } from '../../context/GameContext';
import { Character } from '../../types/Character';
import { createQueryBuilder, characterToSupabaseRow } from '../utils/supabaseMock';
import { ROUTER_FUTURE_FLAGS } from '../utils/router';

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('../../config/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
  CharacterRow: {},
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

const mockCharacter: Character = {
  name: 'PvE Hero',
  gender: 'male',
  seed: 'pve-test',
  level: 5,
  hp: 150,
  maxHp: 150,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  experience: 500,
  wins: 5,
  losses: 2,
  fightsLeft: 3,
  pveFightsLeft: 5,
  lastFightReset: Date.now(),
  id: 'pve-test-id',
  statPoints: 0,
  inventory: [],
  lastLootRoll: 0,
};

function setupMocks(char: Character = mockCharacter) {
  vi.clearAllMocks();
  const row = characterToSupabaseRow(char);
  const selectBuilder = createQueryBuilder({ data: row, error: null });
  const updateBuilder = createQueryBuilder({ data: null, error: null });
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'characters') {
      const builder: any = { ...selectBuilder };
      builder.update = vi.fn(() => ({
        ...updateBuilder,
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      }));
      return builder;
    }
    return selectBuilder;
  });
  return { selectBuilder, updateBuilder };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <GameProvider>
      <MemoryRouter initialEntries={['/arena']} future={ROUTER_FUTURE_FLAGS}>
        {children}
      </MemoryRouter>
    </GameProvider>
  );
};

describe('Arena PvE', () => {
  it('character starts with pveFightsLeft', async () => {
    setupMocks(mockCharacter);
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter?.pveFightsLeft).toBe(5);
  });



});
