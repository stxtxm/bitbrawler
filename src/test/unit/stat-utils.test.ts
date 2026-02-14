import { describe, it, expect } from 'vitest';
import { applyStatPoint, autoAllocateStatPoints, autoAllocateStatPointsRandom, getHpForVitality, grantStatPoints } from '../../utils/statUtils';
import { Character } from '../../types/Character';

describe('Stat Utils', () => {
    const baseCharacter: Character = {
        name: 'Test',
        gender: 'male',
        seed: 'seed',
        level: 5,
        experience: 0,
        strength: 10,
        vitality: 10,
        dexterity: 10,
        luck: 10,
        intelligence: 10,
        focus: 10,
        hp: getHpForVitality(10),
        maxHp: getHpForVitality(10),
        wins: 0,
        losses: 0,
        fightsLeft: 5,
        lastFightReset: 0,
        statPoints: 0
    };

    it('grants stat points correctly', () => {
        const updated = grantStatPoints(baseCharacter, 2);
        expect(updated.statPoints).toBe(2);
    });

    it('applies stat points and updates vitality HP', () => {
        const withPoints = grantStatPoints(baseCharacter, 1);
        const updated = applyStatPoint(withPoints, 'vitality');
        expect(updated.vitality).toBe(baseCharacter.vitality + 1);
        expect(updated.statPoints).toBe(0);
        expect(updated.maxHp).toBe(getHpForVitality(11));
        expect(updated.hp).toBe(getHpForVitality(11));
    });

    it('does nothing when no stat points are available', () => {
        const updated = applyStatPoint(baseCharacter, 'strength');
        expect(updated.strength).toBe(baseCharacter.strength);
        expect(updated.statPoints).toBe(0);
    });

    it('auto-allocates all stat points to lowest stats', () => {
        const uneven: Character = { ...baseCharacter, strength: 8, statPoints: 0 };
        const updated = autoAllocateStatPoints(uneven, 2);
        const totalIncrease =
            (updated.strength - uneven.strength) +
            (updated.vitality - uneven.vitality) +
            (updated.dexterity - uneven.dexterity) +
            (updated.luck - uneven.luck) +
            (updated.intelligence - uneven.intelligence) +
            (updated.focus - uneven.focus);

        expect(totalIncrease).toBe(2);
        expect(updated.statPoints).toBe(0);
    });

    it('auto-allocates stat points randomly', () => {
        const rng = () => 0; // always pick strength
        const updated = autoAllocateStatPointsRandom(baseCharacter, 2, rng);

        expect(updated.strength).toBe(baseCharacter.strength + 2);
        expect(updated.vitality).toBe(baseCharacter.vitality);
        expect(updated.statPoints).toBe(0);
    });
});
