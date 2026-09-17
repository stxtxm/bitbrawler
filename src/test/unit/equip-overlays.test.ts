import { describe, it, expect } from 'vitest';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { applyEquipmentOverlays, PLATE_DARK, PLATE_INDEX, PLATE_LIGHT, PLATE_STEEL, TRIM_DARK } from '../../components/sprite/equipOverlays';
import { generateSprite16 } from '../../components/sprite/spriteGenerator';
import { ACCENT_INDEX, ITEM_BLIT_OFFSET, TRIM_INDEX } from '../../components/sprite/spriteTypes';
import { RARITY_TRIM } from '../../components/sprite/spritePalettes';
import { ELEMENT_COLORS } from '../../types/Item';

const byId = (id: string) => ITEM_ASSETS.find((i) => i.id === id) ?? null;

const blitCells = (grid: number[][]): Array<[number, number]> => {
  const cells: Array<[number, number]> = [];
  grid.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell >= ITEM_BLIT_OFFSET && cell < ITEM_BLIT_OFFSET + 10) cells.push([x, y]);
    }),
  );
  return cells;
};

describe('equipment overlays v2', () => {
  it('leaves the grid untouched when nothing is equipped', () => {
    const base = generateSprite16('naked', 'male');
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: null,
    });
    expect(out.grid).toEqual(base.grid);
  });

  it('swings blades up-right from the hand and holds poles vertically', () => {
    const base = generateSprite16('hand-anchor', 'male');
    const sword = byId('rusty_sword');
    const bow = byId('hunter_bow');
    expect(sword).not.toBeNull();
    expect(bow).not.toBeNull();
    const hand = (() => {
      for (let y = 24; y <= 31; y++) {
        const row = base.grid[y];
        for (let x = row.length - 1; x >= 0; x--) {
          if (row[x] !== 0) return { x, y };
        }
      }
      return { x: 17, y: 27 };
    })();
    const swung = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: sword,
      armor: null,
      accessory: null,
    });
    expect(swung.grid[hand.y][hand.x]).toBeGreaterThanOrEqual(ITEM_BLIT_OFFSET);
    const upRight = blitCells(swung.grid).filter(([x, y]) => x > hand.x && y < hand.y);
    expect(upRight.length).toBeGreaterThan(0);
    const held = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: bow,
      armor: null,
      accessory: null,
    });
    const vertical = blitCells(held.grid).filter(([x]) => x === hand.x || x === hand.x + 1);
    expect(vertical.length).toBeGreaterThan(0);
  });

  it('renders different weapons with different art', () => {
    const base = generateSprite16('weapon-diff', 'female');
    const sword = byId('rusty_sword');
    const bow = byId('hunter_bow');
    if (!sword || !bow) return;
    const a = JSON.stringify(
      applyEquipmentOverlays(base.grid, base.palette, { weapon: sword, armor: null, accessory: null }).grid,
    );
    const b = JSON.stringify(
      applyEquipmentOverlays(base.grid, base.palette, { weapon: bow, armor: null, accessory: null }).grid,
    );
    expect(a).not.toBe(b);
  });

  it('paints a steel chestplate with rarity trim on torso armor', () => {
    const base = generateSprite16('plate-check', 'male', { bodyType: 'basic' });
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('golem_plate'),
      accessory: null,
    });
    expect(out.palette[PLATE_INDEX]).toBe(PLATE_STEEL);
    const plateInTorso = out.grid.slice(20, 30).flat().filter((c) => c === PLATE_INDEX).length;
    expect(plateInTorso).toBeGreaterThan(10);
  });

  it('turns hair into a helm for headgear armor', () => {
    const base = generateSprite16('helm-check', 'male', { headType: 'male' });
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('iron_helm'),
      accessory: null,
    });
    const helmCells = out.grid.slice(2, 10).flat().filter((c) => c === PLATE_INDEX).length;
    expect(helmCells).toBeGreaterThan(0);
  });

  it('recolors boots and holds a shield in the left hand', () => {
    const base = generateSprite16('shield-check', 'female');
    const boots = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('shadow_boots'),
      accessory: null,
    });
    expect(boots.grid.slice(34, 36).flat()).toContain(TRIM_INDEX);
    const shield = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('guardian_shield'),
      accessory: null,
    });
    const leftBlit = blitCells(shield.grid).filter(([x]) => x < 12);
    expect(leftBlit.length).toBeGreaterThan(0);
  });

  it('hangs pendants at the neck and floats orbs beside the head', () => {
    const base = generateSprite16('jewel-check', 'female');
    const pendant = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: byId('might_pendant'),
    });
    const neckZone = pendant.grid.slice(20, 26).flat();
    expect(neckZone).toContain(ACCENT_INDEX);
    expect(neckZone).toContain(TRIM_INDEX);
    const orb = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: byId('spirit_orb'),
    });
    const orbCells = blitCells(orb.grid).filter(([x, y]) => x >= 17 && y <= 14);
    expect(orbCells.length).toBeGreaterThan(0);
  });

  it('dithers the plate, ridges the center and tints overlay edges', () => {
    const base = generateSprite16('polish-check', 'male', { bodyType: 'basic' });
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('golem_plate'),
      accessory: null,
    });
    const torso = out.grid.slice(20, 30).flat();
    expect(torso).toContain(PLATE_DARK);
    expect(torso).toContain(PLATE_LIGHT);
    expect(torso.some((c) => c === TRIM_INDEX || c === TRIM_DARK)).toBe(true);
    expect(out.palette[PLATE_DARK]).toBeDefined();
    expect(out.palette[PLATE_LIGHT]).toBeDefined();
  });

  it('jewels the headgear, chains the pendant and covers the hand with the weapon', () => {
    const base = generateSprite16('detail-check', 'female');
    const crowned = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('iron_helm'),
      accessory: byId('might_pendant'),
    });
    expect(crowned.grid.slice(2, 6).flat()).toContain(ACCENT_INDEX);
    expect(crowned.grid.slice(18, 24).flat()).toContain(TRIM_INDEX);
    const armed = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('rusty_sword'),
      armor: null,
      accessory: null,
    });
    let handCovered = false;
    for (let y = 24; y <= 31; y++) {
      const row = base.grid[y];
      for (let x = row.length - 1; x >= 0; x--) {
        if (row[x] !== 0) {
          const cell = armed.grid[y][x];
          if (cell >= ITEM_BLIT_OFFSET && cell < ITEM_BLIT_OFFSET + 10) handCovered = true;
          break;
        }
      }
    }
    expect(handCovered).toBe(true);
  });

  it('uses the highest rarity for the trim and survives unknown ids', () => {
    const base = generateSprite16('trim-check', 'male');
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('rusty_sword'),
      armor: byId('golem_plate'),
      accessory: byId('eternal_crown'),
    });
    expect(out.palette[TRIM_INDEX]).toBe(RARITY_TRIM.legendary);
    expect(Object.values(ELEMENT_COLORS)).toContain(out.palette[ACCENT_INDEX]);
    const unknown = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: null,
    });
    expect(unknown.grid).toEqual(base.grid);
  });
});
