import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Character } from '../../types/Character';
import { normalizeCharacter } from '../../utils/persistenceUtils';

describe('LocalStorage Persistence', () => {
    const mockChar: Character = {
        name: 'Persistent Hero',
        gender: 'male',
        seed: 'abc',
        level: 1,
        hp: 100,
        maxHp: 100,
        strength: 10,
        vitality: 10,
        dexterity: 10,
        luck: 10,
        intelligence: 10,
        focus: 10,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: 5,
        lastFightReset: 123456789
    };

    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('should save and load character from localStorage', () => {
        localStorage.setItem('bitbrawler_active_char', JSON.stringify(mockChar));

        const saved = localStorage.getItem('bitbrawler_active_char');
        expect(saved).toBeDefined();

        const parsed = JSON.parse(saved!);
        expect(parsed.name).toBe('Persistent Hero');
        expect(parsed.strength).toBe(10);
    });

    it('should handle corrupted storage gracefully', () => {
        localStorage.setItem('bitbrawler_active_char', 'invalid-json');

        const getData = () => {
            try {
                return JSON.parse(localStorage.getItem('bitbrawler_active_char')!);
            } catch {
                return null;
            }
        };

        expect(getData()).toBeNull();
    });
});

describe('normalizeCharacter', () => {
    it('defaults equippedItems to empty slots when missing', () => {
        const result = normalizeCharacter({} as Character);
        expect(result.equippedItems).toEqual({ weapon: null, armor: null, accessory: null });
    });

    it('preserves existing equippedItems', () => {
        const result = normalizeCharacter({ equippedItems: { weapon: 'rusty_sword', armor: null, accessory: 'mana_ring' } } as Character);
        expect(result.equippedItems).toEqual({ weapon: 'rusty_sword', armor: null, accessory: 'mana_ring' });
    });

    it('defaults inventory and other fields', () => {
        const result = normalizeCharacter({} as Character);
        expect(result.inventory).toEqual([]);
        expect(result.focus).toBe(10);
        expect(result.autoMode).toBe(false);
        expect(result.statPoints).toBe(0);
    });
});
