import { GAME_RULES } from '../config/gameRules';
import { Character } from '../types/Character';
import { HP_PER_LEVEL } from './statUtils';

// Configuration constants derived from central rules
const BASE_XP = 100;
const EXPONENT = 1.8;
const MAX_LEVEL = 99;

/**
 * Calculate the total XP required to reach a specific level.
 */
export function getTotalXpForLevel(level: number): number {
    if (level <= 1) return 0;

    let totalXp = 0;
    for (let i = 1; i < level; i++) {
        totalXp += getXpRequiredForNextLevel(i);
    }
    return Math.floor(totalXp);
}

/**
 * Calculate the XP required to go from current level to next level.
 */
export function getXpRequiredForNextLevel(level: number): number {
    if (level >= MAX_LEVEL) return Infinity;
    return Math.floor(BASE_XP * Math.pow(level, EXPONENT));
}

/**
 * Calculate current XP progress for display.
 */
export function getXpProgress(character: Character) {
    const { level, experience } = character;

    if (level >= MAX_LEVEL) {
        return {
            currentXpInLevel: experience,
            xpForNextLevel: 0,
            percentage: 100,
            isMaxLevel: true,
        };
    }

    const totalXpForCurrentLevel = getTotalXpForLevel(level);
    const xpForNextLevel = getXpRequiredForNextLevel(level);
    const currentXpInLevel = experience - totalXpForCurrentLevel;
    const percentage = Math.min(100, (currentXpInLevel / xpForNextLevel) * 100);

    return {
        currentXpInLevel: Math.max(0, currentXpInLevel),
        xpForNextLevel,
        percentage,
        isMaxLevel: false,
    };
}

/**
 * Calculate XP gained from a fight using centralized rules.
 * Combines player-level scaling, opponent level difference bonus, and small random variance.
 */
export function calculateFightXp(
    won: boolean,
    playerLevel: number,
    opponentLevel?: number
): number {
    const baseXp = won ? GAME_RULES.COMBAT.XP_WIN : GAME_RULES.COMBAT.XP_LOSS;

    // Player-level scaling (+8% per level)
    const levelScaling = 1 + (playerLevel - 1) * 0.08;

    // Opponent level difference bonus (capped to prevent exploitation)
    let diffBonus = 0;
    if (opponentLevel !== undefined) {
        diffBonus = (opponentLevel - playerLevel) * 0.1;
        diffBonus = Math.max(-0.5, Math.min(0.5, diffBonus)); // cap at +/- 50%
    }

    // Small random variance (+/- 10%)
    const variance = 0.9 + Math.random() * 0.2;

    return Math.floor(baseXp * (levelScaling + diffBonus) * variance);
}

/**
 * Process XP gain and level up logic.
 */
export function gainXp(character: Character, xpGained: number): {
    updatedCharacter: Character;
    leveledUp: boolean;
    levelsGained: number;
    newLevel: number;
} {
    let { level, experience } = character;
    const startingLevel = level;

    experience += xpGained;

    // Check for level ups
    while (level < MAX_LEVEL) {
        const xpNeeded = getTotalXpForLevel(level + 1);
        if (experience >= xpNeeded) {
            level++;
        } else {
            break;
        }
    }

    const levelsGained = level - startingLevel;

    // Apply base HP growth on level-up (+8 HP per level gained)
    const hpBonus = levelsGained > 0 ? levelsGained * HP_PER_LEVEL : 0;

    const updatedCharacter: Character = {
        ...character,
        level,
        experience,
        maxHp: (character.maxHp || 0) + hpBonus,
        hp: (character.hp || 0) + hpBonus,
    };

    return {
        updatedCharacter,
        leveledUp: levelsGained > 0,
        levelsGained,
        newLevel: level,
    };
}

/**
 * Get a formatted string showing XP progress.
 */
export function formatXpDisplay(character: Character): string {
    const progress = getXpProgress(character);

    if (progress.isMaxLevel) {
        return 'MAX LEVEL';
    }

    return `${progress.currentXpInLevel} / ${progress.xpForNextLevel} XP`;
}

/**
 * Get the max level constant.
 */
export function getMaxLevel(): number {
    return MAX_LEVEL;
}
