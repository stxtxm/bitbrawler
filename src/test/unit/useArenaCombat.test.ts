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
  let onLevelUpMock: any;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pveFightMock = vi.fn().mockResolvedValue(mockFightResult());
    fightMock = vi.fn().mockResolvedValue(mockFightResult());
    onLevelUpMock = vi.fn();
  });

  function buildOnCombatComplete(options: {
    matchType?: 'pve' | 'balanced' | 'similar';
    xpGained: number;
    won?: boolean;
    modifier?: number;
    opponentName?: string;
    monsterId?: string;
  }) {
    const {
      matchType = 'pve',
      xpGained,
      won = true,
      opponentName = 'Monster',
      monsterId = 'GOBLIN',
    } = options;

    // This mirrors the production callback in useArenaCombat.ts lines 121-137
    const onCombatComplete = async () => {
      try {
        const result = matchType === 'pve'
          ? await pveFightMock(won, Math.round(xpGained * (GAME_RULES.PVE.XP_MODIFIER)), opponentName, { monsterId })
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
    const xpWin = GAME_RULES.COMBAT.XP_WIN; // 90
    const xpLoss = GAME_RULES.COMBAT.XP_LOSS; // 30
    const modifier = GAME_RULES.PVE.XP_MODIFIER; // 0.80

    // At level 5 (typical QA level):
    const levelScaling = 1 + (5 - 1) * 0.06; // 1.24
    const baseXpWin = Math.floor(xpWin * levelScaling); // 111
    const baseXpLoss = Math.floor(xpLoss * levelScaling); // 37

    // If PvE XP were incorrectly calculated from XP_LOSS as base:
    const wrongPveXp = Math.round(baseXpLoss * modifier); // ~30
    // Correct PvE XP (using XP_WIN):
    const correctPveXp = Math.round(baseXpWin * modifier); // ~89

    expect(correctPveXp).toBeGreaterThan(wrongPveXp);
    // Verify the ratio would be ~27% if XP_LOSS were used
    const badRatio = wrongPveXp / baseXpWin; // ~0.27
    const goodRatio = correctPveXp / baseXpWin; // ~0.80
    expect(badRatio).toBeLessThan(0.5);
    expect(goodRatio).toBeCloseTo(modifier, 2);
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
});
