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
  STONE_INDEX,
  STONE_DARK,
  STONE_LIGHT,
  WEAPON_OUTLINE_INDEX,
} from '../../components/sprite/equipOverlays';
import {
  generateSprite16,
  generateSpriteFrames,
  jewelGlint,
  jewelSwing,
  ATTACK_IMPACT_FRAME,
} from '../../components/sprite/spriteGenerator';
import { weaponAngleFor, weaponStrikeAngle } from '../../components/sprite/weaponPoses';
import type { WeaponVisualKind } from '../../components/sprite/equipOverlays';
import { ACCENT_INDEX, TRIM_INDEX, highlightIndexOf, shadeIndexOf } from '../../components/sprite/spriteTypes';
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

/** Un représentant de chaque famille de peintre, pour les tests transverses. */
const WEAPON_KINDS: Array<[string, string]> = [
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

/** Le bijou porté est peint dans la palette du sprite, jamais blitté. */
const isStoneCell = (value: number): boolean =>
  value === STONE_INDEX || value === STONE_DARK || value === STONE_LIGHT;

/** Cellules de la pierre du bijou (gemme, médaillon ou broche). */
const stoneCells = (grid: number[][]): Cell[] => cellsOf(grid, isStoneCell);

const rowCellsAt = (grid: number[][], y: number, accept: (value: number) => boolean): number[] =>
  (grid[y] ?? []).flatMap((value, x) => (accept(value) ? [x] : []));

const rgbOf = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Rangée où commence la chemise du joueur : repère indépendant des repères. */
const SHIRT_VALUES = new Set([5, shadeIndexOf(5), highlightIndexOf(5)]);
const shirtTopRow = (grid: number[][]): number =>
  grid.findIndex(
    (row, y) => y >= 20 && row.some((value) => SHIRT_VALUES.has(value)),
  );

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
    // painted over by the hand. The fist's top row may bite its lower row.
    const guard = cellsOf(out.grid, (v) => v === TRIM_INDEX || v === ACCENT_INDEX || v === BLADE_INDEX)
      .filter(([x, y]) => inBox([x, y], marks.palmR.x - 4, marks.palmR.x + 5, marks.palmR.y - 3, marks.palmR.y - 1));
    expect(guard.length).toBeGreaterThanOrEqual(2);
    // The fist closes over the handle and is never painted over: the wood grip
    // and the pommel show below it instead of across the back of the hand.
    expect(out.grid[marks.palmR.y][marks.palmR.x]).toBe(1);
    expect(out.grid[marks.palmR.y][marks.palmR.x + 1]).toBe(1);
    const grip = cellsOf(out.grid, isWoodCell)
      .filter(([x, y]) => inBox([x, y], marks.palmR.x - 2, marks.palmR.x + 3, marks.palmR.y + 3, marks.palmR.y + 6));
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
      // The hand closes over the handle, so the weapon is read through the
      // column it crosses: shaft, limb or pommel above and below the fist.
      const region = cellsOf(out.grid, (v) => WEAPON_FAMILY.has(v))
        .filter(([x, y]) => inBox([x, y], marks.palmR.x - 3, marks.palmR.x + 3, marks.palmR.y - 6, marks.palmR.y + 6));
      expect(region.length, `${item.id} grip beside fist`).toBeGreaterThan(0);
      expect(out.grid[marks.palmR.y][marks.palmR.x], `${item.id} fist`).not.toBe(0);
    }
  });

  it('keeps weapon pixels behind the body inside the head box across every frame', () => {
    for (const [kind, id] of WEAPON_KINDS) {
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

  it('closes the fist over the handle across every weapon family', () => {
    for (const [kind, id] of WEAPON_KINDS) {
      // Les knuckles sont portés PAR le poing : seule famille qui peint sur
      // la peau. Toutes les autres passent sous la main.
      if (kind === 'fist') continue;
      for (const anim of ['idle', 'run', 'attack', 'hit', 'victory'] as const) {
        const frames = generateSpriteFrames('fist-clear', 'male', { ...STD_MALE }, anim)!;
        for (const [frameIdx, frame] of frames.entries()) {
          const marks = computeLandmarks(frame.grid);
          const out = applyEquipmentOverlays(frame.grid, frame.palette, {
            weapon: byId(id),
            armor: null,
            accessory: null,
          }, { weaponAngle: weaponAngleFor(anim, frameIdx) });
          for (let y = marks.palmR.y - 4; y <= marks.palmR.y + 3; y++) {
            for (let x = marks.palmR.x - 4; x <= marks.palmR.x + 4; x++) {
              const skin = frame.grid[y]?.[x] ?? 0;
              if (skin !== 1 && skin !== shadeIndexOf(1) && skin !== highlightIndexOf(1)) continue;
              expect(
                WEAPON_FAMILY.has(out.grid[y][x]),
                `${kind} ${anim} f${frameIdx} hand ${x},${y}`,
              ).toBe(false);
            }
          }
        }
      }
    }
  });

  it('leaves the handle end visible below the closed fist', () => {
    const base = generateSprite16('butt-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    for (const [kind, id] of WEAPON_KINDS) {
      if (kind === 'fist') continue;
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: byId(id),
        armor: null,
        accessory: null,
      });
      const below = cellsOf(out.grid, (v) => WEAPON_FAMILY.has(v))
        .filter(([x, y]) => inBox([x, y], marks.palmR.x - 3, marks.palmR.x + 3, marks.palmR.y + 3, marks.palmR.y + 7));
      expect(below.length, `${kind} handle below the fist`).toBeGreaterThan(0);
    }
  });

  it('outlines the held weapon on the background only', () => {
    const base = generateSprite16('outline-check', 'male', { ...STD_MALE });
    const body = applyEquipmentOverlays(base.grid, base.palette, {
      weapon: null,
      armor: null,
      accessory: null,
    }, {});
    for (const [kind, id] of WEAPON_KINDS) {
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: byId(id),
        armor: null,
        accessory: null,
      }, {});
      const outline = cellsOf(out.grid, (v) => v === WEAPON_OUTLINE_INDEX);
      expect(outline.length, `${kind} outline`).toBeGreaterThan(0);
      for (const [x, y] of outline) {
        // Le contour découpe la silhouette sur le fond ; posé sur le corps, il
        // ferait croire que l'arme est devant la main qui la tient.
        expect(body.grid[y][x], `${kind} outline over body ${x},${y}`).toBe(0);
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
    // The fist covers the middle of the string (it is on the grip column):
    // the cord is read above and below the hand instead of through it.
    expect(strings.length).toBeGreaterThanOrEqual(3);
    expect(strings.some(([, y]) => y <= marks.palmR.y - 3), 'string above the fist').toBe(true);
    expect(strings.some(([, y]) => y >= marks.palmR.y + 3), 'string below the fist').toBe(true);
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
      cellsOf(out.grid, isWoodCell).filter(([, y]) => y > marks.palmR.y + 2 && y <= marks.palmR.y + 6).length,
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
      cellsOf(staff.grid, isWoodCell).some(([, y]) => y > marks.palmR.y + 2 && y <= marks.palmR.y + 6),
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
      cellsOf(out.grid, isWoodCell).some(([, y]) => y > marks.palmR.y + 2 && y <= marks.palmR.y + 6),
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
    // the clasp sits on the plastron, centred on the bust (the pendant hangs
    // over it), not on the face which is offset in the 3/4 pose
    const clasp = cellsOf(golem.grid, (v) => v === ACCENT_INDEX);
    expect(clasp.length).toBeGreaterThan(0);
    for (const [x, y] of clasp) {
      expect(y).toBeGreaterThanOrEqual(marks.chest.y);
      expect(y).toBeLessThanOrEqual(marks.chest.y + 2);
      expect(Math.abs(x - marks.chest.x)).toBeLessThanOrEqual(1.5);
    }
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

  it('hangs necklaces as a chain U and a stone centred on the bust', () => {
    const base = generateSprite16('neck-check', 'female', { ...STD_FEMALE });
    const marks = computeLandmarks(base.grid);
    const cx = Math.round(marks.neck.x);
    for (const id of ['might_pendant', 'storm_amulet']) {
      expect(accessoryVisualKind(byId(id)!.name)).toBe('necklace');
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      });
      // gemme de trois pixels de large, quatre de haut, pendue sous le col
      const cells = stoneCells(out.grid);
      expect(cells.length).toBe(10);
      expect(Math.min(...cells.map(([, y]) => y))).toBe(marks.neck.y + 3);
      expect(Math.max(...cells.map(([, y]) => y))).toBe(marks.neck.y + 6);
      for (const [x] of cells) expect(Math.abs(x - marks.neck.x)).toBeLessThanOrEqual(1.5);
      // la chaîne remonte des deux côtés du cou puis s'affaisse sur le col
      const clasps = rowCellsAt(out.grid, marks.neck.y + 1, (v) => v === TRIM_INDEX).filter(
        (x) => Math.abs(x - cx) <= 3,
      );
      expect(clasps).toEqual([cx - 2, cx + 2]);
      const sag = rowCellsAt(out.grid, marks.neck.y + 2, (v) => v === TRIM_DARK).filter(
        (x) => Math.abs(x - cx) <= 3,
      );
      expect(sag).toContain(cx);
      expect(sag.length).toBeGreaterThanOrEqual(3);
      // l'icône d'inventaire (8×8) n'est plus collée sur le buste
      expect(blitCells(out.grid).filter(([, y]) => y >= 22 && y <= 32)).toEqual([]);
    }
    // deux bijoux de teintes différentes ne partagent pas la même pierre
    const stoneOf = (id: string): string =>
      applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      }).palette[STONE_INDEX];
    expect(stoneOf('might_pendant')).not.toBe(stoneOf('storm_amulet'));
  });

  it('pins brooches flush on the collar, without a chain', () => {
    const base = generateSprite16('brooch-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    for (const id of ['lucky_coin', 'cosmic_seal']) {
      expect(accessoryVisualKind(byId(id)!.name)).toBe('brooch');
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      });
      // médaillon rond posé au bord du col : trois pixels de large, trois de haut
      const cells = stoneCells(out.grid);
      expect(cells.length).toBe(9);
      expect(Math.min(...cells.map(([, y]) => y))).toBe(marks.neck.y + 1);
      expect(Math.max(...cells.map(([, y]) => y))).toBe(marks.neck.y + 3);
      for (const [x] of cells) expect(Math.abs(x - marks.neck.x)).toBeLessThanOrEqual(1.5);
      // épinglée, elle ne pend pas : aucune chaîne à l'écran
      expect(out.grid.flat().filter((v) => v === TRIM_INDEX || v === TRIM_DARK)).toEqual([]);
    }
  });

  it('hangs orbs as a round medallion on the same chain', () => {
    const base = generateSprite16('orb-check', 'female', { ...STD_FEMALE });
    const marks = computeLandmarks(base.grid);
    const cx = Math.round(marks.neck.x);
    for (const id of ['spirit_orb', 'tsunami_orb', 'pyrite_orb']) {
      expect(accessoryVisualKind(byId(id)!.name)).toBe('orb');
      const out = applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      });
      // médaillon rond de trois pixels : une rangée de moins que la gemme
      const cells = stoneCells(out.grid);
      expect(cells.length).toBe(9);
      expect(Math.min(...cells.map(([, y]) => y))).toBe(marks.neck.y + 3);
      expect(Math.max(...cells.map(([, y]) => y))).toBe(marks.neck.y + 5);
      for (const [x] of cells) expect(Math.abs(x - marks.neck.x)).toBeLessThanOrEqual(1.5);
      const chain = out.grid
        .slice(marks.neck.y + 1, marks.neck.y + 3)
        .map((row) => row[cx]);
      expect(chain.length).toBe(2);
      expect(chain.some((v) => v === TRIM_INDEX || v === TRIM_DARK)).toBe(true);
    }
    // deux orbes de teintes différentes ne partagent pas la même pierre
    const stoneOf = (id: string): string =>
      applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      }).palette[STONE_INDEX];
    expect(stoneOf('obsidian_idol')).not.toBe(stoneOf('spirit_orb'));
  });

  it('anchors every suspended accessory under the shoulder line, always on the body', () => {
    const seeds: Array<[string, 'male' | 'female']> = [
      ['k3f9qz1a', 'male'],
      ['v7m2xp4c', 'female'],
    ];
    const builds = ['slim', 'standard', 'broad'] as const;
    const suspended = ITEM_ASSETS.filter((i) => {
      if (i.slot !== 'accessory') return false;
      const kind = accessoryVisualKind(i.name);
      return kind === 'necklace' || kind === 'orb' || kind === 'brooch';
    });
    expect(suspended.length).toBeGreaterThan(10);
    for (const [seed, gender] of seeds) {
      for (const build of builds) {
        const base = generateSprite16(seed, gender, { build, bodyType: 'basic', headType: gender });
        const marks = computeLandmarks(base.grid);
        const cx = Math.round(marks.neck.x);
        for (const item of suspended) {
          const kind = accessoryVisualKind(item.name);
          const out = applyEquipmentOverlays(base.grid, base.palette, {
            weapon: null,
            armor: null,
            accessory: item,
          });
          const cells = stoneCells(out.grid);
          const top = marks.neck.y + (kind === 'brooch' ? 1 : 3);
          expect(Math.min(...cells.map(([, y]) => y)), `${item.id} ${build} top`).toBe(top);
          for (const [x, y] of cells) {
            // un bijou est porté : il ne peint jamais de pixel dans le vide
            expect(base.grid[y][x], `${item.id} ${build} floats at ${x},${y}`).not.toBe(0);
            expect(Math.abs(x - marks.neck.x), `${item.id} ${build} off-centre`).toBeLessThanOrEqual(1.5);
          }
          if (kind !== 'brooch') {
            // les deux attaches de la chaîne reposent sur le col, pas dans l'air
            expect(
              rowCellsAt(out.grid, marks.neck.y + 1, (v) => v === TRIM_INDEX).filter(
                (x) => Math.abs(x - cx) <= 3,
              ),
              `${item.id} ${build} chain`,
            ).toHaveLength(2);
          }
        }
      }
    }
  });

  it('welds the pendant to the bust through the whole breathing loop', () => {
    for (const build of ['slim', 'standard', 'broad'] as const) {
      const frames = generateSpriteFrames('breath-check', 'male', { ...STD_MALE, build }, 'idle')!;
      expect(frames.length).toBeGreaterThanOrEqual(10);
      const offsets = new Set<number>();
      for (const frame of frames) {
        const out = applyEquipmentOverlays(frame.grid, frame.palette, {
          weapon: null,
          armor: null,
          accessory: byId('crystal_pendant'),
        });
        const stoneTop = Math.min(...stoneCells(out.grid).map(([, y]) => y));
        const bustTop = shirtTopRow(frame.grid);
        expect(bustTop, `${build} bust row`).toBeGreaterThan(19);
        offsets.add(stoneTop - bustTop);
      }
      // le buste monte de deux pixels à l'inspiration : la pierre monte avec lui
      // au lieu de glisser le long du torse
      expect([...offsets], build).toEqual([3]);
    }
  });

  it('glints the stone at the breath peak without lighting a stray pixel', () => {
    const base = generateSprite16('glint-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const cx = Math.round(marks.neck.x);
    const loadout = { weapon: null, armor: null, accessory: byId('crystal_pendant') };
    const plain = applyEquipmentOverlays(base.grid, base.palette, loadout, { glint: false });
    const lit = applyEquipmentOverlays(base.grid, base.palette, loadout, { glint: true });
    const whiteCells = (grid: number[][]): Cell[] => cellsOf(grid, (v) => v === 2);
    expect(whiteCells(lit.grid).length).toBe(whiteCells(plain.grid).length + 1);
    // le reflet tombe sur la facette de la pierre, pas à côté
    expect(plain.grid[marks.neck.y + 4][cx]).toBe(STONE_LIGHT);
    expect(lit.grid[marks.neck.y + 4][cx]).toBe(2);
  });

  it('colours the stone from the item, never from the rarity trim', () => {
    const base = generateSprite16('stone-check', 'male', { ...STD_MALE });
    const stoneOf = (id: string): string =>
      applyEquipmentOverlays(base.grid, base.palette, {
        weapon: null,
        armor: null,
        accessory: byId(id),
      }).palette[STONE_INDEX];
    // amulette de vie : icône verte, chaîne « rare » bleue → pierre verte
    const [lifeR, lifeG, lifeB] = rgbOf(stoneOf('life_amulet'));
    expect(lifeG).toBeGreaterThan(lifeR);
    expect(lifeG).toBeGreaterThan(lifeB);
    // pendentif de cristal : icône bleue, chaîne « épique » magenta → pierre bleue
    const [crystalR, crystalG, crystalB] = rgbOf(stoneOf('crystal_pendant'));
    expect(crystalB).toBeGreaterThan(crystalR);
    expect(crystalB).toBeGreaterThan(crystalG);
  });

  it('keeps the jewel on the body in every animation frame', () => {
    const accessory = byId('crystal_pendant');
    for (const kind of ['idle', 'run', 'attack', 'hit', 'victory'] as const) {
      const frames = generateSpriteFrames('anim-check', 'male', { ...STD_MALE }, kind)!;
      expect(frames.length, kind).toBeGreaterThan(0);
      frames.forEach((frame, frameIdx) => {
        const out = applyEquipmentOverlays(
          frame.grid,
          frame.palette,
          { weapon: null, armor: null, accessory },
          { swingX: jewelSwing(kind, frameIdx), glint: jewelGlint(kind, frameIdx) },
        );
        const cells = stoneCells(out.grid);
        // l'éclat remplace une cellule de la pierre par du blanc, il n'en ajoute pas
        expect(cells.length, `${kind}${frameIdx} stone`).toBe(
          jewelGlint(kind, frameIdx) ? 9 : 10,
        );
        for (const [x, y] of cells) {
          // un bijou porté remplace un pixel du corps : il ne flotte jamais
          expect(frame.grid[y][x], `${kind}${frameIdx} floats at ${x},${y}`).not.toBe(0);
        }
        // et il ne détache jamais un morceau du personnage
        expect(nonZeroComponents(out.grid).length, `${kind}${frameIdx} islands`).toBe(
          nonZeroComponents(frame.grid).length,
        );
      });
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
    expect(impact).toBe(ATTACK_IMPACT_FRAME);
    const dagger = byId('flame_dagger')!;
    const kind = weaponVisualKind(dagger);
    // En jeu (SpriteCanvas), seule la frame d'impact prend l'amplitude mesurée
    // pour la famille ; les autres suivent la courbe nominale.
    const angles = frames.map((_, i) => (i === impact ? weaponStrikeAngle(kind) : weaponAngleFor('attack', i)));
    const maxWeaponX = (f: (typeof frames)[number], angle: number): number => {
      const out = applyEquipmentOverlays(
        f.grid,
        f.palette,
        { weapon: dagger, armor: null, accessory: null },
        { weaponAngle: angle },
      ).grid;
      const bare = applyEquipmentOverlays(f.grid, f.palette, { weapon: null, armor: null, accessory: null }).grid;
      let max = -1;
      for (let y = 0; y < out.length; y++) {
        for (let x = 0; x < out[y].length; x++) {
          const v = out[y][x];
          if (v === 0 || v === WEAPON_OUTLINE_INDEX || v === bare[y][x]) continue;
          max = Math.max(max, x);
        }
      }
      return max;
    };
    const tips = frames.map((f, i) => maxWeaponX(f, angles[i]));
    // La lame recule à l'armé puis balaie jusqu'au bord de la grille : c'est
    // cette course de pointe (et pas l'allonge du poing, limitée à 2 px) qui
    // rend la frappe lisible.
    expect(tips[impact]).toBeGreaterThanOrEqual(tips[anticipation] + 4);
    expect(tips[impact]).toBe(Math.max(...tips));
  });

  it("garde chaque famille d'arme dans la grille pendant la frappe", () => {
    const frames = generateSpriteFrames('strike-grid', 'male', { ...STD_MALE }, 'attack')!;
    const impact = ATTACK_IMPACT_FRAME;
    // Grille élargie de 36 colonnes : en jeu (24 px) les cellules au-delà de
    // la 23e n'existent pas — l'arme serait coupée net.
    const WIDE = 60;
    const reps = new Map<WeaponVisualKind, string>();
    for (const item of ITEM_ASSETS) {
      const kind = weaponVisualKind(item);
      if (kind !== 'fist' && !reps.has(kind)) reps.set(kind, item.id);
    }
    expect(reps.size).toBeGreaterThanOrEqual(8);
    const problems: string[] = [];
    for (const [kind, itemId] of reps) {
      const item = byId(itemId)!;
      const strike = weaponStrikeAngle(kind);
      const maxX = (frameIdx: number, angle: number): number => {
        const f = frames[frameIdx];
        const wide = f.grid.map((row) => [...row, ...Array(WIDE - row.length).fill(0)]);
        const opts = { weaponAngle: angle };
        const out = applyEquipmentOverlays(wide.map((r) => r.slice()), f.palette, { weapon: item, armor: null, accessory: null }, opts).grid;
        const bare = applyEquipmentOverlays(wide.map((r) => r.slice()), f.palette, { weapon: null, armor: null, accessory: null }, {}).grid;
        let max = -1;
        for (let y = 0; y < out.length; y++) {
          for (let x = 0; x < out[y].length; x++) {
            const v = out[y][x];
            if (v === 0 || v === WEAPON_OUTLINE_INDEX || v === bare[y][x]) continue;
            max = Math.max(max, x);
          }
        }
        return max;
      };
      // L'arme doit rester dans la grille à TOUTES les frames d'attaque...
      for (let i = 0; i < frames.length; i++) {
        const angle = i === impact ? strike : weaponAngleFor('attack', i);
        const x = maxX(i, angle);
        // ...avec une seule exception : la corde de l'arc est large de 6 px et
        // l'allonge du poing lui coûte son dernier pixel (aucun angle ne le
        // récupère, mesuré).
        const budget = kind === 'bow' ? 24 : 23;
        if (x > budget) problems.push(`${kind} frame ${i} : arme jusqu'à x${x} (budget ${budget})`);
      }
      // ...et balayer vraiment : ≥ 3 px de course sur le bord droit entre la
      // chambre et l'impact (2 px pour l'arc, physiquement plus large).
      const chamber = Math.min(maxX(1, weaponAngleFor('attack', 1)), maxX(2, weaponAngleFor('attack', 2)));
      const travel = maxX(impact, strike) - chamber;
      const minTravel = kind === 'bow' ? 2 : 3;
      if (travel < minTravel) problems.push(`${kind} : frappe de ${travel} px (attendu ≥ ${minTravel})`);
    }
    expect(problems).toEqual([]);
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

  it('sways the held weapon with the stride without losing cells', () => {
    const base = generateSprite16('sway-check', 'male', { ...STD_MALE });
    const marks = computeLandmarks(base.grid);
    const loadout = { weapon: byId('flame_dagger'), armor: null, accessory: null };
    const outs = [-1, 0, 1].map((swayX) =>
      applyEquipmentOverlays(base.grid, base.palette, loadout, { swayX }),
    );
    const isBlade = (c: number): boolean => c === BLADE_INDEX || c === BLADE_DARK || c === BLADE_LIGHT;
    const bladeMax = outs.map(
      (o) =>
        Math.max(
          ...o.grid.flatMap((row) =>
            row.map((c, x) => (isBlade(c) ? x : -1)),
          ),
        ),
    );
    expect(bladeMax[2]).toBe(bladeMax[1] + 1);
    expect(bladeMax[0]).toBe(bladeMax[1] - 1);
    // The blade translates rigidly with the stride. The closed fist only ever
    // clips the hilt-side row, so the cells above the hand keep the exact same
    // count on all three sway frames.
    const aboveHand = outs.map((o) =>
      o.grid.reduce(
        (n, row, y) => (y <= marks.palmR.y - 3 ? n + row.filter(isBlade).length : n),
        0,
      ),
    );
    expect(aboveHand[1]).toBe(aboveHand[0]);
    expect(aboveHand[2]).toBe(aboveHand[0]);
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
    for (const id of ['might_pendant', 'pyrite_orb']) {
      const loadout = { weapon: null, armor: null, accessory: byId(id) };
      const outs = [-1, 0, 1].map((swingX) => applyEquipmentOverlays(base.grid, base.palette, loadout, { swingX }));
      const xs = outs.map((o) => Math.min(...stoneCells(o.grid).map(([x]) => x)));
      expect(xs[2]).toBe(xs[1] + 1);
      expect(xs[0]).toBe(xs[1] - 1);
      // la chaîne ne balaie pas : seule la pierre oscille sous son creux
      const chainMask = (grid: number[][]): string =>
        JSON.stringify(grid.map((row) => row.map((v) => (v === TRIM_INDEX || v === TRIM_DARK ? v : 0))));
      expect(chainMask(outs[0].grid)).toBe(chainMask(outs[2].grid));
      expect(chainMask(outs[1].grid)).toBe(chainMask(outs[2].grid));
    }
    // une broche est épinglée : elle ne bouge pas d'un pixel
    const brooch = (swingX: number): string =>
      JSON.stringify(
        applyEquipmentOverlays(
          base.grid, base.palette,
          { weapon: null, armor: null, accessory: byId('lucky_coin') },
          { swingX },
        ).grid,
      );
    expect(brooch(1)).toBe(brooch(0));
    expect(brooch(-1)).toBe(brooch(0));
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
