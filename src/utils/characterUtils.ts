import { GAME_RULES } from '../config/gameRules';
import { Character } from '../types/Character';

/**
 * Generates a logical, coherent, single-word name without numbers or special characters.
 */
export const generateCharacterName = (): string => {
    const ADJECTIVES = [
        'Dark', 'Iron', 'Grim', 'Swift', 'Bold', 'Cold', 'Fire', 'Storm', 'Shadow', 'Moon',
        'Sun', 'Wild', 'Deep', 'Light', 'Vile', 'Pure', 'Frost', 'Thunder', 'Blood', 'Spirit',
        'Zen', 'Mega', 'Giga', 'Ultra', 'Hyper', 'Cyber', 'Nano', 'Pixel', 'Retro', 'Turbo',
        'Void', 'Star', 'Zenith', 'Aero', 'Pyro', 'Cryo', 'Electro', 'Jade', 'Gold', 'Silver'
    ];

    const NOUNS = [
        'Knight', 'Blade', 'Wolf', 'Fang', 'Heart', 'Soul', 'Storm', 'Shadow', 'Sage', 'Mage',
        'Brawler', 'Fighter', 'Striker', 'Guard', 'Keeper', 'Seeker', 'Walker', 'Runner', 'Dancer', 'Reaper',
        'Slayer', 'Hunter', 'Master', 'Lord', 'King', 'Queen', 'Dragon', 'Hawk', 'Eagle', 'Falcon',
        'Titan', 'Giant', 'Golem', 'Wraith', 'Ghost', 'Specter', 'Phantom', 'Orb', 'Core', 'Link',
        'Code', 'Byte', 'Bit', 'Grid', 'Dojo', 'Sensei', 'Ronin', 'Samurai', 'Ninja', 'Monk'
    ];

    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];

    return `${adj}${noun}`;
};

/**
 * Generates initial stats for a new character using GAME_RULES
 * - Ensures balanced total stats
 * - Randomizes distribution within min/max bounds
 * - Total points remain constant across all characters
 */
export const generateInitialStats = (name: string, gender: 'male' | 'female'): Character => {
    const { BASE_VALUE, MIN_VALUE, MAX_VALUE } = GAME_RULES.STATS;
    const NUM_STATS = 5;

    // Initialize stats
    const stats: Record<string, number> = {
        strength: BASE_VALUE,
        vitality: BASE_VALUE,
        dexterity: BASE_VALUE,
        luck: BASE_VALUE,
        intelligence: BASE_VALUE
    };

    const statKeys = Object.keys(stats);

    // Shuffle stats by exchanging points
    // We do multiple passes of +1/-1 swaps to ensure random distribution
    // This guarantees the sum remains constant (50)
    for (let i = 0; i < 20; i++) {
        const donorIndex = Math.floor(Math.random() * NUM_STATS);
        const receiverIndex = Math.floor(Math.random() * NUM_STATS);

        if (donorIndex === receiverIndex) continue;

        const donorKey = statKeys[donorIndex];
        const receiverKey = statKeys[receiverIndex];

        // Ensure we stay within reasonably balanced bounds
        if (stats[donorKey] > MIN_VALUE && stats[receiverKey] < MAX_VALUE) {
            stats[donorKey]--;
            stats[receiverKey]++;
        }
    }

    // Calculate HP based on vitality (more consistent)
    const hp = 100 + (stats.vitality * 8);
    // Create consistent seed for visuals
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
        fightsLeft: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
        lastFightReset: Date.now()
    };
};
