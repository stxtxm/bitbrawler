import { GAME_RULES } from '../config/gameRules';
import { Character } from '../types/Character';
import { getHpForVitality, STAT_KEYS, StatKey } from './statUtils';

const MAX_NAME_LENGTH = 10;
const MIN_SUFFIX_LENGTH = 2;
const MAX_SUFFIX_LENGTH = 3;
const NAME_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const usedGeneratedNames = new Set<string>();

type NameGeneratorOptions = {
    rng?: () => number;
    now?: () => number;
    registry?: Set<string>;
};

/**
 * Generates a logical, coherent, single-word name without numbers or special characters.
 * Adds a short letter-based suffix to keep generated names unique across a session.
 */
export const generateCharacterName = (options: NameGeneratorOptions = {}): string => {
    const rng = options.rng ?? Math.random;
    const now = options.now ?? Date.now;
    const registry = options.registry ?? usedGeneratedNames;

    // Shorter adjectives and nouns to stay under 10 chars total
    const ADJECTIVES = [
        // Core
        'Ash', 'Ashen', 'Black', 'Blue', 'Bold', 'Brave', 'Bronze', 'Calm', 'Cold', 'Crag',
        'Crim', 'Dark', 'Dawn', 'Dread', 'Drift', 'Dusk', 'Ebon', 'Elder', 'Ember', 'Feral',
        'Fierce', 'Fire', 'Frost', 'Gale', 'Ghost', 'Gloom', 'Gold', 'Grim', 'Grit', 'Hawk',
        'Iron', 'Ivory', 'Jade', 'Jolt', 'Keen', 'Lone', 'Mighty', 'Mist', 'Night', 'Noble',
        'Nyx', 'Omen', 'Onyx', 'Pale', 'Prime', 'Pure', 'Rogue', 'Sable', 'Scar', 'Shadow',
        'Silent', 'Silver', 'Slate', 'Smoky', 'Snow', 'Solar', 'Steel', 'Stone', 'Storm',
        'Swift', 'Tide', 'True', 'Umber', 'Vast', 'Vivid', 'Wild', 'Wind', 'Wisp', 'Wolven',
        'Zeal', 'Zen',

        // Nature / Terrain
        'Briar', 'Cedar', 'Cliff', 'Coral', 'Dune', 'Dust', 'Flint', 'Forest', 'Grove', 'Jungle',
        'Moss', 'Oasis', 'Pine', 'Reef', 'Ridge', 'River', 'Sage', 'Sand', 'Silt', 'Sky',
        'Thorn', 'Vale', 'Vine', 'Wave', 'Wilds',

        // Elemental / Cosmic
        'Arc', 'Apex', 'Aether', 'Blaze', 'Bolt', 'Cinder', 'Comet', 'Flare', 'Flux', 'Fume',
        'Glint', 'Glow', 'Glace', 'Halo', 'Lunar', 'Meteor', 'Nova', 'Orb', 'Pyre', 'Quake',
        'Rift', 'Rime', 'Shard', 'Spark', 'Star', 'Void',

        // Arcane / Mythic
        'Crypt', 'Hex', 'Myth', 'Noir', 'Rune', 'Ward', 'Wyrd',

        // Tech / Cyber
        'Brass', 'Chrome', 'Cyber', 'Gear', 'Glitch', 'Ion', 'Mech', 'Nano', 'Neon', 'Pulse',
        'Steam', 'Synth', 'Volt'
    ];

    const NOUNS = [
        // Warrior / Roles
        'Adept', 'Aegis', 'Agent', 'Archer', 'Bard', 'Blade', 'Brawler', 'Chaser', 'Cleric',
        'Corsair', 'Dancer', 'Drifter', 'Druid', 'Fencer', 'Guard', 'Hunter', 'Knight', 'Lancer',
        'Mage', 'Monk', 'Oracle', 'Pilot', 'Pirate', 'Ranger', 'Reaper', 'Rider', 'Rogue',
        'Sage', 'Scout', 'Seer', 'Striker', 'Squire', 'Tamer', 'Warden',

        // Beasts
        'Bear', 'Boar', 'Crow', 'Drake', 'Eagle', 'Fox', 'Hawk', 'Hound', 'Lion', 'Lynx',
        'Raven', 'Shark', 'Stag', 'Tiger', 'Viper', 'Wolf', 'Wyrm', 'Wyvern',

        // Weapons / Gear
        'Anchor', 'Arrow', 'Axe', 'Claw', 'Dagger', 'Edge', 'Fang', 'Glaive', 'Hammer', 'Hilt',
        'Mace', 'Saber', 'Shield', 'Spear', 'Sword', 'Talon',

        // Shadow / Spirit
        'Bane', 'Cipher', 'Ghost', 'Phantom', 'Shade', 'Shadow', 'Skull', 'Specter', 'Wraith',

        // Mystic / Cosmic
        'Flame', 'Flint', 'Golem', 'Hydra', 'Nova', 'Rune', 'Sigil', 'Storm', 'Titan',

        // Tech / Cyber
        'Byte', 'Code', 'Core', 'Drone', 'Node'
    ];

    const pick = <T,>(list: T[]) => list[Math.floor(rng() * list.length)];

    const buildNameBase = (maxLen: number) => {
        let candidate = '';
        let attempts = 0;
        while (attempts < 40) {
            const roll = rng();
            if (roll < 0.72) {
                candidate = `${pick(ADJECTIVES)}${pick(NOUNS)}`;
            } else if (roll < 0.9) {
                const first = pick(NOUNS);
                let second = pick(NOUNS);
                if (second === first) second = pick(NOUNS);
                candidate = `${first}${second}`;
            } else {
                const first = pick(ADJECTIVES);
                let second = pick(ADJECTIVES);
                if (second === first) second = pick(ADJECTIVES);
                candidate = `${first}${second}`;
            }

            if (candidate.length <= maxLen) {
                return candidate;
            }
            attempts++;
        }

        return candidate.substring(0, maxLen);
    };

    const buildSuffix = (seed: number, length: number) => {
        let value = Math.abs(seed);
        let suffix = '';
        for (let i = 0; i < length; i++) {
            suffix = NAME_LETTERS[value % NAME_LETTERS.length] + suffix;
            value = Math.floor(value / NAME_LETTERS.length);
        }
        return suffix;
    };

    const maxBaseLen = MAX_NAME_LENGTH - MIN_SUFFIX_LENGTH;
    let attempts = 0;
    while (attempts < 80) {
        const base = buildNameBase(maxBaseLen);
        const remaining = MAX_NAME_LENGTH - base.length;
        const suffixLength = Math.min(MAX_SUFFIX_LENGTH, Math.max(MIN_SUFFIX_LENGTH, remaining));
        const seed = now() + registry.size * 131 + attempts * 17;
        const suffix = buildSuffix(seed, suffixLength);
        const name = `${base}${suffix}`.substring(0, MAX_NAME_LENGTH);
        if (!registry.has(name)) {
            registry.add(name);
            return name;
        }
        attempts++;
    }

    const fallback = buildNameBase(MAX_NAME_LENGTH).substring(0, MAX_NAME_LENGTH);
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
