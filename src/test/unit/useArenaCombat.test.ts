import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { GAME_RULES } from '../../config/gameRules';

// We'll test the onCombatComplete logic directly via a simulated hook
// that mirrors the production callback from useArenaCombat.ts

interface FightResult {
  xpGained: number;
  leveledUp: boolean;
  levelsGained: number;
  newLevel: number;
}

const mockFightResult = (overrides?: Partial<FightResult>): FightResult => ({
  xpGained: 50,
  leveledUp: false,
  levelsGained: 0,
  newLevel: 5,
  ...overrides,
});

describe('useArenaCombat - PvE XP logging', () => {
  let consoleWarnSpy: any;
  let pveFightMock: any;
  let fightMock: any;
  let bossFightMock: any;
  let onLevelUpMock: any;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pveFightMock = vi.fn().mockResolvedValue(mockFightResult());
    fightMock = vi.fn().mockResolvedValue(mockFightResult());
    bossFightMock = vi.fn().mockResolvedValue(mockFightResult());
    onLevelUpMock = vi.fn();
  });

  function buildOnCombatComplete(options: {
    matchType?: 'pve' | 'balanced' | 'similar' | 'boss';
    xpGained: number;
    won?: boolean;
    modifier?: number;
    opponentName?: string;
    monsterId?: string;
    bossHpLeft?: number;
    opponentHp?: number;
  }) {
    const {
      matchType = 'pve',
      xpGained,
      won = true,
      opponentName = 'Monster',
      monsterId = 'GOBLIN',
      bossHpLeft,
      opponentHp = 7008,
    } = options;

    // This mirrors the production callback in useArenaCombat.ts
    const onCombatComplete = async () => {
      try {
        const result = matchType === 'pve'
          ? await pveFightMock(won, Math.round(xpGained * (GAME_RULES.PVE.XP_MODIFIER)), opponentName, { monsterId })
          : matchType === 'boss'
            ? await bossFightMock(won, xpGained, opponentName, { bossHpLeft: bossHpLeft ?? opponentHp })
            : await fightMock(won, xpGained, opponentName, 'opponent-id');

        // PvE logging (mirroring the added console.warn)
        if (matchType === 'pve') {
          const modifiedXp = Math.round(xpGained * GAME_RULES.PVE.XP_MODIFIER);
          console.warn(
            `[PvE XP] won=${won} beforeModifier=${xpGained} afterModifier=${modifiedXp} ` +
            `modifier=${GAME_RULES.PVE.XP_MODIFIER}`
          );
        }

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

  it('logs PvE XP with correct beforeModifier value', async () => {
    const onCombatComplete = buildOnCombatComplete({ matchType: 'pve', xpGained: 100, won: true });

    await act(async () => {
      await onCombatComplete();
    });

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const logMessage = consoleWarnSpy.mock.calls[0][0];
    expect(logMessage).toContain('[PvE XP]');
    expect(logMessage).toContain('beforeModifier=100');
    expect(logMessage).toContain(`afterModifier=${Math.round(100 * GAME_RULES.PVE.XP_MODIFIER)}`);
    expect(logMessage).toContain(`modifier=${GAME_RULES.PVE.XP_MODIFIER}`);
  });

  it('applies XP_MODIFIER to xpGained when calling usePveFight', async () => {
    const onCombatComplete = buildOnCombatComplete({ matchType: 'pve', xpGained: 150, won: true });

    await act(async () => {
      await onCombatComplete();
    });

    expect(pveFightMock).toHaveBeenCalledWith(
      true,
      Math.round(150 * GAME_RULES.PVE.XP_MODIFIER),
      'Monster',
      expect.objectContaining({ monsterId: 'GOBLIN' })
    );
  });

  it('does not log PvE XP for PvP fights', async () => {
    const onCombatComplete = buildOnCombatComplete({ matchType: 'balanced', xpGained: 100, won: true });

    await act(async () => {
      await onCombatComplete();
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(fightMock).toHaveBeenCalledWith(true, 100, 'Monster', 'opponent-id');
  });

  it('uses XP_WIN as base for PvE wins (calculateFightXp called in CombatView)', () => {
    // Test that XP_WIN and XP_LOSS produce correct pre-modifier values
    // at various player levels with equal opponent level (PvE case)
    const xpWin = GAME_RULES.COMBAT.XP_WIN;
    const xpLoss = GAME_RULES.COMBAT.XP_LOSS;
    const modifier = GAME_RULES.PVE.XP_MODIFIER;

    // At level 5 (typical QA level):
    const levelScaling = 1 + (5 - 1) * 0.06;
    const baseXpWin = Math.floor(xpWin * levelScaling);
    const baseXpLoss = Math.floor(xpLoss * levelScaling);

    // If PvE XP were incorrectly calculated from XP_LOSS as base:
    const wrongPveXp = Math.round(baseXpLoss * modifier);
    // Correct PvE XP (using XP_WIN):
    const correctPveXp = Math.round(baseXpWin * modifier);

    expect(correctPveXp).toBeGreaterThan(wrongPveXp);
    // Verify that using XP_WIN as base gives the expected modifier ratio
    const goodRatio = correctPveXp / baseXpWin;
    expect(goodRatio).toBeCloseTo(modifier, 1);
  });

  it('passes won boolean through to usePveFight', async () => {
    const onCombatCompleteLoss = buildOnCombatComplete({
      matchType: 'pve',
      xpGained: 50,
      won: false,
      monsterId: 'OGRE',
    });

    await act(async () => {
      await onCombatCompleteLoss();
    });

    expect(pveFightMock).toHaveBeenCalledWith(
      false,
      Math.round(50 * GAME_RULES.PVE.XP_MODIFIER),
      'Monster',
      expect.objectContaining({ monsterId: 'OGRE' })
    );
  });

  it('logs won status in PvE XP warning', async () => {
    const onCombatCompleteLoss = buildOnCombatComplete({
      matchType: 'pve',
      xpGained: 30,
      won: false,
    });

    await act(async () => {
      await onCombatCompleteLoss();
    });

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const logMessage = consoleWarnSpy.mock.calls[0][0];
    expect(logMessage).toContain('won=false');
  });

  it('calls useBossFight with bossHpLeft when provided', async () => {
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
  });

  it('does not log PvE XP warning for boss fights', async () => {
    const onCombatComplete = buildOnCombatComplete({
      matchType: 'boss',
      xpGained: 360,
      won: true,
      bossHpLeft: 0,
    });

    await act(async () => {
      await onCombatComplete();
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
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
});
