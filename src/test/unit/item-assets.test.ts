import { describe, it, expect } from 'vitest';
import { ITEM_ASSETS, ITEM_PALETTE } from '../../data/itemAssets';

describe('Item assets', () => {
  it('defines 50 items', () => {
    expect(ITEM_ASSETS.length).toBe(50);
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

  it('has at least 2 epic items available at level 1', () => {
    const level1Epics = ITEM_ASSETS.filter((item) => item.requiredLevel <= 1 && item.rarity === 'epic');
    expect(level1Epics.length).toBeGreaterThanOrEqual(2);
  });

  it('has at least 2 rare items available at level 1', () => {
    const level1Rares = ITEM_ASSETS.filter((item) => item.requiredLevel <= 1 && item.rarity === 'rare');
    expect(level1Rares.length).toBeGreaterThanOrEqual(2);
  });

  it('all items have valid slot types', () => {
    const validSlots = ['weapon', 'armor', 'accessory'];
    ITEM_ASSETS.forEach((item) => {
      expect(validSlots).toContain(item.slot);
    });
  });

  it('all items have valid rarity values', () => {
    const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    ITEM_ASSETS.forEach((item) => {
      expect(validRarities).toContain(item.rarity);
    });
  });

  it('each slot type has at least 14 items', () => {
    const weapons = ITEM_ASSETS.filter((i) => i.slot === 'weapon');
    const armors = ITEM_ASSETS.filter((i) => i.slot === 'armor');
    const accessories = ITEM_ASSETS.filter((i) => i.slot === 'accessory');
    expect(weapons.length).toBeGreaterThanOrEqual(14);
    expect(armors.length).toBeGreaterThanOrEqual(14);
    expect(accessories.length).toBeGreaterThanOrEqual(14);
  });

  it('all items have unique IDs', () => {
    const ids = ITEM_ASSETS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('legendary items exist at various levels starting from level 5', () => {
    const legendaries = ITEM_ASSETS.filter((i) => i.rarity === 'legendary');
    expect(legendaries.length).toBeGreaterThanOrEqual(3);
    legendaries.forEach((item) => {
      expect(item.requiredLevel).toBeGreaterThanOrEqual(5);
    });
  });

  it('all items have at least one stat bonus', () => {
    ITEM_ASSETS.forEach((item) => {
      const values = Object.values(item.stats);
      expect(values.length).toBeGreaterThan(0);
      values.forEach((v) => {
        expect(v).toBeGreaterThan(0);
      });
    });
  });

  it('has water element items', () => {
    const waterItems = ITEM_ASSETS.filter((i) => i.element === 'water');
    expect(waterItems.length).toBeGreaterThanOrEqual(3);
  });

  it('has at least one legendary at each of levels 5, 8, and 10', () => {
    expect(ITEM_ASSETS.some((i) => i.rarity === 'legendary' && i.requiredLevel === 5)).toBe(true);
    expect(ITEM_ASSETS.some((i) => i.rarity === 'legendary' && i.requiredLevel === 8)).toBe(true);
    expect(ITEM_ASSETS.some((i) => i.rarity === 'legendary' && i.requiredLevel === 10)).toBe(true);
  });

  it('tier 10 has at least 3 items (was 1)', () => {
    const tier10 = ITEM_ASSETS.filter((i) => i.requiredLevel === 10);
    expect(tier10.length).toBeGreaterThanOrEqual(3);
  });

  it('covers all 6 elements across items', () => {
    const elements = ITEM_ASSETS.filter((i) => i.element).map((i) => i.element);
    expect(new Set(elements).size).toBeGreaterThanOrEqual(6);
  });
});
