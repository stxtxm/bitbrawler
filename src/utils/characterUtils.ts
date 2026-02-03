import { Character } from '../types/Character';

export const generateInitialStats = (name: string, gender: 'male' | 'female'): Character => {
    // RPG Stats - Balanced SYSTEM (Base 6 + 16 random points = 40 total)
    let totalPool = 16;
    let strength = 6;
    let vitality = 6;
    let dexterity = 6;
    let luck = 6;
    let intelligence = 6;

    const stats = ['str', 'vit', 'dex', 'luk', 'int'];
    while (totalPool > 0) {
        const target = stats[Math.floor(Math.random() * stats.length)];
        if (target === 'str') strength++;
        else if (target === 'vit') vitality++;
        else if (target === 'dex') dexterity++;
        else if (target === 'luk') luck++;
        else if (target === 'int') intelligence++;
        totalPool--;
    }

    const hp = 100 + (vitality * 5);
    const characterSeed = Math.random().toString(36).substring(2, 10);

    return {
        name: name || 'HERO',
        gender,
        seed: characterSeed,
        level: 1,
        hp: hp,
        maxHp: hp,
        strength,
        vitality,
        dexterity,
        luck,
        intelligence,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: 5,
        lastFightReset: Date.now()
    };
};
