import { GAME_RULES } from '../config/gameRules';
import { getSeedFromText, mulberry32 } from './randomUtils';

export type BotActivityProfile = {
    aggression: number;
    discipline: number;
    unpredictability: number;
};

type FightBudgetInput = {
    fightsLeft: number;
    parisHour: number;
    profile: BotActivityProfile;
    activityRate?: number;
    rng?: () => number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const buildLevelOneReserveTarget = (humanLevelOneCount: number): number => {
    const safeHumanCount = Math.max(0, Math.floor(humanLevelOneCount));
    const fromDemand = Math.ceil(
        (safeHumanCount * GAME_RULES.BOTS.LVL1_RESERVE_PER_HUMAN) +
        GAME_RULES.BOTS.LVL1_RESERVE_BUFFER
    );
    return Math.max(GAME_RULES.BOTS.MIN_LVL1_BOTS, fromDemand);
};

export const getBotActivityProfile = (botId: string, seed = ''): BotActivityProfile => {
    const profileRng = mulberry32(getSeedFromText(`${botId}:${seed}`));

    return {
        aggression: 0.35 + profileRng() * 0.65,
        discipline: 0.30 + profileRng() * 0.70,
        unpredictability: 0.15 + profileRng() * 0.50
    };
};

export const isEndOfDayDrainWindow = (
    parisHour: number,
    startHour = GAME_RULES.BOTS.END_OF_DAY_DRAIN_START_HOUR
): boolean => {
    const safeHour = clamp(Math.floor(parisHour), 0, 23);
    const safeStart = clamp(Math.floor(startHour), 0, 23);
    return safeHour >= safeStart;
};

export const getBotFightBudgetForRun = ({
    fightsLeft,
    parisHour,
    profile,
    activityRate = GAME_RULES.BOTS.ACTIVITY_RATE,
    rng = Math.random
}: FightBudgetInput): number => {
    if (fightsLeft <= 0) return 0;

    const maxDaily = GAME_RULES.COMBAT.MAX_DAILY_FIGHTS;
    const safeHour = clamp(Math.floor(parisHour), 0, 23);
    const spentToday = clamp(maxDaily - fightsLeft, 0, maxDaily);
    const expectedSpentByNow = Math.floor((safeHour / 24) * maxDaily);
    const isPrimeTime = safeHour >= 18 || safeHour <= 1;

    const pressure = fightsLeft / maxDaily;
    let activityChance =
        activityRate +
        (profile.discipline * 0.20) +
        (profile.aggression * 0.10) +
        (pressure >= 0.8 ? 0.08 : 0) +
        (isPrimeTime ? 0.08 : 0) -
        (profile.unpredictability * 0.08);

    if (spentToday > expectedSpentByNow + 1) {
        activityChance -= 0.22;
    } else if (spentToday < expectedSpentByNow) {
        activityChance += 0.16;
    }

    activityChance = clamp(activityChance, 0.08, 0.94);
    if (rng() > activityChance) return 0;

    const baseActions = 1 + (rng() < (0.22 + profile.aggression * 0.25) ? 1 : 0);
    const burstChance = (isPrimeTime ? 0.24 : 0.10) + (profile.aggression * 0.12);
    const burstActions = rng() < burstChance ? 1 : 0;

    let budget = baseActions + burstActions;

    if (safeHour >= 22 && spentToday < maxDaily - 1 && rng() < 0.35) {
        budget += 1;
    }

    budget = clamp(budget, 1, GAME_RULES.BOTS.MAX_FIGHTS_PER_RUN);
    return Math.min(fightsLeft, budget);
};
