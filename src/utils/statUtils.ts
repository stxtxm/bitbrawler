import { Character } from '../types/Character';

export const STAT_KEYS = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence'] as const;
export type StatKey = typeof STAT_KEYS[number];

const BASE_HP = 100;
const HP_PER_VITALITY = 8;

export function getHpForVitality(vitality: number): number {
    return BASE_HP + (vitality * HP_PER_VITALITY);
}

export function grantStatPoints(character: Character, points: number): Character {
    if (points <= 0) return character;
    const current = character.statPoints || 0;
    return {
        ...character,
        statPoints: current + points
    };
}

export function applyStatPoint(character: Character, stat: StatKey): Character {
    const available = character.statPoints || 0;
    if (available <= 0) return character;

    const updated: Character = {
        ...character,
        [stat]: character[stat] + 1,
        statPoints: available - 1
    };

    if (stat === 'vitality') {
        const newMaxHp = getHpForVitality(updated.vitality);
        const delta = newMaxHp - updated.maxHp;
        updated.maxHp = newMaxHp;
        updated.hp = Math.min(updated.hp + delta, newMaxHp);
    }

    return updated;
}

export function autoAllocateStatPoints(character: Character, points: number): Character {
    let updated = grantStatPoints(character, points);

    for (let i = 0; i < points; i++) {
        const stat = pickLowestStat(updated);
        updated = applyStatPoint(updated, stat);
    }

    return updated;
}

function pickLowestStat(character: Character): StatKey {
    const stats = STAT_KEYS.map((key) => ({ key, value: character[key] }));
    const minValue = Math.min(...stats.map((stat) => stat.value));
    const lowest = stats.filter((stat) => stat.value === minValue);
    const choice = lowest[Math.floor(Math.random() * lowest.length)];
    return choice.key;
}
