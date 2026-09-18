import { describe, it, expect } from 'vitest';
import { ITEM_ASSETS } from '../../data/itemAssets';
import {
  applyEquipmentOverlays,
  computeLandmarks,
  armorVisualKind,
  accessoryVisualKind,
  weaponVisualKind,
  PLATE_INDEX,
  PLATE_STEEL,
  TRIM_DARK,
  TINT_INDEX,
  TINT2_INDEX,
  TINT2_DARK,
  BLADE_INDEX,
  BLADE_DARK,
  WOOD_INDEX,
  WHEAD_INDEX,
  FIELD_INDEX,
  FIELD_DARK,
  FIELD_LIGHT,
  STRING_INDEX,
  RIM_INDEX,
} from '../../components/sprite/equipOverlays';
import { generateSprite16 } from '../../components/sprite/spriteGenerator';
import { ACCENT_INDEX, TRIM_INDEX } from '../../components/sprite/spriteTypes';
import { RARITY_TRIM } from '../../components/sprite/spritePalettes';
import { ELEMENT_COLORS } from '../../types/Item';

const byId = (id: string) => ITEM_ASSETS.find((i) => i.id === id) ?? null;

const STD_MALE = { build: 'standard', bodyType: 'basic', headType: 'male' } as const;
const STD_FEMALE = { build: 'standard', bodyType: 'basic', headType: 'female' } as const;

const blitCells = (grid: number[][]): Array<[number, number]> => {
  const cells: Array<[number, number]> = [];
  grid.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell >= 70 && cell < 80) cells.push([x, y]);
    }),
  );
  return cells;
};

