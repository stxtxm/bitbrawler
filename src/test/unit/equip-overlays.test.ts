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
  TRIM_LIGHT,
  TINT_INDEX,
  TINT_DARK,
  TINT_LIGHT,
  TINT2_INDEX,
  TINT2_DARK,
  TINT2_LIGHT,
  BLADE_INDEX,
  BLADE_DARK,
  BLADE_LIGHT,
  WOOD_DARK,
  WOOD_LIGHT,
  WHEAD_DARK,
  WHEAD_LIGHT,
  ACCENT_DARK,
  WOOD_INDEX,
  WHEAD_INDEX,
  FIELD_INDEX,
  FIELD_DARK,
  FIELD_LIGHT,
  STRING_INDEX,
  RIM_INDEX,
} from '../../components/sprite/equipOverlays';
import { generateSprite16, generateSpriteFrames } from '../../components/sprite/spriteGenerator';
import { weaponAngleFor } from '../../components/sprite/weaponPoses';
import { ACCENT_INDEX, ITEM_BLIT_OFFSET, TRIM_INDEX, highlightIndexOf, shadeIndexOf } from '../../components/sprite/spriteTypes';
import { RARITY_TRIM } from '../../components/sprite/spritePalettes';
import { ELEMENT_COLORS } from '../../types/Item';

const byId = (id: string) => ITEM_ASSETS.find((i) => i.id === id) ?? null;

const STD_MALE = { build: 'standard', bodyType: 'basic', headType: 'male' } as const;
const STD_FEMALE = { build: 'standard', bodyType: 'basic', headType: 'female' } as const;

const WEAPON_FAMILY = new Set<number>([
  TRIM_INDEX, TRIM_DARK, TRIM_LIGHT,
  ACCENT_INDEX, ACCENT_DARK,
  BLADE_INDEX, BLADE_DARK, BLADE_LIGHT,
  WOOD_INDEX, WOOD_DARK, WOOD_LIGHT,
  WHEAD_INDEX, WHEAD_DARK, WHEAD_LIGHT,
  STRING_INDEX,
]);

const weaponItems = () => ITEM_ASSETS.filter((i) => i.slot === 'weapon');

type Cell = [x: number, y: number];
const cellsOf = (grid: number[][], accept: (value: number) => boolean): Cell[] => {
  const out: Cell[] = [];
  grid.forEach((row, y) => row.forEach((value, x) => {
    if (accept(value)) out.push([x, y]);
  }));
  return out;
};

const isWoodCell = (value: number): boolean =>
  value === WOOD_INDEX || value === WOOD_DARK || value === WOOD_LIGHT;
const isHeadCell = (value: number): boolean =>
  value === WHEAD_INDEX || value === WHEAD_DARK || value === WHEAD_LIGHT;
const isMetalCell = (value: number): boolean =>
  value === BLADE_INDEX || value === BLADE_DARK || value === BLADE_LIGHT;
const inBox = ([x, y]: Cell, x0: number, x1: number, y0: number, y1: number): boolean =>
  x >= x0 && x <= x1 && y >= y0 && y <= y1;

const blitCells = (grid: number[][]): Array<[number, number]> => {
  const cells: Array<[number, number]> = [];
  grid.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell >= 70 && cell < 80) cells.push([x, y]);
    }),
  );
  return cells;
};

