import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  areAllDailyChallengesCompleted,
  consumeAllChallengesBonus,
  isAllChallengesBonusAvailable,
  loadDailyChallenges,
  recordArtisanChallenge,
  recordChasseurChallenge,
  recordCombatChallenge,
} from '../../utils/dailyChallengeUtils';

const characterId = 'char-test';

describe('dailyChallengeUtils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('initializes three challenges for the current Paris day', () => {
    const state = loadDailyChallenges(characterId, Date.UTC(2026, 0, 15, 12, 0, 0));
    expect(state.challenges.combattant.target).toBe(3);
    expect(state.challenges.artisan.target).toBe(1);
    expect(state.challenges.chasseur.target).toBe(1);
    expect(state.challenges.combattant.progress).toBe(0);
  });

  it('records combattant progress and completes at 3', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    recordCombatChallenge(characterId, now);
    recordCombatChallenge(characterId, now);
    const state = recordCombatChallenge(characterId, now);
    expect(state.challenges.combattant.completed).toBe(true);
    expect(state.challenges.combattant.progress).toBe(3);
  });

  it('records artisan and chasseur with distinct monsters', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    const a = recordArtisanChallenge(characterId, now);
    expect(a.challenges.artisan.completed).toBe(true);
    recordChasseurChallenge(characterId, 'GOBLIN', now);
    const c = recordChasseurChallenge(characterId, 'GOBLIN', now);
    expect(c.challenges.chasseur.progress).toBe(1);
    expect(c.challenges.chasseur.completed).toBe(true);
    const c2 = recordChasseurChallenge(characterId, 'OGRE', now);
    expect(c2.challenges.chasseur.progress).toBe(1);
    expect(c2.challenges.chasseur.completed).toBe(true);
  });

  it('grants all-completed bonus once', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    recordCombatChallenge(characterId, now);
    recordCombatChallenge(characterId, now);
    recordCombatChallenge(characterId, now);
    recordArtisanChallenge(characterId, now);
    recordChasseurChallenge(characterId, 'SLIME', now);
    const state = loadDailyChallenges(characterId, now);
    expect(areAllDailyChallengesCompleted(state)).toBe(true);
    expect(isAllChallengesBonusAvailable(characterId, now)).toBe(true);
    expect(consumeAllChallengesBonus(characterId, now)).toBe(true);
    expect(consumeAllChallengesBonus(characterId, now)).toBe(false);
  });

  it('resets on a new Paris day', () => {
    const day1 = Date.UTC(2026, 0, 15, 12, 0, 0);
    recordCombatChallenge(characterId, day1);
    const day2 = Date.UTC(2026, 0, 16, 12, 0, 0);
    const state = loadDailyChallenges(characterId, day2);
    expect(state.challenges.combattant.progress).toBe(0);
  });
});
