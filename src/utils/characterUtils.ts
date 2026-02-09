import { GAME_RULES } from '../config/gameRules';
import { Character } from '../types/Character';
import { getHpForVitality, STAT_KEYS, StatKey } from './statUtils';

const MAX_NAME_LENGTH = 10;
const MIN_SUFFIX_LENGTH = 2;
const MAX_SUFFIX_LENGTH = 3;
const VOWELS = 'AEIOUY';
const CONSONANTS = 'BCDFGHJKLMNPRSTVWXZ';
const usedGeneratedNames = new Set<string>();

type NameGeneratorOptions = {
    rng?: () => number;
    now?: () => number;
    registry?: Set<string>;
};

const NEUTRAL_ADJECTIVES = [
    'Bold', 'Brave', 'Calm', 'Fierce', 'Grim', 'Keen', 'Lone', 'Mighty', 'Noble', 'Silent',
    'Swift', 'True', 'Vast', 'Wild', 'Prime', 'Steel', 'Stone', 'Iron', 'Silver', 'Gold'
];

const NEUTRAL_NOUNS = [
    'Adept', 'Agent', 'Archer', 'Bard', 'Blade', 'Brawler', 'Chaser', 'Cleric', 'Drifter',
    'Fencer', 'Guard', 'Hunter', 'Knight', 'Lancer', 'Mage', 'Monk', 'Oracle', 'Pilot',
    'Ranger', 'Rider', 'Rogue', 'Sage', 'Scout', 'Seer', 'Squire', 'Striker', 'Tamer', 'Warden'
];

const THEME_POOLS = [
    {
        name: 'nature',
        adjectives: [
            'Ash', 'Ashen', 'Briar', 'Cedar', 'Cliff', 'Coral', 'Dune', 'Dust', 'Flint', 'Forest',
            'Grove', 'Moss', 'Oasis', 'Pine', 'Reef', 'Ridge', 'River', 'Sage', 'Sand', 'Silt',
            'Sky', 'Thorn', 'Vale', 'Vine', 'Wave', 'Wilds'
        ],
        nouns: [
            'Bear', 'Boar', 'Crow', 'Drake', 'Eagle', 'Fox', 'Hawk', 'Hound', 'Lion', 'Lynx',
            'Raven', 'Shark', 'Stag', 'Tiger', 'Viper', 'Wolf', 'Wyrm', 'Reef', 'Ridge', 'Grove',
            'Vale', 'River', 'Dune'
        ]
    },
    {
        name: 'elemental',
        adjectives: [
            'Arc', 'Apex', 'Aether', 'Blaze', 'Bolt', 'Cinder', 'Comet', 'Ember', 'Flare', 'Flux',
            'Frost', 'Gale', 'Glint', 'Glow', 'Glace', 'Halo', 'Lunar', 'Meteor', 'Nova', 'Orb',
            'Pyre', 'Quake', 'Rift', 'Rime', 'Shard', 'Spark', 'Solar', 'Star', 'Storm', 'Tide',
            'Void'
        ],
        nouns: [
            'Flame', 'Flint', 'Golem', 'Hydra', 'Nova', 'Orb', 'Rune', 'Shard', 'Sigil', 'Spark',
            'Storm', 'Titan', 'Wyrm', 'Wyvern'
        ]
    },
    {
        name: 'shadow',
        adjectives: [
            'Dark', 'Dread', 'Ebon', 'Gloom', 'Hex', 'Myth', 'Noir', 'Nyx', 'Omen', 'Rune',
            'Sable', 'Shade', 'Umber', 'Wyrd', 'Crypt'
        ],
        nouns: [
            'Bane', 'Cipher', 'Ghost', 'Phantom', 'Shade', 'Shadow', 'Skull', 'Specter', 'Wraith',
            'Rune', 'Sigil'
        ]
    },
    {
        name: 'tech',
        adjectives: [
            'Brass', 'Chrome', 'Cyber', 'Gear', 'Glitch', 'Ion', 'Mech', 'Nano', 'Neon',
            'Pulse', 'Steam', 'Synth', 'Volt'
        ],
        nouns: [
            'Byte', 'Code', 'Core', 'Drone', 'Node', 'Vector'
        ]
    },
    {
        name: 'mythic',
        adjectives: [
            'Elder', 'Ivory', 'Jade', 'Myth', 'Onyx', 'Prime', 'Sable', 'Umber', 'Vivid', 'Zeal',
            'Zen'
        ],
        nouns: [
            'Aegis', 'Golem', 'Hydra', 'Oracle', 'Titan', 'Ward', 'Wyrm', 'Wyvern'
        ]
    }
] as const;

/**
 * Generates a logical, coherent, single-word name without numbers or special characters.
 * Keeps a wide variety by combining themed words and only adds a short suffix when needed
 * to avoid collisions within a session.
 */