const nonZeroComponents = (grid: number[][]): Array<Array<[number, number]>> => {
  const h = grid.length;
  const w = grid[0].length;
  const seen = Array.from({ length: h }, () => new Array<boolean>(w).fill(false));
  const comps: Array<Array<[number, number]>> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y][x] || grid[y][x] === 0) continue;
      const cells: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[x, y]];
      seen[y][x] = true;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        cells.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (seen[ny][nx] || grid[ny][nx] === 0) continue;
          seen[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }
      comps.push(cells);
    }
  }
  return comps;
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
    expect(weaponVisualKind(byId('short_spear')!)).toBe('spear');
    expect(weaponVisualKind(byId('glaive')!)).toBe('spear');
    expect(weaponVisualKind(byId('chipped_wand')!)).toBe('scepter');
    expect(weaponVisualKind(byId('wand_of_storms')!)).toBe('scepter');
    expect(weaponVisualKind(byId('doom_scythe')!)).toBe('scythe');
    expect(weaponVisualKind(byId('bronze_axe')!)).toBe('haft');
    expect(weaponVisualKind(byId('apocalypse_hammer')!)).toBe('haft');
    expect(weaponVisualKind(byId('flame_dagger')!)).toBe('dagger');
    expect(weaponVisualKind(byId('rusty_sword')!)).toBe('blade');
    expect(weaponVisualKind(byId('dragon_blade')!)).toBe('blade');
  });

  it('forges blades as a rigid edged weapon gripped in the fist', () => {
    const base = generateSprite16('blade-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('rusty_sword'),
      armor: null,
      accessory: null,
    });
    const blade = cellsOf(out.grid, (v) => v === BLADE_DARK || v === BLADE_LIGHT);
    expect(blade.length).toBeGreaterThan(18);
    const core = cellsOf(out.grid, (v) => v === BLADE_LIGHT);
    expect(core.length).toBeGreaterThan(6);
    const tip = blade.reduce((best, cell) => (cell[1] < best[1] ? cell : best), blade[0]!);
    expect(tip[1]).toBeLessThan(marks.palmR.y - 8);
    expect(tip[0]).toBeGreaterThan(marks.palmR.x);
    // The guard sits above the fist, so it stays readable instead of being
    // painted over by the hand.
    const guard = cellsOf(out.grid, (v) => v === TRIM_INDEX || v === ACCENT_INDEX || v === BLADE_INDEX)
      .filter(([x, y]) => inBox([x, y], marks.palmR.x - 4, marks.palmR.x + 5, marks.palmR.y - 3, marks.palmR.y - 1));
    expect(guard.length).toBeGreaterThan(2);
    // The fist is stamped over the grip; wood and the pommel continue below it.
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(1);
    expect(out.grid[marks.palmR.y][marks.palmR.x + 1]).toBe(1);
    const grip = cellsOf(out.grid, isWoodCell)
      .filter(([x, y]) => inBox([x, y], marks.palmR.x - 2, marks.palmR.x + 3, marks.palmR.y + 1, marks.palmR.y + 3));
    expect(grip.length).toBeGreaterThan(0);
    expect(out.palette[BLADE_INDEX]).toBe('#c0c0c0');
    const ember = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('ember_blade'),
      armor: null,
      accessory: null,
    });
    expect(ember.palette[BLADE_INDEX]).not.toBe(out.palette[BLADE_INDEX]);
    expect(
      cellsOf(ember.grid, (v) => v === ACCENT_INDEX)
        .some(([x, y]) => inBox([x, y], marks.palmR.x - 4, marks.palmR.x + 5, marks.palmR.y - 3, marks.palmR.y - 1)),
    ).toBe(true);
  });

  it('pivots the whole blade around the fist instead of sliding the hilt', () => {
    const base = generateSprite16('pivot-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const loadout = { weapon: byId('rusty_sword'), armor: null, accessory: null };
    const rest = applyEquipmentOverlays(base.grid, base.palette, loadout, {});
    const swung = applyEquipmentOverlays(base.grid, base.palette, loadout, { weaponAngle: 0.6 });
    const topTip = (grid: number[][]) => {
      const cells = cellsOf(grid, (v) => v === BLADE_DARK || v === BLADE_LIGHT);
      return cells.reduce((best, cell) => (cell[1] < best[1] ? cell : best), cells[0]!);
    };
    const a = topTip(rest.grid);
    const b = topTip(swung.grid);
    // A positive angle swings the point outboard; the palm and the fist do not
    // slide through each other.
    expect(b[0]).toBeGreaterThan(a[0]);
    for (const grid of [rest.grid, swung.grid]) {
      expect(grid[marks.palmR.y][marks.palmR.x]).toBe(1);
      expect(grid[marks.palmR.y][marks.palmR.x + 1]).toBe(1);
    }
  });

  it('gives maces a heavy metal head on a clean shaft', () => {
    const base = generateSprite16('mace-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('iron_mace'),
      armor: null,
      accessory: null,
    });
    const head = cellsOf(out.grid, isHeadCell)
      .filter(([x, y]) => inBox([x, y], marks.palmR.x - 5, marks.palmR.x + 7, marks.palmR.y - 13, marks.palmR.y - 3));
    expect(head.length).toBeGreaterThanOrEqual(12);
    const darkOutline = cellsOf(out.grid, (v) => v === WHEAD_DARK)
      .filter(([x, y]) => inBox([x, y], marks.palmR.x - 5, marks.palmR.x + 7, marks.palmR.y - 13, marks.palmR.y - 3));
    expect(darkOutline.length).toBeGreaterThanOrEqual(4);
    const shaft = cellsOf(out.grid, isWoodCell)
      .filter(([x, y]) => inBox([x, y], marks.palmR.x - 3, marks.palmR.x + 5, marks.palmR.y - 8, marks.palmR.y + 2));
    expect(shaft.length).toBeGreaterThan(5);
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(1);
  });

  it('keeps every weapon attached to the fist column', () => {
    const base = generateSprite16('guard-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    for (const item of weaponItems()) {
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: item,
        armor: null,
        accessory: null,
      });
      const region = cellsOf(out.grid, (v) => WEAPON_FAMILY.has(v))
        .filter(([x, y]) => inBox([x, y], marks.palmR.x - 3, marks.palmR.x + 3, marks.palmR.y - 1, marks.palmR.y + 2));
      expect(region.length, `${item.id} grip beside fist`).toBeGreaterThan(0);
      expect(out.grid[marks.palmR.y][marks.palmR.x], `${item.id} fist`).not.toBe(0);
    }
  });

  it('keeps weapon pixels behind the body inside the head box across every frame', () => {
    const kinds: Array<[string, string]> = [
      ['blade', 'rusty_sword'],
      ['dagger', 'flame_dagger'],
      ['haft', 'bronze_axe'],
      ['staff', 'oak_staff'],
      ['spear', 'short_spear'],
      ['scepter', 'wand_of_storms'],
      ['scythe', 'doom_scythe'],
      ['bow', 'hunter_bow'],
      ['fist', 'iron_knuckles'],
    ];
    for (const [kind, id] of kinds) {
      for (const anim of ['idle', 'run', 'attack', 'hit', 'victory'] as const) {
        const frames = generateSpriteFrames('head-clear', 'male', { ...STD_MALE }, anim)!;
        for (const [frameIdx, frame] of frames.entries()) {
          const marks = computeLandmarks(frame.grid);
          const out = applyEquipmentOverlays(frame.grid, frame.palette, {
            weapon: byId(id),
            armor: null,
            accessory: null,
          }, { weaponAngle: weaponAngleFor(anim, frameIdx) });
          let overBody = 0;
          for (let y = marks.head.y0; y <= marks.head.y1; y++) {
            for (let x = marks.head.x0; x <= marks.head.x1; x++) {
              if (frame.grid[y]?.[x] !== 0 && WEAPON_FAMILY.has(out.grid[y]?.[x] ?? 0)) overBody++;
            }
          }
          // The weapon may pass through empty air inside the head box, but it
          // must be hidden behind the actual body/head pixels, never painted
          // over the face or the hair.
          expect(overBody, `${kind} ${anim}`).toBe(0);
        }
      }
    }
  });

  it('keeps the blade above the hand for every bladed weapon', () => {
    const base = generateSprite16('above-hand', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    for (const item of weaponItems()) {
      const kind = weaponVisualKind(item);
      if (kind !== 'blade' && kind !== 'dagger') continue;
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: item,
        armor: null,
        accessory: null,
      });
      const cutting = cellsOf(out.grid, (v) => v === BLADE_DARK || v === BLADE_LIGHT);
      expect(cutting.length, `${item.id} cutting edge`).toBeGreaterThan(8);
      const lowest = Math.max(...cutting.map(([, y]) => y));
      expect(lowest, `${item.id} blade bottom`).toBeLessThan(marks.palmR.y);
    }
  });

  it('draws daggers shorter than swords', () => {
    const base = generateSprite16('dagger-check', 'male', { ...STD_MALE });
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
      Math.min(...cellsOf(grid, (v) => v === BLADE_DARK || v === BLADE_LIGHT).map(([, y]) => y));
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
    // The fist closes over the grip; the bow itself is one rigid overlay.
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(1);
    const limbs = cellsOf(out.grid, isWoodCell)
      .filter(([, y]) => y >= marks.palmR.y - 9 && y <= marks.palmR.y + 7);
    expect(limbs.length).toBeGreaterThan(8);
    expect(Math.min(...limbs.map(([, y]) => y))).toBeLessThanOrEqual(marks.palmR.y - 4);
    expect(Math.max(...limbs.map(([, y]) => y))).toBeGreaterThanOrEqual(marks.palmR.y + 2);
    const strings = cellsOf(out.grid, (v) => v === STRING_INDEX);
    expect(strings.length).toBeGreaterThan(5);
    const xs = new Set(strings.map(([x]) => x));
    // The rigid bow is tilted at the rest angle, so its string is not a
    // one-column vertical line anymore.
    expect(xs.size).toBeGreaterThan(1);
  });

  it('mounts axe heads on shafts driven through the fist', () => {
    const base = generateSprite16('haft-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('bronze_axe'),
      armor: null,
      accessory: null,
    });
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(1);
    const zone = (grid: number[][]) =>
      cellsOf(grid, (v) => isHeadCell(v) || isMetalCell(v))
        .filter(([x, y]) => inBox([x, y], marks.palmR.x - 4, marks.palmR.x + 7, marks.palmR.y - 13, marks.palmR.y - 3));
    const head = zone(out.grid);
    expect(head.length).toBeGreaterThan(4);
    expect(cellsOf(out.grid, isHeadCell).length).toBeGreaterThan(3);
    expect(cellsOf(out.grid, isMetalCell).length).toBeGreaterThan(0);
    expect(
      cellsOf(out.grid, isWoodCell).filter(([, y]) => y > marks.palmR.y && y < marks.palmR.y + 4).length,
    ).toBeGreaterThan(0);
    const quake = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('sundering_axe'),
      armor: null,
      accessory: null,
    });
    expect(
      cellsOf(quake.grid, (v) => v === ACCENT_INDEX)
        .some(([x, y]) => inBox([x, y], marks.palmR.x - 4, marks.palmR.x + 7, marks.palmR.y - 13, marks.palmR.y - 3)),
    ).toBe(true);
  });

  it('plants staves with a gem tip and scythes with a crossbar', () => {
    const base = generateSprite16('staff-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const staff = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('oak_staff'),
      armor: null,
      accessory: null,
    });
    expect(staff.grid[marks.palmR.y][marks.palmR.x]).toBe(1);
    expect(
      cellsOf(staff.grid, isWoodCell).some(([, y]) => y > marks.palmR.y && y <= marks.palmR.y + 4),
    ).toBe(true);
    expect(
      cellsOf(staff.grid, (v) => v === ACCENT_INDEX).some(([, y]) => y < marks.palmR.y - 5),
    ).toBe(true);
    const scythe = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('doom_scythe'),
      armor: null,
      accessory: null,
    });
    expect(
      cellsOf(scythe.grid, isMetalCell).some(([x, y]) =>
        inBox([x, y], marks.palmR.x - 5, marks.palmR.x + 7, marks.palmR.y - 13, marks.palmR.y - 5),
      ),
    ).toBe(true);
  });

  it('gives spears a pointed metal head instead of a staff gem', () => {
    const base = generateSprite16('spear-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('short_spear'),
      armor: null,
      accessory: null,
    });
    const metal = cellsOf(out.grid, isMetalCell).filter(([, y]) => y < marks.palmR.y - 2);
    expect(metal.length).toBeGreaterThan(3);
    expect(Math.min(...metal.map(([, y]) => y))).toBeLessThan(marks.palmR.y - 7);
    expect(
      cellsOf(out.grid, isWoodCell).some(([, y]) => y > marks.palmR.y && y < marks.palmR.y + 4),
    ).toBe(true);
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(1);
  });

  it('keeps wands short like scepters, never full staves', () => {
    const base = generateSprite16('scepter-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('wand_of_storms'),
      armor: null,
      accessory: null,
    });
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(1);
    const headCells = cellsOf(out.grid, (v) => isHeadCell(v) || v === ACCENT_INDEX)
      .filter(([, y]) => y < marks.palmR.y - 2);
    expect(headCells.length).toBeGreaterThan(3);
    expect(headCells.some(([x, y]) => out.grid[y][x] === ACCENT_INDEX)).toBe(true);
    expect(
      cellsOf(out.grid, isWoodCell).filter(([, y]) => y < marks.palmR.y - 8).length,
    ).toBe(0);
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
    expect([WHEAD_INDEX, WHEAD_DARK, WHEAD_LIGHT]).toContain(out.grid[marks.palmR.y - 1][marks.palmR.x]);
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
      expect(zone.some((c) => c === TRIM_INDEX || c === TRIM_DARK || c === TRIM_LIGHT)).toBe(true);
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
    const torsoField = golem.grid.slice(25, 36).flat().filter((c) => c === FIELD_INDEX).length;
    expect(torsoField).toBeGreaterThan(20);
    expect(golem.grid.slice(25, 36).flat()).toContain(FIELD_LIGHT);
    expect(golem.grid[marks.chest.y][marks.chest.x]).toBe(ACCENT_INDEX);
    const leather = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('leather_vest'),
      accessory: null,
    });
    expect(leather.palette[FIELD_INDEX]).not.toBe(golem.palette[FIELD_INDEX]);
    // logo-color collar on the trapezius slope beside the neck, never on the
    // throat: painting the neck hid it and welded the head to the shoulders
    expect(golem.grid[24][10]).not.toBe(11);
    expect(golem.grid[24].filter((c) => c === 11).length).toBeGreaterThanOrEqual(2);
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
    expect(wrap.grid.slice(25, 36).flat().filter((c) => c === FIELD_INDEX).length).toBeGreaterThan(10);
    const coif = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('chainmail_coif'),
      accessory: null,
    });
    expect(coif.grid.slice(8, 16).flat()).toContain(FIELD_INDEX);
    const greaves = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('iron_greaves'),
      accessory: null,
    });
    expect(greaves.grid.slice(40, 42).flat().some((c) => c === TINT_INDEX || c === TINT_DARK || c === TINT_LIGHT)).toBe(true);
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
        .slice(8, 16)
        .flat()
        .filter((c) => c === FIELD_INDEX || c === FIELD_DARK).length;
      expect(headField).toBeGreaterThan(10);
      const headZone = out.grid.slice(8, 23).flat();
      // the iris uses the shaded eye tone, so accept it as well as the base
      expect(headZone.some((c) => c === 8 || c === shadeIndexOf(8))).toBe(true);
      expect(headZone).toContain(3);
      // The gem rides the brim, one row above the brow, not on the forehead.
      expect(out.grid[marks.eyeY - 2][marks.faceCx]).toBe(ACCENT_INDEX);
      // A helm must never cover the eyes: the cap stops at the brow line.
      const eyeRow = out.grid[marks.eyeY] ?? [];
      expect(eyeRow.filter((c) => c === FIELD_INDEX || c === FIELD_DARK).length).toBe(0);
      expect(eyeRow.some((c) => c === 8 || c === shadeIndexOf(8))).toBe(true);
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
        ([x, y]) => y >= 23 && y <= 31 && Math.abs(x - marks.neck.x) <= 4,
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

  it('hangs orbs as pendants: chain plus medallion on the chest', () => {
    const base = generateSprite16('orb-check', 'female', { ...STD_FEMALE });
    const marks = computeLandmarks(base.grid);
    for (const id of ['spirit_orb', 'tsunami_orb', 'pyrite_orb']) {
      expect(accessoryVisualKind(byId(id)!.name)).toBe('orb');
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      });
      // miniature medallion of the orb art, centered on the chest
      const cells = blitCells(out.grid).filter(
        ([x, y]) => Math.abs(x - marks.chest.x) <= 3 && Math.abs(y - marks.chest.y) <= 3,
      );
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.length).toBeLessThanOrEqual(16);
      // rarity chain running from the neck down to the medallion
      const chain = out.grid
        .slice(marks.neck.y, marks.chest.y - 1)
        .map((row) => row[marks.chest.x]);
      expect(chain).toContain(TRIM_INDEX);
    }
    const pyrite = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: byId('pyrite_orb'),
    });
    const spirit = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: byId('spirit_orb'),
    });
    expect(JSON.stringify(pyrite.grid)).not.toBe(JSON.stringify(spirit.grid));
  });

  it('anchors every hanging accessory to the neckline with a visible support', () => {
    const seeds: Array<[string, 'male' | 'female']> = [
      ['k3f9qz1a', 'male'],
      ['v7m2xp4c', 'female'],
    ];
    const suspended = ITEM_ASSETS.filter((i) => {
      if (i.slot !== 'accessory') return false;
      const kind = accessoryVisualKind(i.name);
      return kind === 'necklace' || kind === 'orb' || kind === 'brooch';
    });
    expect(suspended.length).toBeGreaterThan(10);
    const support = new Set<number>([
      TRIM_INDEX, TRIM_DARK, TRIM_LIGHT, ACCENT_INDEX, ACCENT_DARK,
    ]);
    for (const [seed, gender] of seeds) {
      const base = generateSprite16(seed, gender);
      const marks = computeLandmarks(base.grid);
      for (const item of suspended) {
        const out = applyEquipmentOverlays(base.grid, base.palette, {
          weapon: null,
          armor: null,
          accessory: item,
        });
        const gemTop = Math.min(
          ...out.grid.flatMap((row, y) =>
            row.map((c) => (c >= ITEM_BLIT_OFFSET && c < ITEM_BLIT_OFFSET + 10 ? y : 99)),
          ),
        );
        expect(gemTop, `${item.id} pendant row`).toBeLessThan(marks.chest.y + 4);
        // the collar band rides the torso top, above the pendant
        expect(
          out.grid[marks.torso.y0].some(
            (c, x) => support.has(c) && Math.abs(x - marks.neck.x) <= 3,
          ),
          `${item.id} collar`,
        ).toBe(true);
        // a visible strand links the collar to the pendant on every row between
        for (let y = marks.torso.y0; y < gemTop; y++) {
          expect(
            out.grid[y].some((c, x) => support.has(c) && Math.abs(x - marks.neck.x) <= 3),
            `${item.id} support y${y}`,
          ).toBe(true);
        }
      }
    }
  });

  it('keeps every accessory a single contiguous zone anchored to the body', () => {
    const accessories = ITEM_ASSETS.filter((i) => i.slot === 'accessory');
    expect(accessories.length).toBeGreaterThan(20);
    const builds = ['slim', 'standard', 'broad'] as const;
    for (const seed of ['k3f9qz1a', 'v7m2xp4c', 'r8t5wd0b']) {
      for (const build of builds) {
        const base = generateSprite16(seed, 'male', { build, bodyType: 'basic', headType: 'male' });
        expect(nonZeroComponents(base.grid).length, `${seed} ${build}`).toBe(1);
        for (const item of accessories) {
          const out = applyEquipmentOverlays(base.grid, base.palette, {
            weapon: null,
            armor: null,
            accessory: item,
          });
          expect(nonZeroComponents(out.grid).length, `${item.id} ${build} islands`).toBe(1);
        }
      }
    }
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
    expect(shadow.grid.slice(40, 42).flat().some((c) => c === TINT_INDEX || c === TINT_DARK || c === TINT_LIGHT)).toBe(true);
    expect(swift.grid.slice(40, 42).flat().some((c) => c === TINT_INDEX || c === TINT_DARK || c === TINT_LIGHT)).toBe(true);
    expect(swift.palette[TINT_INDEX]).not.toBe(shadow.palette[TINT_INDEX]);
    const bracers = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('worn_bracers'),
      accessory: null,
    });
    const bracerZone = bracers.grid.slice(30, 36).flat();
    expect(bracerZone.some((c) => c === TINT2_INDEX || c === TINT2_DARK)).toBe(true);
    const gauntlets = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('spiked_gauntlets'),
      accessory: null,
    });
    expect(gauntlets.grid.slice(30, 36).flat().some((c) => c === TINT2_INDEX || c === TINT2_DARK)).toBe(true);
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
      expect(blitCells(out.grid).filter(([, y]) => y <= 15).length).toBeGreaterThan(0);
      expect(out.grid[marks.head.y0 + 1][marks.faceCx]).toBe(ACCENT_INDEX);
      const headZone = out.grid.slice(8, 23).flat();
      expect(headZone.some((c) => c === 8 || c === shadeIndexOf(8))).toBe(true);
    }
  });

  it('keeps the scythe glint local to the blade instead of filling the air', () => {
    const base = generateSprite16('scythe-glint', 'male', { ...STD_MALE });
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('voidreaper'),
      armor: null,
      accessory: null,
    });
    const accents = cellsOf(out.grid, (v) => v === ACCENT_INDEX);
    expect(accents.length).toBeGreaterThan(0);
    expect(accents.length).toBeLessThan(24);
    const marks = computeLandmarks(base.grid);
    for (const [x, y] of accents) {
      expect(Math.abs(x - marks.palmR.x)).toBeLessThanOrEqual(8);
      expect(marks.palmR.y - y).toBeLessThanOrEqual(15);
    }
  });

  it('adds a tip glint on epic and legendary blades only', () => {
    const base = generateSprite16('glint-check', 'male', { ...STD_MALE });
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
    const topOf = (grid: number[][], accept: (v: number) => boolean): Cell => {
      const cells = cellsOf(grid, accept);
      expect(cells.length).toBeGreaterThan(0);
      return cells.reduce((best, cell) => (cell[1] < best[1] ? cell : best), cells[0]!);
    };
    const plainTip = topOf(plain.grid, (v) => v === BLADE_LIGHT);
    const glintTip = topOf(glint.grid, (v) => v === ACCENT_INDEX);
    expect(plain.grid[plainTip[1]][plainTip[0]]).toBe(BLADE_LIGHT);
    expect(glint.grid[glintTip[1]][glintTip[0]]).toBe(ACCENT_INDEX);
  });

  it('keeps a stable fist anchor across run frames while limbs move', () => {
    const frames = generateSpriteFrames('track-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'run')!;
    const palms = frames.map((f) => {
      const p = computeLandmarks(f.grid).palmR;
      return `${p.x},${p.y}`;
    });
    // same column always (no horizontal teleport), flight bob ±2 rows max
    const xs = palms.map((s) => Number(s.split(',')[0]));
    const ys = palms.map((s) => Number(s.split(',')[1]));
    expect(new Set(xs).size).toBe(1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(2);
    const sword = byId('rusty_sword')!;
    const grids = frames.map(
      (f) => JSON.stringify(applyEquipmentOverlays(f.grid, f.palette, {
        weapon: sword,
        armor: null,
        accessory: null,
      }).grid),
    );
    expect(new Set(grids).size).toBe(6);
  });

  it("fait suivre la respiration par l'arme d'attente, sans la faire glisser", () => {
    const frames = generateSpriteFrames('idle-gear', 'male', { ...STD_MALE }, 'idle')!;
    const palms = frames.map((f) => computeLandmarks(f.grid).palmR);
    // La main est un repère FIXE pendant la respiration : le souffle passe par
    // le buste, au-dessus de la ceinture. Un poing qui glissait d'un pixel par
    // frame faisait gigoter l'arme hors de la grille du corps.
    expect(new Set(palms.map((p) => p.x)).size).toBe(1);
    expect(new Set(palms.map((p) => p.y)).size).toBe(1);
    const sword = byId('rusty_sword')!;
    const weaponTops = frames.map((f) => {
      const g = applyEquipmentOverlays(f.grid, f.palette, {
        weapon: sword,
        armor: null,
        accessory: null,
      }).grid;
      // premier pixel qui n'existe pas sur le corps nu = le haut de l'arme
      for (let y = 0; y < g.length; y++) {
        for (let x = 0; x < g[y].length; x++) {
          if (g[y][x] !== f.grid[y][x]) return y;
        }
      }
      return -1;
    });
    // L'arme garde exactement le même écart à la main sur toutes les poses :
    // elle ne se détache pas du poing.
    expect(weaponTops.every((y) => y > 0)).toBe(true);
    expect(new Set(weaponTops.map((y, i) => y - palms[i].y)).size).toBe(1);
  });

  it('thrusts the weapon with the punching fist on attack frames', () => {
    const frames = generateSpriteFrames('jab-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'attack')!;
    const fists = frames.map((f) => computeLandmarks(f.grid).palmR.x);
    // the chambered anticipation comes before the extended impact
    const anticipation = fists.indexOf(Math.min(...fists));
    const impact = fists.indexOf(Math.max(...fists));
    expect(anticipation).toBeLessThan(impact);
    const sword = byId('flame_dagger')!;
    const tips = frames.map(
      (f) =>
        Math.max(
          ...applyEquipmentOverlays(f.grid, f.palette, {
            weapon: sword,
            armor: null,
            accessory: null,
          }).grid.flatMap((row) =>
            row.map((c, x) => (c === BLADE_INDEX || c === BLADE_DARK || c === BLADE_LIGHT ? x : -1)),
          ),
        ),
    );
    expect(tips[impact]).toBeGreaterThan(tips[anticipation]);
    expect(tips[impact]).toBe(Math.max(...tips));
  });

  it('recoils the bust horizontally on hit frames', () => {
    const frames = generateSpriteFrames('hit-recoil-check', 'male', { ...STD_MALE }, 'hit')!;
    const bustX = frames.map((f) => {
      let sum = 0;
      let n = 0;
      for (let y = 26; y <= 33; y++) {
        f.grid[y]?.forEach((c, x) => {
          if (c !== 0) {
            sum += x;
            n++;
          }
        });
      }
      return sum / n;
    });
    expect(Math.max(...bustX) - Math.min(...bustX)).toBeGreaterThanOrEqual(1);
  });

  it('sways the held weapon with the stride without losing cells', () => {    const base = generateSprite16('sway-check', 'male', { ...STD_MALE });
    const loadout = { weapon: byId('flame_dagger'), armor: null, accessory: null };
    const outs = [-1, 0, 1].map((swayX) =>
      applyEquipmentOverlays(base.grid, base.palette, loadout, { swayX }),
    );
    const bladeMax = outs.map(
      (o) =>
        Math.max(
          ...o.grid.flatMap((row) =>
            row.map((c, x) => (c === BLADE_INDEX || c === BLADE_DARK || c === BLADE_LIGHT ? x : -1)),
          ),
        ),
    );
    expect(bladeMax[2]).toBe(bladeMax[1] + 1);
    expect(bladeMax[0]).toBe(bladeMax[1] - 1);
    const counts = outs.map(
      (o) => o.grid.flat().filter((c) => c === BLADE_INDEX || c === BLADE_DARK || c === BLADE_LIGHT).length,
    );
    expect(new Set(counts).size).toBe(1);
  });

  it('draws the strike trail additively: it can never overwrite the body', () => {
    const base = generateSprite16('trail-check', 'male', { ...STD_MALE });
    // Body families must survive untouched. Overlay pixels may legitimately
    // change because the new trail neighbours re-tint the weapon edges.
    const isBody = (v: number): boolean => {
      for (const fam of [1, 3, 4, 5, 6, 7, 9, 11, 12]) {
        if (v === fam || v === 30 + fam || v === 40 + fam) return true;
      }
      return false;
    };
    let totalAdded = 0;
    for (const id of ['dragon_blade', 'wand_of_storms', 'iron_sword', 'bone_wand']) {
      const loadout = { weapon: byId(id)!, armor: byId('iron_cuirass'), accessory: byId('might_pendant') };
      const plain = applyEquipmentOverlays(base.grid, base.palette, loadout, {});
      const trailed = applyEquipmentOverlays(base.grid, base.palette, loadout, { punchTrail: 3 });
      expect(trailed.grid.length).toBe(plain.grid.length);
      let added = 0;
      for (let y = 0; y < plain.grid.length; y++) {
        for (let x = 0; x < plain.grid[y].length; x++) {
          const before = plain.grid[y][x];
          const after = trailed.grid[y][x];
          if (before === after) continue;
          if (isBody(before)) {
            // A body cell changed: the trail punched a hole in the character.
            expect(after).toBe(before);
          }
          if (before === 0 && after !== 0) added++;
        }
      }
      totalAdded += added;
    }
    // Short weapons can legitimately have no free air behind them; at least
    // one loadout must actually show the trail.
    expect(totalAdded).toBeGreaterThan(0);
  });

  it('swings hanging jewelry with the stride, worn gear stays put', () => {
    const base = generateSprite16('swing-check', 'female', { ...STD_FEMALE });
    const marks = computeLandmarks(base.grid);
    const medallion = (grid: number[][]): number =>
      Math.min(
        ...grid.flatMap((row, y) =>
          row.map((c, x) =>
            c >= ITEM_BLIT_OFFSET && c < ITEM_BLIT_OFFSET + 10 &&
            y >= marks.chest.y - 3 && y <= marks.chest.y + 3 ? x : 99,
          ),
        ),
      );
    for (const id of ['might_pendant', 'lucky_coin', 'pyrite_orb']) {
      const item = byId(id)!;
      const loadout = {
        weapon: null,
        armor: null,
        accessory: item.slot === 'accessory' ? item : null,
      };
      const outs = [-1, 0, 1].map((swingX) => applyEquipmentOverlays(base.grid, base.palette, loadout, { swingX }));
      const xs = outs.map((o) => medallion(o.grid));
      expect(xs[2]).toBe(xs[1] + 1);
      expect(xs[0]).toBe(xs[1] - 1);
    }
    // rings are worn, never swinging
    const ring = applyEquipmentOverlays(
      base.grid, base.palette,
      { weapon: null, armor: null, accessory: byId('mystic_ring') },
      { swingX: 1 },
    );
    expect(JSON.stringify(ring.grid)).toBe(
      JSON.stringify(
        applyEquipmentOverlays(base.grid, base.palette, {
          weapon: null, armor: null, accessory: byId('mystic_ring'),
        }).grid,
      ),
    );
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

  it('anchors a shield outboard of the hand, never across the torso', () => {
    const base = generateSprite16('shield-anchor', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('guardian_shield'),
      accessory: null,
    });
    const rows: number[] = [];
    for (let y = 0; y < out.grid.length; y++) {
      if (out.grid[y].some((c) => c === FIELD_INDEX || c === TRIM_INDEX)) rows.push(y);
    }
    expect(rows.length).toBeGreaterThan(4);
    // The shield must not start inside the torso: its leftmost cell has to sit
    // at or before the hand, otherwise it reads as a slab painted on the chest.
    let minX = 99;
    rows.forEach((y) => out.grid[y].forEach((c, x) => {
      if (c === FIELD_INDEX || c === TRIM_INDEX) minX = Math.min(minX, x);
    }));
    expect(minX).toBeLessThanOrEqual(marks.palmL.x);
  });

  it('keeps a hafted weapon continuous: head, shaft and butt below the fist', () => {
    const base = generateSprite16('haft-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const bare = applyEquipmentOverlays(base.grid, base.palette, { weapon: null, armor: null, accessory: null });
    const armed = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: byId('bronze_axe'),
      armor: null,
      accessory: null,
    });
    const added: Array<[number, number]> = [];
    armed.grid.forEach((row, y) => row.forEach((c, x) => {
      if (c !== bare.grid[y][x]) added.push([x, y]);
    }));
    expect(added.length).toBeGreaterThan(12);
    const ys = added.map(([, y]) => y);
    // shaft reaches up to the head ...
    expect(Math.min(...ys)).toBeLessThan(marks.palmR.y - 6);
    // ... and continues below the fist, so the weapon is held not balanced
    expect(Math.max(...ys)).toBeGreaterThan(marks.palmR.y + 1);
    // and it stays attached: no far-flung island detached from the grip
    const nearGrip = added.filter(([x]) => Math.abs(x - marks.palmR.x) <= 8).length;
    expect(nearGrip).toBeGreaterThan(6);
  });

  const LEG_FAMILIES = new Set<number>([
    6, shadeIndexOf(6), highlightIndexOf(6),
    7, shadeIndexOf(7), highlightIndexOf(7),
  ]);

  const hipRowOf = (grid: number[][]): number => {
    for (let y = 30; y < grid.length; y++) {
      const cells = grid[y].filter((c) => c !== 0);
      if (cells.length > 0 && cells.every((c) => LEG_FAMILIES.has(c))) return y;
    }
    return grid.length;
  };

  const isSkinTone = (v: number): boolean =>
    v === 1 || v === shadeIndexOf(1) || v === highlightIndexOf(1);
  const isHairTone = (v: number): boolean =>
    v === 4 || v === shadeIndexOf(4) || v === highlightIndexOf(4);

  it('wears body armour above the hips: every leg and shoe pixel stays intact', () => {
    const seeds: Array<[string, 'male' | 'female']> = [
      ['k3f9qz1a', 'male'],
      ['v7m2xp4c', 'female'],
      ['r8t5wd0b', 'male'],
    ];
    const bodyArmour = ITEM_ASSETS.filter(
      (i) => i.slot === 'armor' && armorVisualKind(i.name) !== 'boots',
    );
    expect(bodyArmour.length).toBeGreaterThan(20);
    for (const [seed, gender] of seeds) {
      const base = generateSprite16(seed, gender);
      const hip = hipRowOf(base.grid);
      expect(hip, `${seed} hip line`).toBeGreaterThanOrEqual(36);
      for (const item of bodyArmour) {
        const out = applyEquipmentOverlays(base.grid, base.palette, {
          weapon: null,
          armor: item,
          accessory: null,
        });
        for (let y = hip; y < base.grid.length; y++) {
          expect(out.grid[y], `${item.id} y${y}`).toEqual(base.grid[y]);
        }
      }
    }
  });

  it('keeps the player skin and hair readable under body armour', () => {
    const seeds: Array<[string, 'male' | 'female']> = [
      ['k3f9qz1a', 'male'],
      ['v7m2xp4c', 'female'],
      ['r8t5wd0b', 'male'],
    ];
    const torsoArmour = ITEM_ASSETS.filter((i) => {
      if (i.slot !== 'armor') return false;
      const kind = armorVisualKind(i.name);
      return kind === 'chest' || kind === 'robe';
    });
    expect(torsoArmour.length).toBeGreaterThan(5);
    for (const [seed, gender] of seeds) {
      const base = generateSprite16(seed, gender);
      for (const item of torsoArmour) {
        const out = applyEquipmentOverlays(base.grid, base.palette, {
          weapon: null,
          armor: item,
          accessory: null,
        });
        let skin = 0;
        let hair = 0;
        for (let y = 0; y < base.grid.length; y++) {
          for (let x = 0; x < base.grid[y].length; x++) {
            const cell = base.grid[y][x];
            if (isSkinTone(cell)) {
              skin++;
              expect(out.grid[y][x], `${item.id} skin ${x},${y}`).toBe(cell);
            } else if (isHairTone(cell)) {
              hair++;
              expect(out.grid[y][x], `${item.id} hair ${x},${y}`).toBe(cell);
            }
          }
        }
        expect(skin, `${item.id} skin pixels`).toBeGreaterThan(20);
        expect(hair, `${item.id} hair pixels`).toBeGreaterThan(10);
      }
    }
  });

  it('layers body armour into trim pauldrons, field plastron and tinted waist band', () => {
    const base = generateSprite16('k3f9qz1a', 'male', { ...STD_MALE });
    const out = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: byId('immortal_vestments'),
      accessory: null,
    });
    const torso = out.grid.slice(25, 36).flat();
    expect(torso.some((c) => c === TRIM_INDEX || c === TRIM_DARK || c === TRIM_LIGHT)).toBe(true);
    expect(torso).toContain(FIELD_INDEX);
    const waist = out.grid.slice(33, 36).flat();
    expect(waist.some((c) => c === TINT2_INDEX || c === TINT2_DARK || c === TINT2_LIGHT)).toBe(true);
    // the tinted band is a torso layer: it never leaks onto the legs
    const legs = out.grid.slice(36).flat();
    expect(legs.some((c) => c === TINT2_INDEX || c === TINT2_DARK || c === TINT2_LIGHT)).toBe(false);
    expect(out.grid.slice(36)).toEqual(base.grid.slice(36));
  });

  it('gives every body armour the same layered waist band, above the legs', () => {
    const base = generateSprite16('r8t5wd0b', 'male', { ...STD_MALE });
    const chestArmour = ITEM_ASSETS.filter(
      (i) => i.slot === 'armor' && armorVisualKind(i.name) === 'chest',
    );
    expect(chestArmour.length).toBeGreaterThan(0);
    for (const item of chestArmour) {
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: item,
        accessory: null,
      });
      const waist = out.grid.slice(33, 36).flat();
      expect(
        waist.some((c) => c === TINT2_INDEX || c === TINT2_DARK || c === TINT2_LIGHT),
        `${item.id} waist band`,
      ).toBe(true);
      expect(out.grid.slice(36), `${item.id} legs`).toEqual(base.grid.slice(36));
    }
  });

  it('keeps pants and shoes intact under every worn accessory', () => {
    const base = generateSprite16('r8t5wd0b', 'male', { ...STD_MALE });
    const hip = hipRowOf(base.grid);
    expect(hip).toBeGreaterThanOrEqual(36);
    const worn = ITEM_ASSETS.filter(
      (i) => i.slot === 'accessory' && accessoryVisualKind(i.name) !== 'boots',
    );
    expect(worn.length).toBeGreaterThan(10);
    for (const item of worn) {
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: item,
      });
      expect(out.grid.slice(hip), `${item.id} legs`).toEqual(base.grid.slice(hip));
    }
  });
});
