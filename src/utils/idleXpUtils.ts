import { GAME_RULES } from '../config/gameRules';
import { Character } from '../types/Character';
import { OfflineGains } from '../types/IdleCombat';
import { calculateFightXp, gainXp } from './xpUtils';

const IDLE_MODIFIER = GAME_RULES.IDLE.XP_MODIFIER;
const INTERVAL_MS = GAME_RULES.IDLE.COMBAT_INTERVAL_MS;
const MAX_OFFLINE_HOURS = GAME_RULES.IDLE.OFFLINE_MAX_HOURS;

const IDLE_WIN_RATE = 0.7;

export function calculateIdleXp(won: boolean, playerLevel: number): number {
    if (playerLevel >= 99) return 0;
    const baseXp = calculateFightXp(won, playerLevel);
    return Math.floor(baseXp * IDLE_MODIFIER);
}

export function calculateOfflineGains(
    character: Character,
    elapsedHours: number
): OfflineGains {
    const cappedHours = Math.min(elapsedHours, MAX_OFFLINE_HOURS);
    const elapsedMs = cappedHours * 3600000;
    const totalFights = Math.floor(elapsedMs / INTERVAL_MS);

    if (totalFights <= 0) {
        return { fightsSimulated: 0, wins: 0, totalXpGained: 0, levelsGained: 0, elapsedHours };
    }

    let current = { ...character };
    let wins = 0;
    let totalXp = 0;

    for (let i = 0; i < totalFights; i++) {
        const won = Math.random() < IDLE_WIN_RATE;
        if (won) wins++;
        const xp = calculateIdleXp(won, current.level);
        const result = gainXp(current, xp);
        current = result.updatedCharacter;
        totalXp += xp;
    }

    const levelsGained = current.level - character.level;

    return {
        fightsSimulated: totalFights,
        wins,
        totalXpGained: totalXp,
        levelsGained,
        elapsedHours,
    };
}
