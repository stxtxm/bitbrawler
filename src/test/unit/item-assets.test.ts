import { describe, it, expect } from 'vitest';
import { ITEM_ASSETS, ITEM_PALETTE } from '../../data/itemAssets';

describe('Item assets', () => {
  it('defines 23 items', () => {
    expect(ITEM_ASSETS.length).toBe(23);
  });

  it('assigns unlock levels up to 10', () => {
    const levels = ITEM_ASSETS.map((item) => item.requiredLevel);
    levels.forEach((level) => {
      expect(typeof level).toBe('number');
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(10);
    });

    for (let level = 1; level <= 10; level += 1) {
      expect(levels.includes(level)).toBe(true);
    }
  });

  it('uses valid 8x8 pixel grids', () => {
    ITEM_ASSETS.forEach((item) => {
      expect(item.pixels.length).toBe(8);
      item.pixels.forEach((row) => {
        expect(row.length).toBe(8);
      });
    });
  });

  it('only references palette colors', () => {
    const paletteKeys = new Set(Object.keys(ITEM_PALETTE));
    ITEM_ASSETS.forEach((item) => {
      item.pixels.flat().forEach((cell) => {
        expect(paletteKeys.has(String(cell))).toBe(true);
      });
    });
  });
});
