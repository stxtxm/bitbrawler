import { describe, it, expect } from 'vitest';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { applyEquipmentOverlays } from '../../components/sprite/equipOverlays';
import { generateSprite16 } from '../../components/sprite/spriteGenerator';
import { ACCENT_INDEX, ITEM_BLIT_OFFSET, TRIM_INDEX } from '../../components/sprite/spriteTypes';
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

  it('blits the real weapon art anchored at the hand', () => {
    const base = generateSprite16('hand-anchor', 'male');
    const sword = ITEM_ASSETS.find((i) => i.id === 'rusty_sword') ?? null;
    expect(sword).not.toBeNull();
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: sword,
      armor: null,
      accessory: null,
    });
    const blitCells: Array<[number, number]> = [];
    out.grid.forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell >= ITEM_BLIT_OFFSET && cell < ITEM_BLIT_OFFSET + 10) blitCells.push([x, y]);
      }),
    );
    expect(blitCells.length).toBeGreaterThan(0);
    for (const [x, y] of blitCells) {
      expect(x).toBeGreaterThanOrEqual(8);
      expect(y).toBeGreaterThanOrEqual(14);
      expect(y).toBeLessThanOrEqual(33);
    }
  });

  it('renders different weapons with different art', () => {
    const base = generateSprite16('weapon-diff', 'female');
    const sword = ITEM_ASSETS.find((i) => i.id === 'rusty_sword') ?? null;
    const bow = ITEM_ASSETS.find((i) => i.id === 'hunter_bow') ?? null;
    if (!sword || !bow) return;
    const a = JSON.stringify(
      applyEquipmentOverlays(base.grid, base.palette, { weapon: sword, armor: null, accessory: null }).grid,
    );
    const b = JSON.stringify(
      applyEquipmentOverlays(base.grid, base.palette, { weapon: bow, armor: null, accessory: null }).grid,
    );
    expect(a).not.toBe(b);
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