export const generateCharacterName = (options: NameGeneratorOptions = {}): string => {
    const rng = options.rng ?? Math.random;
    const now = options.now ?? Date.now;
    const registry = options.registry ?? usedGeneratedNames;

    const pick = <T,>(list: T[]) => list[Math.floor(rng() * list.length)];

    const pickWithMax = (list: string[], maxLen: number) => {
        const candidates = list.filter((word) => word.length <= maxLen);
        if (candidates.length) {
            return pick(candidates);
        }
        const shortest = list.reduce((best, word) => (word.length < best.length ? word : best), list[0]);
        return shortest.substring(0, maxLen);
    };

    const minLength = (list: string[]) =>
        list.reduce((min, word) => (word.length < min ? word.length : min), Infinity);

    const pickPair = (listA: string[], listB: string[], maxLen: number) => {
        const minB = minLength(listB);
        const candidatesA = listA.filter((word) => word.length <= maxLen - minB);
        const first = pick(candidatesA.length ? candidatesA : listA);
        const remaining = maxLen - first.length;
        const candidatesB = listB.filter((word) => word.length <= remaining && word !== first);
        if (candidatesB.length) {
            return `${first}${pick(candidatesB)}`;
        }

        for (let i = 0; i < 40; i++) {
            const altFirst = pick(listA);
            const altSecond = pick(listB);
            if (altFirst === altSecond) continue;
            if (altFirst.length + altSecond.length <= maxLen) {
                return `${altFirst}${altSecond}`;
            }
        }

        let best = '';
        let bestLen = 0;
        for (const altFirst of listA) {
            for (const altSecond of listB) {
                if (altFirst === altSecond) continue;
                const len = altFirst.length + altSecond.length;
                if (len <= maxLen && len > bestLen) {
                    best = `${altFirst}${altSecond}`;
                    bestLen = len;
                }
            }
        }

        if (best) return best;
        return pickWithMax([...listA, ...listB], maxLen);
    };

    const buildNameBase = (maxLen: number) => {
        const theme = pick(THEME_POOLS);
        const adjectives = [...theme.adjectives, ...NEUTRAL_ADJECTIVES];
        const nouns = [...theme.nouns, ...NEUTRAL_NOUNS];

        const roll = rng();
        if (roll < 0.7) return pickPair(adjectives, nouns, maxLen);
        if (roll < 0.88) return pickPair(nouns, nouns, maxLen);
        if (roll < 0.95) return pickPair(adjectives, adjectives, maxLen);
        return pickWithMax(rng() < 0.5 ? nouns : adjectives, maxLen);
    };

    const isVowel = (char: string) => VOWELS.includes(char.toUpperCase());

    const buildSuffix = (seed: number, length: number, base: string) => {
        let value = Math.abs(seed);
        let suffix = '';
        const last = base[base.length - 1];
        let useVowel = last ? !isVowel(last) : false;
        for (let i = 0; i < length; i++) {
            const alphabet = useVowel ? VOWELS : CONSONANTS;
            suffix += alphabet[value % alphabet.length];
            value = Math.floor(value / alphabet.length);
            useVowel = !useVowel;
        }
        return suffix;
    };

    const base = buildNameBase(MAX_NAME_LENGTH);
    if (!registry.has(base)) {
        registry.add(base);
        return base;
    }

    let attempts = 0;
    while (attempts < 80) {
        const baseMax = MAX_NAME_LENGTH - MIN_SUFFIX_LENGTH;
        const trimmedBase = base.length > baseMax ? base.substring(0, baseMax) : base;
        const remaining = MAX_NAME_LENGTH - trimmedBase.length;
        const suffixLength = Math.min(MAX_SUFFIX_LENGTH, Math.max(MIN_SUFFIX_LENGTH, remaining));
        const seed = now() + registry.size * 131 + attempts * 17;
        const suffix = buildSuffix(seed, suffixLength, trimmedBase);
        const name = `${trimmedBase}${suffix}`;
        if (!registry.has(name)) {
            registry.add(name);
            return name;
        }
        attempts++;
    }

    const fallback = buildNameBase(MAX_NAME_LENGTH);
    registry.add(fallback);
    return fallback;
};

/**
 * Generates initial stats for a new character using GAME_RULES
 * - Ensures balanced total stats
 * - Randomizes distribution within min/max bounds
 * - Total points remain constant across all characters
 */
export const generateInitialStats = (name: string, gender: 'male' | 'female'): Character => {
    const { BASE_VALUE, MIN_VALUE, MAX_VALUE } = GAME_RULES.STATS;
    const NUM_STATS = STAT_KEYS.length;

    // Initialize stats
    const stats: Record<StatKey, number> = {
        strength: BASE_VALUE,
        vitality: BASE_VALUE,
        dexterity: BASE_VALUE,
        luck: BASE_VALUE,
        intelligence: BASE_VALUE,
        focus: BASE_VALUE
    };

    const statKeys = STAT_KEYS;

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
    const hp = getHpForVitality(stats.vitality);
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
        focus: stats.focus,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
        lastFightReset: Date.now(),
        statPoints: 0,
        inventory: [],
        equipped: {},
        lastLootRoll: 0
    };
};
