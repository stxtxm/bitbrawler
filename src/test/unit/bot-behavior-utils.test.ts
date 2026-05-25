import { describe, expect, it } from 'vitest';
import { GAME_RULES } from '../../config/gameRules';
import {
    buildLevelOneReserveTarget,
    getBotActivityProfile,
    getBotFightBudgetForRun,
    isEndOfDayDrainWindow,
    selectProtectedLevelOneBotIds,
    BotCharacter
} from '../../utils/botBehaviorUtils';

const sequenceRng = (values: number[]) => {
    const queue = [...values];
    return () => queue.shift() ?? 0.99;
};

/** Build a minimal BotCharacter for testing */
const bot = (
    id: string,
    level: number,
    battleCount: number,
    fightsLeft: number
): BotCharacter => ({
    name: id,
    seed: 'test',
    gender: 'male',
    id,
    level,
    experience: 0,
    strength: 10,
    vitality: 10,
    dexterity: 10,
    luck: 10,
    intelligence: 10,
    focus: 10,
    hp: 100,
    maxHp: 100,
    wins: 0,
    losses: 0,
    fightsLeft,
    lastFightReset: 0,
    firestoreId: id,
    battleCount,
});

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

describe('selectProtectedLevelOneBotIds', () => {
    // ─── Edge cases ────────────────────────────────────────────
    it('returns empty set when no bots given', () => {
        const result = selectProtectedLevelOneBotIds([], new Set(), 10);
        expect(result.size).toBe(0);
    });

    it('returns empty set when count is zero', () => {
        const bots = [bot('a', 1, 0, 5)];
        const result = selectProtectedLevelOneBotIds(bots, new Set(), 0);
        expect(result.size).toBe(0);
    });

    it('preserves existing skipIds when nothing to protect', () => {
        const bots = [bot('a', 1, 3, 1)];
        const skip = new Set(['x', 'y']);
        const result = selectProtectedLevelOneBotIds(bots, skip, 5);
        expect(result.has('x')).toBe(true);
        expect(result.has('y')).toBe(true);
        // 'a' has battleCount=3 which is high — skip 'x','y' are not bots so only 'a' could be added
        // but there aren't 5 lvl1 bots, so nothing extra is protected
    });

    // ─── Selection logic ───────────────────────────────────────
    it('protects bots with lowest battleCount first', () => {
        const bots = [
            bot('a', 1, 10, 5),
            bot('b', 1, 0, 5),
            bot('c', 1, 5, 5),
        ];
        const result = selectProtectedLevelOneBotIds(bots, new Set(), 2);
        // Should pick b (0) and c (5) — lowest battleCount
        expect(result.has('b')).toBe(true);
        expect(result.has('c')).toBe(true);
        expect(result.has('a')).toBe(false);
    });

    it('breaks ties by highest fightsLeft', () => {
        const bots = [
            bot('a', 1, 0, 1),
            bot('b', 1, 0, 5),
            bot('c', 1, 0, 3),
        ];
        const result = selectProtectedLevelOneBotIds(bots, new Set(), 2);
        // Should pick b (5 energy) and c (3 energy) over a (1 energy)
        expect(result.has('b')).toBe(true);
        expect(result.has('c')).toBe(true);
        expect(result.has('a')).toBe(false);
    });

    it('never protects more than available pool minus MIN_LVL1_ACTIVE_BOTS', () => {
        const bots = [
            bot('a', 1, 0, 5),
            bot('b', 1, 0, 5),
        ];
        // With only 2 bots and MIN_ACTIVE = 1, max protectable = 2 - 1 = 1
        const result = selectProtectedLevelOneBotIds(bots, new Set(), 10);
        expect(result.size).toBe(1);
    });

    it('protects only up to requested count even if more eligible', () => {
        const bots = [
            bot('a', 1, 0, 5),
            bot('b', 1, 0, 5),
            bot('c', 1, 0, 5),
        ];
        const result = selectProtectedLevelOneBotIds(bots, new Set(), 2);
        expect(result.size).toBe(2);
    });

    it('ignores non-level-1 bots', () => {
        // 3 level-1 + 1 level-5 → pool has 3 eligible, MIN_ACTIVE leaves 2 protectable
        const bots = [
            bot('a', 1, 0, 5),
            bot('b', 5, 0, 5),  // level 5 — ignored
            bot('c', 1, 0, 5),
            bot('d', 1, 0, 5),
        ];
        const result = selectProtectedLevelOneBotIds(bots, new Set(), 3);
        expect(result.has('b')).toBe(false);
        expect(result.size).toBe(2); // pool=3 - MIN_ACTIVE=1 → max protectable 2
        // a, c, d are the only level-1 bots eligible
        const protectedLvl1 = Array.from(result).filter(id => ['a', 'c', 'd'].includes(id));
        expect(protectedLvl1.length).toBe(2);
    });

    // ─── exemptFromProtection ──────────────────────────────────
    it('never protects exempted bots even if they have lowest battleCount', () => {
        // Need 4 eligible (3 non-exempt) so 2 can be protected (pool - MIN_ACTIVE)
        const bots = [
            bot('a', 1, 0, 5),
            bot('b', 1, 0, 5),
            bot('c', 1, 5, 5),
            bot('d', 1, 10, 5),
        ];
        const exempt = new Set(['a']);
        const result = selectProtectedLevelOneBotIds(bots, new Set(), 3, exempt);
        // a is exempt, so b (battleCount 0) is protected first, then c (battleCount 5)
        expect(result.has('b')).toBe(true);
        expect(result.has('c')).toBe(true);
        expect(result.has('a')).toBe(false);
        // d might or might not be protected (pool=3 - MIN_ACTIVE=1 → max 2)
        expect(result.size).toBe(2);
    });

    it('does not skip protection for non-level-1 exempted bots', () => {
        const bots = [
            bot('a', 1, 0, 5),
            bot('b', 1, 5, 5),
        ];
        // exempt has 'c' which is not in bots — no effect
        const exempt = new Set(['c']);
        const result = selectProtectedLevelOneBotIds(bots, new Set(), 1, exempt);
        expect(result.has('a')).toBe(true);
    });

    it('exempted bot does not reduce maxProtectable headroom', () => {
        // Two exempt + one regular = pool has only 1 protectable bot left
        const bots = [
            bot('a', 1, 0, 5),
            bot('b', 1, 0, 5),
            bot('c', 1, 0, 5),
        ];
        const exempt = new Set(['a', 'b']);
        // levelOnePool after exempt filter = [c]
        // maxProtectable = max(0, 1 - MIN_ACTIVE) = 0 (since MIN_ACTIVE=1)
        const result = selectProtectedLevelOneBotIds(bots, new Set(), 3, exempt);
        expect(result.has('c')).toBe(false); // c is the only non-exempt, but MIN_ACTIVE keeps it free
        expect(result.size).toBe(0);
    });

    it('combines skipIds with exemptFromProtection correctly', () => {
        const bots = [
            bot('a', 1, 0, 5),
            bot('b', 1, 0, 5),
            bot('c', 1, 0, 5),
        ];
        const skip = new Set(['a']);
        const exempt = new Set(['b']);
        const result = selectProtectedLevelOneBotIds(bots, skip, 2, exempt);
        // a is already skipped, b is exempt, only c is eligible → but MIN_ACTIVE=1 so c stays free
        expect(result.has('a')).toBe(true);  // preserved from skip
        expect(result.has('b')).toBe(false); // exempt
        expect(result.has('c')).toBe(false); // only 1 eligible but MIN_ACTIVE blocks it
    });

    it('exempt does not protect from being counted as alreadyProtected', () => {
        // Already-protected (from skipIds) should still be counted even if also in exempt
        // Need 3+ eligible bots so at least 1 can be protected after MIN_ACTIVE
        const bots = [
            bot('a', 1, 0, 5),
            bot('b', 1, 0, 5),
            bot('c', 1, 0, 5),
        ];
        const skip = new Set(['a']);
        const exempt = new Set(['a']); // same bot in both
        // alreadyProtected = 1 (from skipIds), additionalNeeded = 1 (protect 2 - 1 already)
        // levelOnePool after skip+exempt: b(0,5), c(0,5) → 2 eligible
        // maxProtectable = max(0, 2 - MIN_ACTIVE) = 1
        const result = selectProtectedLevelOneBotIds(bots, skip, 2, exempt);
        expect(result.has('a')).toBe(true);  // preserved from skip
        // One of b or c should be protected (the one sorted first)
        const protectedNonA = Array.from(result).filter(id => id !== 'a');
        expect(protectedNonA.length).toBe(1);
    });

    // ─── Realistic scenario ────────────────────────────────────
    it('realistic scenario: 40 bots, protect 10, exempt 2 new spawns', () => {
        const bots: BotCharacter[] = [];
        // 30 established bots with various battleCounts
        for (let i = 0; i < 30; i++) {
            bots.push(bot(`est-${i}`, 1, i * 2, Math.max(1, 5 - (i % 5))));
        }
        // 10 fresh spawns
        for (let i = 0; i < 10; i++) {
            bots.push(bot(`new-${i}`, 1, 0, 5));
        }
        // 2 newlySpawed (this run)
        const exempt = new Set(['new-0', 'new-1']);

        const result = selectProtectedLevelOneBotIds(bots, new Set(), 10, exempt);

        // Exempt bots are never selected
        expect(result.has('new-0')).toBe(false);
        expect(result.has('new-1')).toBe(false);

        // Exactly 10 protected (unless overflow by MIN_ACTIVE)
        expect(result.size).toBe(10);

        // All protected bots are level-1
        for (const id of result) {
            const matched = bots.find(b => b.id === id || b.firestoreId === id);
            expect(matched?.level).toBe(1);
        }

        // The protected set does not overlap with exempt
        for (const id of result) {
            expect(exempt.has(id)).toBe(false);
        }

        // The 2 non-exempt fresh spawns (new-2..new-9) ARE eligible for protection
        const protectedFresh = Array.from(result).filter(id => id.startsWith('new-'));
        // Most of the non-exempt new spawns should be protected (they have battleCount=0)
        expect(protectedFresh.length).toBeGreaterThanOrEqual(5);
    });
});
