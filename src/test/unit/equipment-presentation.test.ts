import { describe, expect, it } from 'vitest';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { PixelItemAsset } from '../../types/Item';
import {
  EQUIPMENT_SLOTS,
  ITEM_PIXEL_GRID_SIZE,
  RARITY_FRAME_CLASS,
  buildEquipmentComparison,
  getEquippedItemForSlot,
  getIconRenderSize,
  getIntegerIconScale,
  getRarityFrameClass,
} from '../../utils/equipmentPresentation';

const getItem = (id: string): PixelItemAsset => {
  const item = ITEM_ASSETS.find((asset) => asset.id === id);
  if (!item) throw new Error(`Missing test item: ${id}`);
  return item;
};

describe('equipmentPresentation', () => {
  it('exposes the three equipment slots in display order', () => {
    expect(EQUIPMENT_SLOTS).toEqual(['weapon', 'armor', 'accessory']);
  });

  it('snaps every icon size to an integer nearest-neighbour scale factor', () => {
    expect(ITEM_PIXEL_GRID_SIZE).toBe(8);

    for (const requested of [1, 7, 8, 12, 16, 22, 24, 30, 48, 64, 100]) {
      const scale = getIntegerIconScale(requested);
      expect(Number.isInteger(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(getIconRenderSize(requested)).toBe(scale * ITEM_PIXEL_GRID_SIZE);
      expect(getIconRenderSize(requested) % ITEM_PIXEL_GRID_SIZE).toBe(0);
    }
  });

  it('maps every rarity to a distinct frame class', () => {
    const classes = Object.values(RARITY_FRAME_CLASS);
    expect(new Set(classes).size).toBe(classes.length);

    expect(getRarityFrameClass('common')).toBe('rarity-common');
    expect(getRarityFrameClass('uncommon')).toBe('rarity-uncommon');
    expect(getRarityFrameClass('rare')).toBe('rarity-rare');
    expect(getRarityFrameClass('epic')).toBe('rarity-epic');
    expect(getRarityFrameClass('legendary')).toBe('rarity-legendary');
  });

  it('finds the equipped item matching a slot', () => {
    const sword = getItem('rusty_sword');
    const plate = getItem('aegis_plate');

    expect(getEquippedItemForSlot([sword, plate], 'armor')).toBe(plate);
    expect(getEquippedItemForSlot([sword, plate], 'accessory')).toBeNull();
  });

  it('builds a bag-versus-equipped stat comparison with signed deltas', () => {
    const equipped = getItem('rusty_sword');
    const bag = getItem('glimmer_blade');

    const comparison = buildEquipmentComparison(bag, equipped);
    const byKey = Object.fromEntries(comparison.map((entry) => [entry.key, entry]));

    expect(byKey.strength).toMatchObject({ preview: 2, equipped: 1, delta: 1 });
    expect(byKey.dexterity).toMatchObject({ preview: 1, equipped: 0, delta: 1 });
    expect(comparison.some((entry) => entry.key === 'luck')).toBe(false);
  });

  it('returns no comparison when the bag item or the equipped counterpart is missing', () => {
    const sword = getItem('rusty_sword');
    expect(buildEquipmentComparison(sword, null)).toEqual([]);
    expect(buildEquipmentComparison(null, sword)).toEqual([]);
  });
});
