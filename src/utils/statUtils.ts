import { Character } from '../types/Character';

export const STAT_KEYS = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus'] as const;
export type StatKey = typeof STAT_KEYS[number];

export const STAT_TOOLTIPS: Record<StatKey, string> = {
    strength: 'Boosts physical damage dealt in combat. Each point increases your offense power for harder-hitting attacks.',
    vitality: `Increases max HP (+8 HP per point) and improves physical defense, making you tougher to take down.`,
    dexterity: 'Improves turn order initiative and hit chance for more consistent and faster attacks.',
    luck: 'Increases critical hit chance and improves loot quality from battles and lootboxes.',
    intelligence: 'Boosts magic power for stronger magical attacks and special abilities.',
    focus: 'Reduces damage variance for stable performance and increases surge chance for bonus damage.',
};

const BASE_HP = 100;
const HP_PER_VITALITY = 8;
export const HP_PER_LEVEL = 12;

export function getHpForVitality(vitality: number, level: number = 1): number {
    return BASE_HP + (vitality * HP_PER_VITALITY) + ((level - 1) * HP_PER_LEVEL);
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

    const currentVal = character[stat] as number;

    const updated: Character = {
        ...character,
        [stat]: currentVal + 1,
        statPoints: available - 1
    };

    if (stat === 'vitality') {
        const newMaxHp = getHpForVitality(updated.vitality, updated.level);
        const delta = newMaxHp - updated.maxHp;
        updated.maxHp = newMaxHp;
        updated.hp = Math.min(updated.hp + delta, newMaxHp);
    }

    return updated;
}

export function autoAllocateStatPoints(character: Character, points: number): Character {
    let updated = character;
    const available = character.statPoints || 0;
    if (points > available) {
        updated = grantStatPoints(character, points - available);
    }

    for (let i = 0; i < points; i++) {
        const stat = pickLowestStat(updated);
        updated = applyStatPoint(updated, stat);
    }

    return updated;
}

export function autoAllocateStatPointsRandom(
    character: Character,
    points: number,
    rng: () => number = Math.random
): Character {
    let updated = character;
    const available = character.statPoints || 0;
    if (points > available) {
        updated = grantStatPoints(character, points - available);
    }

    for (let i = 0; i < points; i++) {
        const stat = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
        updated = applyStatPoint(updated, stat);
    }

    return updated;
}

const COMBAT_WEIGHTS: Record<StatKey, number> = {
    strength: 1.3,
    vitality: 1.2,
    dexterity: 1.1,
    luck: 1.0,
    intelligence: 1.0,
    focus: 1.0,
};

function pickLowestStat(character: Character): StatKey {
    // Weighted selection: lower stat values get higher priority,
    // multiplied by combat-weight bias. This creates more distinctive,
    // combat-effective builds while maintaining archetype variety.
    const priorities = STAT_KEYS.map((key) => {
        const basePriority = 1 / (character[key] + 1);
        return { key, priority: basePriority * COMBAT_WEIGHTS[key] };
    });

    const totalPriority = priorities.reduce((sum, p) => sum + p.priority, 0);
    let roll = Math.random() * totalPriority;

    for (const { key, priority } of priorities) {
        roll -= priority;
        if (roll <= 0) return key;
    }

    return 'strength';
}
