import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GameProvider, useGame } from '../../context/GameContext';
import { Character } from '../../types/Character';
import { createQueryBuilder, characterToSupabaseRow } from '../utils/supabaseMock';
import { ROUTER_FUTURE_FLAGS } from '../utils/router';
import { BOSS_ID } from '../../data/bossAssets';
import { GAME_RULES } from '../../config/gameRules';
import { getBossKillXp } from '../../utils/bossUtils';

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
  name: 'Boss Hero',
  gender: 'male',
  seed: 'boss-test',
  level: 30,
  hp: 584,
  maxHp: 584,
  strength: 17,
  vitality: 17,
  dexterity: 16,
  luck: 16,
  intelligence: 16,
  focus: 17,
  experience: 5000,
  wins: 5,
  losses: 2,
  fightsLeft: 3,
  pveFightsLeft: 5,
  lastFightReset: Date.now(),
  id: 'boss-test-id',
  statPoints: 0,
  inventory: [],
  lastLootRoll: 0,
  essence: 100,
};

function setupMocks(char: Character = mockCharacter) {
  vi.clearAllMocks();
  const row = characterToSupabaseRow(char);
  const selectBuilder = createQueryBuilder({ data: row, error: null });
  const updateBuilder = createQueryBuilder({ data: null, error: null });
  let lastUpdatePayload: any = null;
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'characters') {
      const builder: any = { ...selectBuilder };
      builder.update = vi.fn((payload: any) => {
        lastUpdatePayload = payload;
        return {
          ...updateBuilder,
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      });
      return builder;
    }
    return selectBuilder;
  });
  return {
    selectBuilder,
    updateBuilder,
    getLastUpdatePayload: () => lastUpdatePayload,
  };
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

describe('Arena Boss (useBossFight)', () => {
  it('creates fresh boss progress on first attack and consumes an attack on a loss', async () => {
    setupMocks();
    // Local XP slightly above the server copy so the local character (with
    // essence) wins the load merge — mirrors the hasMoreXp production path.
    (localStorage.getItem as any).mockReturnValue(JSON.stringify({ ...mockCharacter, experience: 5001 }));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter?.bossProgress).toBeUndefined();

    await act(async () => {
      await result.current.useBossFight(false, 0, 'VOID TITAN', { bossHpLeft: 4100 });
    });

    const progress = result.current.activeCharacter?.bossProgress;
    expect(progress?.bossId).toBe(BOSS_ID);
    // Fresh cycle created, then one attack consumed — pity reduces maxHp by 12%.
    expect(progress?.attacksLeft).toBe(GAME_RULES.BOSS.MAX_DAILY_ATTACKS - 1);
    expect(progress?.bossMaxHp).toBe(Math.round(mockCharacter.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER * 0.88));
    // Boss keeps the persistent HP pool on a loss (clamped to new pity max).
    expect(progress?.bossHp).toBe(4100);
    // Raid attempts must not inflate the loss record.
    expect(result.current.activeCharacter?.losses).toBe(2);
    expect(result.current.activeCharacter?.wins).toBe(5);
    // Consolation essence on defeat (capped 3/day).
    expect(result.current.activeCharacter?.essence).toBe(100 + GAME_RULES.BOSS.CONSOLATION_ESSENCE);
  });

  it('on a kill: new full-HP cycle, kill counter, rewards, and boss_progress synced to Supabase', async () => {
    setupMocks();
    const charWithProgress: Character = {
      ...mockCharacter,
      // Slightly more XP than the server copy so the local character (with
      // essence) wins the load merge — mirrors the hasMoreXp production path.
      experience: 5001,
      bossProgress: {
        bossId: BOSS_ID,
        attacksLeft: 3,
        lastAttackReset: Date.now(),
        bossHp: 900,
        bossMaxHp: 7008,
        bossLevel: 32,
        totalKills: 0,
        firstEncounterAt: Date.now(),
      },
    };
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(charWithProgress));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const killXp = getBossKillXp(mockCharacter);

    await act(async () => {
      await result.current.useBossFight(true, killXp, 'VOID TITAN', { bossHpLeft: 0 });
    });

    const progress = result.current.activeCharacter?.bossProgress;
    expect(progress?.totalKills).toBe(1);
    expect(progress?.attacksLeft).toBe(2);
    // Fresh cycle: full HP pool, not the depleted one.
    expect(progress?.bossHp).toBe(progress?.bossMaxHp);
    expect(progress?.bossMaxHp).toBe(Math.round(mockCharacter.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER));
    expect(progress?.lastKillAt).toBeDefined();
    // Kill rewards: essence + wins, losses untouched.
    expect(result.current.activeCharacter?.essence).toBe(100 + GAME_RULES.BOSS.ESSENCE_REWARD);
    expect(result.current.activeCharacter?.wins).toBe(6);
    expect(result.current.activeCharacter?.losses).toBe(2);
    // Kill XP applied.
    expect(result.current.activeCharacter?.experience).toBeGreaterThan(5000);
  });

  it('persists boss_progress in the Supabase update payload', async () => {
    const mocks = setupMocks();
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.useBossFight(false, 0, 'VOID TITAN', { bossHpLeft: 3000 });
    });

    const payload = mocks.getLastUpdatePayload();
    expect(payload).not.toBeNull();
    expect(payload.boss_progress).toBeDefined();
    expect(payload.boss_progress.bossId).toBe(BOSS_ID);
    expect(payload.boss_progress.bossHp).toBe(3000);
    expect(payload.boss_progress.attacksLeft).toBe(GAME_RULES.BOSS.MAX_DAILY_ATTACKS - 1);
  });

  it('refills the attack gauge when the Paris day rolls over', async () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    setupMocks({
      ...mockCharacter,
      bossProgress: {
        bossId: BOSS_ID,
        attacksLeft: 0,
        lastAttackReset: yesterday,
        bossHp: 5000,
        bossMaxHp: 7008,
        bossLevel: 32,
        totalKills: 1,
        firstEncounterAt: yesterday,
      },
    });
    (localStorage.getItem as any).mockReturnValue(JSON.stringify({
      ...mockCharacter,
      bossProgress: {
        bossId: BOSS_ID,
        attacksLeft: 0,
        lastAttackReset: yesterday,
        bossHp: 5000,
        bossMaxHp: 7008,
        bossLevel: 32,
        totalKills: 1,
        firstEncounterAt: yesterday,
      },
    }));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.useBossFight(false, 0, 'VOID TITAN', { bossHpLeft: 4600 });
    });

    const progress = result.current.activeCharacter?.bossProgress;
    // Refilled to max then consumed one.
    expect(progress?.attacksLeft).toBe(GAME_RULES.BOSS.MAX_DAILY_ATTACKS - 1);
    expect(progress?.totalKills).toBe(1);
    expect(progress?.bossHp).toBe(4600);
  });
});
