import { describe, expect, it } from 'vitest';
import { GAME_RULES } from '../../config/gameRules';
import {
    buildLevelOneReserveTarget,
    getBotActivityProfile,
    getBotFightBudgetForRun,
    isEndOfDayDrainWindow
} from '../../utils/botBehaviorUtils';

const sequenceRng = (values: number[]) => {
    const queue = [...values];
    return () => queue.shift() ?? 0.99;
};

describe('botBehaviorUtils', () => {
    it('keeps a minimum level 1 reserve even without human players', () => {
        const reserve = buildLevelOneReserveTarget(0);
        expect(reserve).toBeGreaterThanOrEqual(GAME_RULES.BOTS.MIN_LVL1_BOTS);
    });

    it('scales level 1 reserve with level 1 human demand', () => {
        const lowDemand = buildLevelOneReserveTarget(2);
        const highDemand = buildLevelOneReserveTarget(20);
        expect(highDemand).toBeGreaterThan(lowDemand);
    });

    it('builds deterministic activity profiles per bot id/seed', () => {
        const profileA = getBotActivityProfile('bot-1', 'seed-1');
        const profileB = getBotActivityProfile('bot-1', 'seed-1');
        const profileC = getBotActivityProfile('bot-2', 'seed-1');

        expect(profileA).toEqual(profileB);
        expect(profileA).not.toEqual(profileC);
    });

    it('returns zero fight budget when bot has no energy', () => {
        const budget = getBotFightBudgetForRun({
            fightsLeft: 0,
            parisHour: 12,
            profile: { aggression: 0.8, discipline: 0.8, unpredictability: 0.2 }
        });
        expect(budget).toBe(0);
    });

    it('caps fight budget to per-run and available energy', () => {
        const budget = getBotFightBudgetForRun({
            fightsLeft: 2,
            parisHour: 20,
            profile: { aggression: 1, discipline: 1, unpredictability: 0.15 },
            rng: sequenceRng([0, 0, 0])
        });
        expect(budget).toBeLessThanOrEqual(GAME_RULES.BOTS.MAX_FIGHTS_PER_RUN);
        expect(budget).toBeLessThanOrEqual(2);
        expect(budget).toBe(2);
    });

    it('can schedule rest when activity roll fails', () => {
        const budget = getBotFightBudgetForRun({
            fightsLeft: 5,
            parisHour: 10,
            profile: { aggression: 0.35, discipline: 0.30, unpredictability: 0.65 },
            rng: sequenceRng([0.99])
        });
        expect(budget).toBe(0);
    });

    it('detects end-of-day drain window at configured hour', () => {
        expect(isEndOfDayDrainWindow(22)).toBe(true);
        expect(isEndOfDayDrainWindow(23)).toBe(true);
        expect(isEndOfDayDrainWindow(21)).toBe(false);
    });
});
