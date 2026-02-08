import { GAME_RULES } from '../config/gameRules';
import { Character } from '../types/Character';
import { getHpForVitality, STAT_KEYS, StatKey } from './statUtils';

/**
 * Generates a logical, coherent, single-word name without numbers or special characters.
 */
export const generateCharacterName = (): string => {
    // Shorter adjectives and nouns to stay under 10 chars total
    const ADJECTIVES = [
        // Core
        'Ash', 'Black', 'Blue', 'Bold', 'Brave', 'Bronze', 'Calm', 'Cold', 'Crag', 'Crim',
        'Dark', 'Dawn', 'Dread', 'Drift', 'Dusk', 'Ember', 'Feral', 'Fierce', 'Fire', 'Frost',
        'Gale', 'Ghost', 'Gloom', 'Gold', 'Grim', 'Hawk', 'Iron', 'Ivory', 'Jade', 'Keen',
        'Lone', 'Mighty', 'Mist', 'Night', 'Noble', 'Pale', 'Prime', 'Pure', 'Rogue', 'Sable',
        'Scar', 'Shadow', 'Silent', 'Silver', 'Slate', 'Smoky', 'Snow', 'Solar', 'Steel',
        'Stone', 'Storm', 'Swift', 'Tide', 'True', 'Umber', 'Vast', 'Wild', 'Wind', 'Wolven', 'Zen',

        // Nature / Terrain
        'Briar', 'Cedar', 'Cliff', 'Dune', 'Dust', 'Flint', 'Forest', 'Grove', 'Jungle', 'Moss',
        'Oasis', 'Pine', 'Reef', 'Ridge', 'River', 'Sage', 'Sand', 'Silt', 'Sky', 'Thorn',
        'Vale', 'Vine', 'Wave', 'Wilds',

        // Elemental / Cosmic
        'Arc', 'Blaze', 'Bolt', 'Cinder', 'Comet', 'Flare', 'Flux', 'Fume', 'Glint', 'Glow',
        'Glace', 'Lunar', 'Meteor', 'Nova', 'Orb', 'Pyre', 'Quake', 'Shard', 'Solar', 'Spark',
        'Star', 'Storm', 'Void',

        // Arcane / Mythic
        'Crypt', 'Hex', 'Myth', 'Noir', 'Rune', 'Ward', 'Wyrd',

        // Tech / Cyber
        'Brass', 'Chrome', 'Cyber', 'Gear', 'Glitch', 'Ion', 'Mech', 'Nano', 'Neon', 'Pulse',
        'Steam', 'Synth', 'Volt'
    ];

    const NOUNS = [
        // Warrior / Roles
        'Aegis', 'Archer', 'Blade', 'Brawler', 'Chaser', 'Corsair', 'Dancer', 'Drifter', 'Guard',
        'Hunter', 'Knight', 'Lancer', 'Monk', 'Oracle', 'Pilot', 'Pirate', 'Ranger', 'Reaper',
        'Rider', 'Rogue', 'Sage', 'Scout', 'Seer', 'Striker', 'Warden',

        // Beasts
        'Bear', 'Boar', 'Crow', 'Drake', 'Eagle', 'Fox', 'Hawk', 'Hound', 'Lion', 'Lynx',
        'Raven', 'Shark', 'Stag', 'Tiger', 'Viper', 'Wolf', 'Wyrm', 'Wyvern',

        // Weapons / Gear
        'Anchor', 'Arrow', 'Claw', 'Dagger', 'Edge', 'Fang', 'Glaive', 'Hammer', 'Shield',
        'Spear', 'Sword', 'Talon',

        // Shadow / Spirit
        'Bane', 'Cipher', 'Ghost', 'Phantom', 'Shade', 'Shadow', 'Skull', 'Specter', 'Wraith',

        // Mystic / Cosmic
        'Flame', 'Flint', 'Nova', 'Rune', 'Sigil', 'Storm', 'Titan',

        // Tech / Cyber
        'Byte', 'Code', 'Core', 'Drone', 'Node'
    ];

    const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

    const buildName = () => {
        const roll = Math.random();
        if (roll < 0.72) {
            return `${pick(ADJECTIVES)}${pick(NOUNS)}`;
        }
        const first = pick(NOUNS);
        let second = pick(NOUNS);
        if (second === first) second = pick(NOUNS);
        return `${first}${second}`;
    };

    let name = buildName();

    // If too long, try again (max 20 tries)
    let attempts = 0;
    while (name.length > 10 && attempts < 20) {
        name = buildName();
        attempts++;
    }

    return name.substring(0, 10);
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

    const statKeys = STAT_KEYS as StatKey[];

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
