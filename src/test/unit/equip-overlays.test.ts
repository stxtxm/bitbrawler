import { describe, it, expect } from 'vitest';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { applyEquipmentOverlays } from '../../components/sprite/equipOverlays';
import { generateSprite16 } from '../../components/sprite/spriteGenerator';
import { ACCENT_INDEX, TRIM_INDEX } from '../../components/sprite/spriteTypes';
import { RARITY_TRIM } from '../../components/sprite/spritePalettes';
import { ELEMENT_COLORS } from '../../types/Item';

const firstOfSlot = (slot: 'weapon' | 'armor' | 'accessory') =>
  ITEM_ASSETS.find((i) => i.slot === slot) ?? null;

describe('equipment overlays', () => {
  it('leaves the grid untouched when nothing is equipped', () => {
    const base = generateSprite16('naked', 'male');
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: null,
    });
    expect(out.grid).toEqual(base.grid);
  });

  it('paints weapon, armor and accessory cells with rarity trim', () => {
    const base = generateSprite16('geared', 'female');
    const weapon = firstOfSlot('weapon');
    const armor = firstOfSlot('armor');
    const accessory = firstOfSlot('accessory');
    const out = applyEquipmentOverlays(base.grid, base.palette, { weapon, armor, accessory });
    const flat = out.grid.flat();
    expect(flat).toContain(TRIM_INDEX);
    expect(flat).toContain(9);
    expect(out.palette[TRIM_INDEX]).toBeDefined();
  });

  it('uses the highest rarity for the trim and the top element for the accent', () => {
    const base = generateSprite16('trim-check', 'male');
    const elemental = ITEM_ASSETS.find((i) => i.element !== undefined) ?? null;
    const legendary = ITEM_ASSETS.find((i) => i.rarity === 'legendary') ?? null;
    const loadout = {
      weapon: elemental?.slot === 'weapon' ? elemental : null,
      armor: legendary?.slot === 'armor' ? legendary : elemental?.slot === 'armor' ? elemental : null,
      accessory: null,
    };
    const out = applyEquipmentOverlays(base.grid, base.palette, loadout);
    const equipped = [loadout.weapon, loadout.armor].filter(
      (i): i is NonNullable<typeof i> => i !== null,
    );
    if (equipped.length === 0) return;
    const top = equipped.reduce((a, b) =>
      (({ common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 } as const)[b.rarity] >
      ({ common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 } as const)[a.rarity] ? b : a),
    );
    expect(out.palette[TRIM_INDEX]).toBe(RARITY_TRIM[top.rarity]);
    expect(Object.values(ELEMENT_COLORS)).toContain(out.palette[ACCENT_INDEX]);
  });
});
