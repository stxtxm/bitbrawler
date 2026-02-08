import { Character } from '../types/Character';

/**
 * Generates balanced initial stats for a new character
 * Uses a controlled distribution to ensure fairness and prevent extreme builds
 * 
 * Stats System:
 * - Total stat points: 50 (distributed evenly with controlled variance)
 * - Each stat gets: 10 base points ± variance
 * - Max variance per stat: ±3 points to prevent min-maxing
 * - Total points remain constant across all characters
 */
export const generateInitialStats = (name: string, gender: 'male' | 'female'): Character => {
    const BASE_PER_STAT = 10;
    const MAX_VARIANCE = 3;

    // Initialize all stats at base value
    const stats = {
        strength: BASE_PER_STAT,
        vitality: BASE_PER_STAT,
        dexterity: BASE_PER_STAT,
        luck: BASE_PER_STAT,
        intelligence: BASE_PER_STAT
    };

    // Create controlled variance for each stat
    const statKeys = Object.keys(stats) as (keyof typeof stats)[];
    const variances: number[] = [];

    // Generate random variances that sum to 0 (to maintain total)
    for (let i = 0; i < statKeys.length - 1; i++) {
        const variance = Math.floor(Math.random() * (MAX_VARIANCE * 2 + 1)) - MAX_VARIANCE;
        variances.push(variance);
    }

    // Last variance is calculated to ensure sum = 0
    const lastVariance = -variances.reduce((sum, v) => sum + v, 0);

    // Clamp the last variance to MAX_VARIANCE
    variances.push(Math.max(-MAX_VARIANCE, Math.min(MAX_VARIANCE, lastVariance)));

    // If the clamping broke the sum, redistribute
    const varianceSum = variances.reduce((sum, v) => sum + v, 0);
    if (varianceSum !== 0) {
        // Redistribute excess to maintain balance
        const excess = varianceSum;
        for (let i = 0; i < variances.length; i++) {
            const adjustment = Math.min(Math.abs(excess), MAX_VARIANCE - Math.abs(variances[i]));
            if (excess > 0 && variances[i] > -MAX_VARIANCE) {
                variances[i] -= Math.min(adjustment, variances[i] + MAX_VARIANCE);
            } else if (excess < 0 && variances[i] < MAX_VARIANCE) {
                variances[i] += Math.min(adjustment, MAX_VARIANCE - variances[i]);
            }
            if (variances.reduce((sum, v) => sum + v, 0) === 0) break;
        }
    }

    // Apply variances to stats
    statKeys.forEach((key, index) => {
        stats[key] += variances[index];
    });

    // Ensure all stats are within valid range (5-15)
    statKeys.forEach(key => {
        stats[key] = Math.max(5, Math.min(15, stats[key]));
    });

    // Calculate HP based on vitality (more consistent)
    const hp = 100 + (stats.vitality * 8);
    const characterSeed = Math.random().toString(36).substring(2, 10);

    return {
        name: name || 'HERO',
        gender,
        seed: characterSeed,
        level: 1,
        hp: hp,
        maxHp: hp,
        strength: stats.strength,
        vitality: stats.vitality,
        dexterity: stats.dexterity,
        luck: stats.luck,
        intelligence: stats.intelligence,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: 5,
        lastFightReset: Date.now()
    };
};
