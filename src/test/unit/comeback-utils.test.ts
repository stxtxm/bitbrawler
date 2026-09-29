import { describe, it, expect, beforeEach } from 'vitest';
import {
  getConsecutiveLosses,
  getSecondWindEssence,
  isLossPityFloorActive,
  getLossPityMinRarity,
  startRecoveryQuest,
  getRecoveryQuest,
  completeRecoveryQuest,
  isRecoveryQuestActive,
  clearRecoveryQuest,
  loadRecoveries,
  recordRecovery,
  getComebackBadge,
} from '../../utils/comebackUtils';
import { GAME_RULES } from '../../config/gameRules';
import { Character } from '../../types/Character';

const makeHistory = (flags: boolean[]) =>
  flags.map((won, i) => ({ date: Date.now() - i * 1000, opponentName: `opp${i}`, won }));

const charId = 'comeback-test-char';

beforeEach(() => {
  clearRecoveryQuest(charId);
  try {
    localStorage.clear();
  } catch {
  }
});

describe('getConsecutiveLosses', () => {
  it('retourne 0 sans historique', () => {
    expect(getConsecutiveLosses(undefined)).toBe(0);
    expect(getConsecutiveLosses([])).toBe(0);
  });

  it('compte les défaites depuis le plus récent', () => {
    expect(getConsecutiveLosses(makeHistory([false, false, false]))).toBe(3);
    expect(getConsecutiveLosses(makeHistory([false, false, true]))).toBe(2);
    expect(getConsecutiveLosses(makeHistory([true, false, false]))).toBe(0);
  });
});

describe('getSecondWindEssence', () => {
  it('vaut 0 sur victoire ou sans série', () => {
    expect(getSecondWindEssence(0, false)).toBe(0);
    expect(getSecondWindEssence(3, true)).toBe(0);
  });

  it('donne +5 par défaite consécutive', () => {
    expect(getSecondWindEssence(1, false)).toBe(5);
    expect(getSecondWindEssence(2, false)).toBe(10);
    expect(getSecondWindEssence(3, false)).toBe(15);
  });

  it('plafonne au cap config', () => {
    expect(getSecondWindEssence(10, false)).toBe(GAME_RULES.COMEBACK.SECOND_WIND_CAP);
    expect(GAME_RULES.COMEBACK.SECOND_WIND_CAP).toBe(25);
  });
});

describe('loss pity floor', () => {
  it('inactif sous 3 défaites, actif dès 3', () => {
    expect(isLossPityFloorActive(0)).toBe(false);
    expect(isLossPityFloorActive(2)).toBe(false);
    expect(isLossPityFloorActive(3)).toBe(true);
    expect(isLossPityFloorActive(5)).toBe(true);
  });

  it('garantit uncommon+ quand actif', () => {
    expect(getLossPityMinRarity(2)).toBeNull();
    expect(getLossPityMinRarity(3)).toBe('uncommon');
  });
});

describe('recovery quest', () => {
  it('démarre après 3 défaites et expire après 24h', () => {
    const quest = startRecoveryQuest(charId, 3);
    expect(quest).not.toBeNull();
    expect(quest?.lossesAtTrigger).toBe(3);
    expect(isRecoveryQuestActive(charId)).toBe(true);
  });

  it('refuse de démarrer sous le seuil', () => {
    expect(startRecoveryQuest(charId, 2)).toBeNull();
    expect(isRecoveryQuestActive(charId)).toBe(false);
  });

  it('complète sur victoire et retourne la récompense', () => {
    startRecoveryQuest(charId, 4);
    const reward = completeRecoveryQuest(charId, true);
    expect(reward).not.toBeNull();
    expect(reward?.essence).toBe(GAME_RULES.COMEBACK.RECOVERY_QUEST_ESSENCE);
    expect(isRecoveryQuestActive(charId)).toBe(false);
  });

  it('ne complète pas sur défaite', () => {
    startRecoveryQuest(charId, 3);
    expect(completeRecoveryQuest(charId, false)).toBeNull();
    expect(isRecoveryQuestActive(charId)).toBe(true);
  });

  it('expire après la fenêtre 24h', () => {
    startRecoveryQuest(charId, 3, Date.now() - GAME_RULES.COMEBACK.RECOVERY_QUEST_WINDOW_MS - 1000);
    expect(isRecoveryQuestActive(charId)).toBe(false);
    expect(getRecoveryQuest(charId)).toBeNull();
  });
});

describe('comeback atlas', () => {
  it('démarre à zéro et incrémente les recoveries', () => {
    expect(loadRecoveries(charId)).toBe(0);
    recordRecovery({ seed: 's', name: 'n', gender: 'male', level: 1, experience: 0, strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10, hp: 100, maxHp: 100, wins: 0, losses: 0, fightsLeft: 5, lastFightReset: Date.now(), id: charId } as Character);
    expect(loadRecoveries(charId)).toBe(1);
  });

  it('attribue un badge selon le palier', () => {
    expect(getComebackBadge(0)).toBeNull();
    expect(getComebackBadge(1)).toBe('comeback_rookie');
    expect(getComebackBadge(12)).toBe('comeback_hero');
  });
});
