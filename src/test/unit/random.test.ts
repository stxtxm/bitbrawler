import { describe, it, expect } from 'vitest';
import { mulberry32, getSeedFromText } from '../../utils/randomUtils';

describe('Random Utilities', () => {
    it('should be deterministic for the same seed', () => {
        const seed = 12345;
        const rng1 = mulberry32(seed);
        const rng2 = mulberry32(seed);

        expect(rng1()).toBe(rng2());
        expect(rng1()).toBe(rng2());
        expect(rng1()).toBe(rng2());
    });

    it('should generate different numbers for different seeds', () => {
        const rng1 = mulberry32(11111);
        const rng2 = mulberry32(22222);

        expect(rng1()).not.toBe(rng2());
    });

    it('should generate a seed from text consistently', () => {
        const text = "BITBRAWLER";
        const seed1 = getSeedFromText(text);
        const seed2 = getSeedFromText(text);

        expect(seed1).toBe(seed2);
        expect(seed1).toBeGreaterThan(0);
    });

    it('should generate different seeds for different text', () => {
        const seed1 = getSeedFromText("A");
        const seed2 = getSeedFromText("B");

        expect(seed1).not.toBe(seed2);
    });
});
