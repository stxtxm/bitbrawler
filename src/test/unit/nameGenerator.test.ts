import { describe, it, expect } from 'vitest';
import { generateCharacterName } from '../../utils/characterUtils';

describe('generateCharacterName', () => {
    it('should generate a non-empty string', () => {
        const name = generateCharacterName();
        expect(name).toBeTruthy();
        expect(typeof name).toBe('string');
    });

    it('should generate names without numbers or special characters', () => {
        for (let i = 0; i < 100; i++) {
            const name = generateCharacterName();
            // No numbers
            expect(name).not.toMatch(/[0-9]/);
            // No special characters (only letters)
            expect(name).toMatch(/^[A-Za-z]+$/);
        }
    });

    it('should generate single-word names', () => {
        for (let i = 0; i < 100; i++) {
            const name = generateCharacterName();
            expect(name.split(' ').length).toBe(1);
        }
    });

    it('should generate names no longer than 10 characters', () => {
        for (let i = 0; i < 100; i++) {
            const name = generateCharacterName();
            expect(name.length).toBeLessThanOrEqual(10);
        }
    });

    it('should be reasonably varied', () => {
        const names = new Set();
        for (let i = 0; i < 50; i++) {
            names.add(generateCharacterName());
        }
        // We expect some variety
        expect(names.size).toBeGreaterThan(10);
    });
});
