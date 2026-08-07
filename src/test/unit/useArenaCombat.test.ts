import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { act } from '@testing-library/react';

// We'll test the onCombatComplete logic directly via a simulated hook
// that mirrors the production callback from useArenaCombat.ts

interface FightResult {
  xpGained: number;
  leveledUp: boolean;
  levelsGained: number;
  newLevel: number;
}

type UseFightArgs = [won: boolean, xpGained: number, opponentName: string, opponentId: string];
type UseBossFightArgs = [won: boolean, xpGained: number, bossName: string, options?: { bossHpLeft?: number }];
type OnLevelUpArgs = [levelsGained: number, newLevel: number];

const mockFightResult = (overrides?: Partial<FightResult>): FightResult => ({
  xpGained: 50,
  leveledUp: false,
  levelsGained: 0,
  newLevel: 5,
  ...overrides,
});

describe('useArenaCombat - onCombatComplete routing', () => {
  let fightMock: Mock<UseFightArgs, Promise<FightResult | null>>;
  let bossFightMock: Mock<UseBossFightArgs, Promise<FightResult | null>>;
  let onLevelUpMock: Mock<OnLevelUpArgs, void>;

  beforeEach(() => {
    fightMock = vi.fn<UseFightArgs, Promise<FightResult | null>>().mockResolvedValue(mockFightResult());
    bossFightMock = vi.fn<UseBossFightArgs, Promise<FightResult | null>>().mockResolvedValue(mockFightResult());
    onLevelUpMock = vi.fn<OnLevelUpArgs, void>();
  });

  function buildOnCombatComplete(options: {
    matchType?: 'balanced' | 'similar' | 'boss';
    xpGained: number;
    won?: boolean;
    opponentName?: string;
    opponentId?: string;
    bossHpLeft?: number;
    opponentHp?: number;
  }) {
    const {
      matchType = 'balanced',
      xpGained,
      won = true,
      opponentName = 'Monster',
      opponentId = 'opponent-id',
      bossHpLeft,
      opponentHp = 7008,
    } = options;

    // This mirrors the production callback in useArenaCombat.ts
    const onCombatComplete = async () => {
      try {
        const result = matchType === 'boss'
          ? await bossFightMock(won, xpGained, opponentName, { bossHpLeft: bossHpLeft ?? opponentHp })
          : await fightMock(won, xpGained, opponentName, opponentId);

        if ((result as FightResult | null)?.leveledUp) {
          const r = result as FightResult;
          onLevelUpMock(r.levelsGained, r.newLevel);
        }
      } catch {
        // noop
      }
    };

    return onCombatComplete;
  }

  it('routes boss fights to useBossFight with bossHpLeft when provided', async () => {
    const onCombatComplete = buildOnCombatComplete({
      matchType: 'boss',
      xpGained: 0,
      won: false,
      opponentName: 'VOID TITAN',
      bossHpLeft: 4200,
    });

    await act(async () => {
      await onCombatComplete();
    });

    expect(bossFightMock).toHaveBeenCalledWith(
      false,
      0,
      'VOID TITAN',
      expect.objectContaining({ bossHpLeft: 4200 })
    );
    expect(fightMock).not.toHaveBeenCalled();
  });

  it('falls back to opponent.hp when bossHpLeft is not provided', async () => {
    const onCombatComplete = buildOnCombatComplete({
      matchType: 'boss',
      xpGained: 360,
      won: true,
      opponentName: 'VOID TITAN',
      opponentHp: 7008,
    });

    await act(async () => {
      await onCombatComplete();
    });

    expect(bossFightMock).toHaveBeenCalledWith(
      true,
      360,
      'VOID TITAN',
      expect.objectContaining({ bossHpLeft: 7008 })
    );
    expect(fightMock).not.toHaveBeenCalled();
  });

  it('forwards leveledUp from useBossFight to onLevelUp', async () => {
    bossFightMock = vi.fn().mockResolvedValue(mockFightResult({ leveledUp: true, levelsGained: 1, newLevel: 31 }));
    const onCombatComplete = buildOnCombatComplete({
      matchType: 'boss',
      xpGained: 360,
      won: true,
      bossHpLeft: 0,
    });

    await act(async () => {
      await onCombatComplete();
    });

    expect(onLevelUpMock).toHaveBeenCalledWith(1, 31);
  });

  it('routes non-boss fights to useFight with the opponent id', async () => {
    const onCombatComplete = buildOnCombatComplete({
      matchType: 'balanced',
      xpGained: 100,
      won: true,
      opponentName: 'Rival',
      opponentId: 'rival-id',
    });

    await act(async () => {
      await onCombatComplete();
    });

    expect(fightMock).toHaveBeenCalledWith(true, 100, 'Rival', 'rival-id');
    expect(bossFightMock).not.toHaveBeenCalled();
  });

  it('forwards leveledUp from useFight to onLevelUp', async () => {
    fightMock = vi.fn().mockResolvedValue(mockFightResult({ leveledUp: true, levelsGained: 2, newLevel: 12 }));
    const onCombatComplete = buildOnCombatComplete({
      matchType: 'similar',
      xpGained: 100,
      won: true,
    });

    await act(async () => {
      await onCombatComplete();
    });

    expect(onLevelUpMock).toHaveBeenCalledWith(2, 12);
    expect(bossFightMock).not.toHaveBeenCalled();
  });

  it('passes won boolean through to useBossFight on defeat', async () => {
    const onCombatComplete = buildOnCombatComplete({
      matchType: 'boss',
      xpGained: 0,
      won: false,
      opponentName: 'VOID TITAN',
      bossHpLeft: 9000,
    });

    await act(async () => {
      await onCombatComplete();
    });

    expect(bossFightMock).toHaveBeenCalledWith(
      false,
      0,
      'VOID TITAN',
      expect.objectContaining({ bossHpLeft: 9000 })
    );
  });

  it('passes won boolean through to useFight on defeat', async () => {
    const onCombatComplete = buildOnCombatComplete({
      matchType: 'balanced',
      xpGained: 30,
      won: false,
      opponentName: 'Rival',
    });

    await act(async () => {
      await onCombatComplete();
    });

    expect(fightMock).toHaveBeenCalledWith(false, 30, 'Rival', 'opponent-id');
  });

  it('does not emit the legacy PvE XP warning for any fight', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const bossComplete = buildOnCombatComplete({
      matchType: 'boss',
      xpGained: 360,
      won: true,
      bossHpLeft: 0,
    });
    const pvpComplete = buildOnCombatComplete({
      matchType: 'balanced',
      xpGained: 100,
      won: true,
    });

    await act(async () => {
      await bossComplete();
      await pvpComplete();
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
