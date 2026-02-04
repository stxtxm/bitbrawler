import { Character } from '../types/Character';

/**
 * XP Progression System
 * 
 * Based on classic RPG formulas (Final Fantasy, D&D style).
 * Uses an exponential curve that starts gentle and becomes steeper at higher levels.
 * 
 * Formula: XP_required = BASE_XP * (level ^ EXPONENT)
 * 
 * With BASE_XP = 100 and EXPONENT = 1.8:
 * - Level 1→2: 100 XP
 * - Level 2→3: 348 XP
 * - Level 5→6: 1,738 XP
 * - Level 10→11: 6,310 XP
 * - Level 20→21: 21,930 XP
 * - Level 50→51: 114,458 XP
 * - Level 99→100: 389,045 XP
 */

// Configuration constants
const BASE_XP = 100;           // XP needed for level 1→2
const EXPONENT = 1.8;          // Growth rate (1.5 = slow, 2.0 = fast, 1.8 = balanced)
const MAX_LEVEL = 99;          // Maximum achievable level

// XP rewards per fight (can be adjusted for balance)
const BASE_XP_PER_FIGHT = 25;  // Base XP gained per fight
const XP_VARIANCE = 10;        // Random variance (+/- this amount)

/**
 * Calculate the total XP required to reach a specific level from level 1.
 * This is the cumulative XP, not the XP for just that level.
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
 * Calculate the XP required to go from a specific level to the next level.
 */
export function getXpRequiredForNextLevel(level: number): number {
    if (level >= MAX_LEVEL) return Infinity;
    return Math.floor(BASE_XP * Math.pow(level, EXPONENT));
}

/**
 * Calculate the current XP progress within the current level.
 * Returns an object with current XP in level, XP needed for next level, and percentage.
 */
export function getXpProgress(character: Character): {
    currentXpInLevel: number;
    xpForNextLevel: number;
    percentage: number;
    isMaxLevel: boolean;
} {
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
 * Calculate XP gained from a fight.
 * Can be modified to factor in opponent level, win/loss, etc.
 */
export function calculateFightXp(playerLevel: number, won: boolean): number {
    // Base XP with some randomness
    let xp = BASE_XP_PER_FIGHT + Math.floor(Math.random() * XP_VARIANCE * 2) - XP_VARIANCE;

    // Bonus for winning
    if (won) {
        xp = Math.floor(xp * 1.5);
    }

    // Small level scaling (higher levels give slightly more XP to maintain progression feel)
    xp = Math.floor(xp * (1 + (playerLevel - 1) * 0.02));

    return Math.max(1, xp);
}

/**
 * Process XP gain and handle level ups.
 * Returns the updated character and level up information.
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

    // Check for level ups (can level up multiple times if enough XP)
    while (level < MAX_LEVEL) {
        const xpNeeded = getTotalXpForLevel(level + 1);
        if (experience >= xpNeeded) {
            level++;
        } else {
            break;
        }
    }

    const levelsGained = level - startingLevel;

    // Create updated character
    const updatedCharacter: Character = {
        ...character,
        level,
        experience,
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

/**
 * Debug function to display the XP curve for all levels.
 */
export function debugXpCurve(): void {
    console.log('=== XP PROGRESSION CURVE ===');
    console.log(`Base XP: ${BASE_XP}, Exponent: ${EXPONENT}`);
    console.log('---');

    let cumulative = 0;
    for (let level = 1; level <= 20; level++) {
        const xpForLevel = getXpRequiredForNextLevel(level);
        cumulative += xpForLevel;
        console.log(`Level ${level}→${level + 1}: ${xpForLevel.toLocaleString()} XP (Total: ${cumulative.toLocaleString()})`);
    }

    console.log('...');

    for (const level of [50, 75, 99]) {
        const xpForLevel = getXpRequiredForNextLevel(level);
        const total = getTotalXpForLevel(level + 1);
        console.log(`Level ${level}→${level + 1}: ${xpForLevel.toLocaleString()} XP (Total: ${total.toLocaleString()})`);
    }
}