describe('equipment overlays v4 — chunky fitted gear', () => {
  it('leaves the grid untouched when nothing is equipped', () => {
    const base = generateSprite16('naked', 'male');
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: null,
    });
    expect(out.grid).toEqual(base.grid);
  });

  it('exposes anatomical anchors derived from the sprite itself', () => {
    const base = generateSprite16('anchor-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    expect(marks.faceCx).toBeGreaterThanOrEqual(marks.head.x0);
    expect(marks.faceCx).toBeLessThanOrEqual(marks.head.x1);
    expect(marks.palmR.x).toBe(marks.handR.x - 1);
    expect(marks.palmL.x).toBe(marks.handL.x + 1);
    expect(marks.neck.y).toBe(marks.torso.y0);
    expect(marks.chest.y).toBeGreaterThan(marks.torso.y0);
    expect(marks.chest.y).toBeLessThanOrEqual(marks.torso.y1);
  });

  it('classifies every weapon family from its own characteristics', () => {
    expect(weaponVisualKind(byId('hunter_bow')!)).toBe('bow');
    expect(weaponVisualKind(byId('iron_knuckles')!)).toBe('fist');
    expect(weaponVisualKind(byId('oak_staff')!)).toBe('staff');
    expect(weaponVisualKind(byId('chipped_wand')!)).toBe('scepter');
    expect(weaponVisualKind(byId('wand_of_storms')!)).toBe('scepter');
    expect(weaponVisualKind(byId('doom_scythe')!)).toBe('scythe');
    expect(weaponVisualKind(byId('bronze_axe')!)).toBe('haft');
    expect(weaponVisualKind(byId('apocalypse_hammer')!)).toBe('haft');
    expect(weaponVisualKind(byId('flame_dagger')!)).toBe('dagger');
    expect(weaponVisualKind(byId('rusty_sword')!)).toBe('blade');
    expect(weaponVisualKind(byId('dragon_blade')!)).toBe('blade');
  });

  it('forges blades as a chunky edge gripped in the fist', () => {
    const base = generateSprite16('blade-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('rusty_sword'),
      armor: null,
      accessory: null,
    });
    const tipY = marks.palmR.y - 1 - 9;
    // edge runs unbroken from tip to guard through the fist column
    // (outer bevel cells auto-darken where they meet the background)
    for (let y = tipY; y < marks.palmR.y - 1; y++) {
      expect([BLADE_INDEX, BLADE_DARK]).toContain(out.grid[y][marks.palmR.x]);
      expect([BLADE_INDEX, BLADE_DARK]).toContain(out.grid[y][marks.palmR.x + 1]);
    }
    // guard bar, wooden grip, pommel cap (outer bar cells bevel-darken)
    for (let x = marks.palmR.x - 1; x <= marks.palmR.x + 2; x++) {
      expect([TRIM_INDEX, TRIM_DARK]).toContain(out.grid[marks.palmR.y - 1][x]);
    }
    expect(out.grid[marks.palmR.y + 1][marks.palmR.x]).toBe(WOOD_INDEX);
    expect(out.grid[marks.palmR.y + 2][marks.palmR.x]).toBe(TRIM_INDEX);
    // blade colors come from the item art, not a fixed gray
    expect(out.palette[BLADE_INDEX]).toBe('#c0c0c0');
    const ember = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('ember_blade'),
      armor: null,
      accessory: null,
    });
    expect(ember.palette[BLADE_INDEX]).not.toBe(out.palette[BLADE_INDEX]);
  });

  it('draws daggers shorter than swords', () => {
    const base = generateSprite16('dagger-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const short = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('flame_dagger'),
      armor: null,
      accessory: null,
    });
    const long = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('rusty_sword'),
      armor: null,
      accessory: null,
    });
    const topOf = (grid: number[][]): number =>
      Math.min(
        ...grid.flatMap((row, y) =>
          row.map((c, x) => (c === BLADE_INDEX && (x === marks.palmR.x || x === marks.palmR.x + 1) ? y : 99)),
        ),
      );
    expect(topOf(short.grid)).toBeGreaterThan(topOf(long.grid));
  });

  it('holds bows with grip on the fist, limbs and string outside', () => {
    const base = generateSprite16('bow-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('hunter_bow'),
      armor: null,
      accessory: null,
    });
    // grip wrap sits on the fist itself — no floating gap
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(TRIM_INDEX);
    const limbYs: number[] = [];
    out.grid.forEach((row, y) => {
      row.forEach((c, x) => {
        if (c === WOOD_INDEX && x > marks.palmR.x + 1) limbYs.push(y);
      });
    });
    expect(Math.min(...limbYs)).toBeLessThanOrEqual(marks.palmR.y - 4);
    expect(Math.max(...limbYs)).toBeGreaterThanOrEqual(marks.palmR.y + 3);
    const stringXs = new Set<number>();
    out.grid.forEach((row, y) => {
      row.forEach((c, x) => {
        if (c === STRING_INDEX && y >= marks.palmR.y - 6 && y <= marks.palmR.y + 5) stringXs.add(x);
      });
    });
    expect(stringXs.size).toBe(1);
  });

  it('mounts axe heads on shafts driven through the fist', () => {
    const base = generateSprite16('haft-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('bronze_axe'),
      armor: null,
      accessory: null,
    });
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(WOOD_INDEX);
    const headRows = out.grid.slice(marks.palmR.y - 11, marks.palmR.y - 8).flat();
    expect(headRows).toContain(WHEAD_INDEX);
    expect(headRows.some((c) => c === BLADE_INDEX || c === BLADE_DARK)).toBe(true);
  });

  it('plants staves with a gem tip and scythes with a crossbar', () => {    const base = generateSprite16('staff-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const staff = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('oak_staff'),
      armor: null,
      accessory: null,
    });
    expect(staff.grid[marks.palmR.y][marks.palmR.x]).toBe(WOOD_INDEX);
    expect(staff.grid[marks.palmR.y + 3][marks.palmR.x]).toBe(WOOD_INDEX);
    expect(staff.grid[marks.palmR.y - 12][marks.palmR.x]).toBe(ACCENT_INDEX);
    const scythe = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('doom_scythe'),
      armor: null,
      accessory: null,
    });
    const bar = scythe.grid[marks.palmR.y - 11].slice(marks.palmR.x - 3, marks.palmR.x + 3);
    expect(bar).toContain(BLADE_INDEX);
  });

  it('keeps wands short like scepters, never full staves', () => {
    const base = generateSprite16('scepter-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('wand_of_storms'),
      armor: null,
      accessory: null,
    });
    // handle in the fist, gem head at shoulder height — nothing above y20
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(WOOD_INDEX);
    const tipRows = out.grid.slice(marks.palmR.y - 4, marks.palmR.y - 1).flat();
    expect(tipRows).toContain(WHEAD_INDEX);
    expect(out.grid[marks.palmR.y - 3][marks.palmR.x]).toBe(ACCENT_INDEX);
    const above = out.grid.slice(0, marks.palmR.y - 4).flat();
    expect(above).not.toContain(WOOD_INDEX);
    expect(above).not.toContain(WHEAD_INDEX);
  });

  it('straps knuckles over the fist', () => {
    const base = generateSprite16('fist-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('iron_knuckles'),
      armor: null,
      accessory: null,
    });
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(BLADE_INDEX);
    expect(out.grid[marks.palmR.y - 1][marks.palmR.x]).toBe(WHEAD_INDEX);
  });

  it('raises heater shields centered on the left forearm', () => {
    const base = generateSprite16('shield-check', 'female', { ...STD_FEMALE });
    const marks = computeLandmarks(base.grid);
    for (const id of ['guardian_shield', 'aqua_shield']) {
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: byId(id),
        accessory: null,
      });
      const zone = out.grid.slice(marks.palmL.y - 4, marks.palmL.y + 4).flat();
      expect(zone).toContain(FIELD_INDEX);
      expect(zone).toContain(TRIM_INDEX);
      expect(zone).toContain(ACCENT_INDEX);
    }
    const guardian = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('guardian_shield'),
      accessory: null,
    });
    const aqua = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('aqua_shield'),
      accessory: null,
    });
    expect(guardian.palette[FIELD_INDEX]).not.toBe(aqua.palette[FIELD_INDEX]);
  });

  it('armors the full torso in the item own steel with ridge and clasp', () => {
    const base = generateSprite16('plate-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const golem = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('golem_plate'),
      accessory: null,
    });
    expect(golem.palette[PLATE_INDEX]).toBe(PLATE_STEEL);
    const torsoField = golem.grid.slice(19, 30).flat().filter((c) => c === FIELD_INDEX).length;
    expect(torsoField).toBeGreaterThan(20);
    expect(golem.grid.slice(19, 30).flat()).toContain(FIELD_LIGHT);
    expect(golem.grid[marks.chest.y][marks.chest.x]).toBe(ACCENT_INDEX);
    const leather = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('leather_vest'),
      accessory: null,
    });
    expect(leather.palette[FIELD_INDEX]).not.toBe(golem.palette[FIELD_INDEX]);
    // neck skin preserved — armor follows clothing, never eats anatomy
    expect(golem.grid[18][10]).toBe(1);
  });

  it('classifies wrap/coif/greaves by anatomy, not by word fragment', () => {
    expect(armorVisualKind('Novice Wrap')).toBe('chest');
    expect(armorVisualKind('Chainmail Coif')).toBe('helm');
    expect(armorVisualKind('Iron Greaves')).toBe('boots');
    const base = generateSprite16('kind-check', 'male', { ...STD_MALE });
    const wrap = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('novice_wrap'),
      accessory: null,
    });
    expect(wrap.grid.slice(19, 30).flat().filter((c) => c === FIELD_INDEX).length).toBeGreaterThan(10);
    const coif = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('chainmail_coif'),
      accessory: null,
    });
    expect(coif.grid.slice(2, 10).flat()).toContain(FIELD_INDEX);
    const greaves = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('iron_greaves'),
      accessory: null,
    });
    expect(greaves.grid.slice(34, 36).flat()).toContain(TINT_INDEX);
  });

  it('helms the whole hair while preserving eyes and mouth', () => {
    const base = generateSprite16('helm-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    for (const id of ['iron_helm', 'titan_helm']) {
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: byId(id),
        accessory: null,
      });
      const headField = out.grid
        .slice(2, 10)
        .flat()
        .filter((c) => c === FIELD_INDEX || c === FIELD_DARK).length;
      expect(headField).toBeGreaterThan(10);
      const headZone = out.grid.slice(2, 17).flat();
      expect(headZone).toContain(8);
      expect(headZone).toContain(3);
      expect(out.grid[marks.eyeY - 3][marks.faceCx]).toBe(ACCENT_INDEX);
    }
    const iron = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('iron_helm'),
      accessory: null,
    });
    const titan = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('titan_helm'),
      accessory: null,
    });
    // titan keeps its gold rim, iron falls back to rarity trim
    expect(titan.palette[RIM_INDEX]).toBe('#ffcc00');
    expect(JSON.stringify(titan.grid)).not.toBe(JSON.stringify(iron.grid));
  });

  it('wears rings on the fist, never as a chest brooch', () => {
    const base = generateSprite16('ring-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    for (const id of ['mystic_ring', 'silver_ring']) {
      expect(accessoryVisualKind(byId(id)!.name)).toBe('ring');
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      });
      const fx = marks.palmR.x;
      const fy = marks.palmR.y + 1;
      expect(out.grid[fy][fx]).toBe(TRIM_INDEX);
      expect([TRIM_INDEX, TRIM_DARK]).toContain(out.grid[fy][fx + 1]);
      expect(out.grid[fy + 1][fx + 1]).toBe(ACCENT_INDEX);
      const chestZone = out.grid.slice(20, 26).flat();
      expect(chestZone).not.toContain(ACCENT_INDEX);
    }
  });

  it('hangs necklaces as chain plus gem over neck and chest', () => {
    const base = generateSprite16('neck-check', 'female', { ...STD_FEMALE });
    const marks = computeLandmarks(base.grid);
    for (const id of ['might_pendant', 'storm_amulet']) {
      expect(accessoryVisualKind(byId(id)!.name)).toBe('necklace');
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      });
      const cells = blitCells(out.grid).filter(
        ([x, y]) => y >= 17 && y <= 25 && Math.abs(x - marks.neck.x) <= 4,
      );
      expect(cells.length).toBeGreaterThan(5);
    }
    const a = JSON.stringify(
      applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId('might_pendant'),
      }).grid,
    );
    const b = JSON.stringify(
      applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId('storm_amulet'),
      }).grid,
    );
    expect(a).not.toBe(b);
  });

  it('pins brooches as a mini medallion on the chest', () => {
    const base = generateSprite16('brooch-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    for (const id of ['lucky_coin', 'cosmic_seal']) {
      expect(accessoryVisualKind(byId(id)!.name)).toBe('brooch');
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      });
      const cells = blitCells(out.grid).filter(
        ([x, y]) => Math.abs(x - marks.chest.x) <= 2 && Math.abs(y - marks.chest.y) <= 2,
      );
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.length).toBeLessThanOrEqual(16);
    }
  });

  it('floats orbs beside the head with a sparkle', () => {
    const base = generateSprite16('orb-check', 'female', { ...STD_FEMALE });
    const marks = computeLandmarks(base.grid);
    for (const id of ['spirit_orb', 'tsunami_orb']) {
      expect(accessoryVisualKind(byId(id)!.name)).toBe('orb');
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      });
      const cells = blitCells(out.grid).filter(([, y]) => y <= 14);
      expect(cells.length).toBeGreaterThan(0);
      const beside = cells.filter(([x]) => x > marks.head.x1 - 1 || x < marks.head.x0 + 1);
      expect(beside.length).toBeGreaterThan(0);
      expect(out.grid.flat()).toContain(ACCENT_INDEX);
    }
  });

  it('shrinks oversized orbs so they never swallow the head', () => {
    const base = generateSprite16('bigorb-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: byId('pyrite_orb'),
    });
    const cells = blitCells(out.grid);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(16);
    expect(cells.every(([x]) => x >= marks.head.x0)).toBe(true);
  });

  it('tints boots and bracers with each item own colors', () => {
    const base = generateSprite16('tint-check', 'male', { ...STD_MALE });
    const shadow = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('shadow_boots'),
      accessory: null,
    });
    const swift = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: byId('swift_boots'),
    });
    expect(shadow.grid.slice(34, 36).flat()).toContain(TINT_INDEX);
    expect(swift.grid.slice(34, 36).flat()).toContain(TINT_INDEX);
    expect(swift.palette[TINT_INDEX]).not.toBe(shadow.palette[TINT_INDEX]);
    const bracers = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('worn_bracers'),
      accessory: null,
    });
    const bracerZone = bracers.grid.slice(24, 30).flat();
    expect(bracerZone.some((c) => c === TINT2_INDEX || c === TINT2_DARK)).toBe(true);
    const gauntlets = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('spiked_gauntlets'),
      accessory: null,
    });
    expect(gauntlets.grid.slice(24, 30).flat().some((c) => c === TINT2_INDEX || c === TINT2_DARK)).toBe(true);
    expect(gauntlets.palette[TINT2_INDEX]).not.toBe(bracers.palette[TINT2_INDEX]);
  });

  it('crowns the head with art plus a rarity jewel', () => {
    const base = generateSprite16('crown-check', 'female', { ...STD_FEMALE });
    const marks = computeLandmarks(base.grid);
    for (const id of ['eternal_crown', 'sovereign_crown']) {
      expect(accessoryVisualKind(byId(id)!.name)).toBe('crown');
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      });
      expect(blitCells(out.grid).filter(([, y]) => y <= 9).length).toBeGreaterThan(0);
      expect(out.grid[marks.head.y0 + 1][marks.faceCx]).toBe(ACCENT_INDEX);
      const headZone = out.grid.slice(2, 17).flat();
      expect(headZone).toContain(8);
    }
  });

  it('adds a tip glint on epic and legendary blades only', () => {
    const base = generateSprite16('glint-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const tipY = marks.palmR.y - 1 - 9;
    const plain = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('rusty_sword'),
      armor: null,
      accessory: null,
    });
    const glint = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('glimmer_blade'),
      armor: null,
      accessory: null,
    });
    expect([BLADE_INDEX, BLADE_DARK]).toContain(plain.grid[tipY][marks.palmR.x + 1]);
    expect(glint.grid[tipY][marks.palmR.x + 1]).toBe(ACCENT_INDEX);
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
