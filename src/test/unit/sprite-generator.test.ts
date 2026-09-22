import { describe, it, expect } from 'vitest';
import { generateSprite16, generateSpriteFrames, resolveSpriteFeatures } from '../../components/sprite/spriteGenerator';
import { SPRITE_HEIGHT, SPRITE_WIDTH, highlightIndexOf, shadeIndexOf } from '../../components/sprite/spriteTypes';

describe('sprite generator v2', () => {
  it('produces a 24x42 grid with transparent hover room on top', () => {
    const sprite = generateSprite16('hero-seed', 'male');
    expect(sprite.width).toBe(SPRITE_WIDTH);
    expect(sprite.height).toBe(SPRITE_HEIGHT);
    expect(sprite.grid.length).toBe(42);
    expect(sprite.grid.every((row) => row.length === 24)).toBe(true);
    expect(sprite.grid.slice(0, 6).flat().every((c) => c === 0)).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const a = generateSprite16('same-seed', 'female');
    const b = generateSprite16('same-seed', 'female');
    expect(a.grid).toEqual(b.grid);
    expect(a.palette).toEqual(b.palette);
  });

  it('varies across seeds', () => {
    const a = JSON.stringify(generateSprite16('seed-a', 'male').grid);
    const b = JSON.stringify(generateSprite16('seed-b', 'male').grid);
    expect(a).not.toBe(b);
  });

  it('only references palette indices that exist', () => {
    const sprite = generateSprite16('palette-check', 'male');
    const known = new Set(Object.keys(sprite.palette).map(Number));
    for (const row of sprite.grid) {
      for (const cell of row) {
        if (cell !== 0) expect(known.has(cell)).toBe(true);
      }
    }
  });

  it('derives a stable build from the seed when appearance has none', () => {
    const a = resolveSpriteFeatures('stable-build', 'male', null);
    const b = resolveSpriteFeatures('stable-build', 'male', null);
    expect(a.build).toBe(b.build);
  });

  it('honours an explicit build override', () => {
    const slim = generateSprite16('build-x', 'male', { build: 'slim' });
    const broad = generateSprite16('build-x', 'male', { build: 'broad' });
    expect(JSON.stringify(slim.grid)).not.toBe(JSON.stringify(broad.grid));
  });

  it('tints silhouette edges, dithers flat zones and shines hair', () => {
    const sprite = generateSprite16('shade-check', 'male');
    const flat = sprite.grid.flat();
    expect(flat.some((c) => c === shadeIndexOf(5) || c === shadeIndexOf(4))).toBe(true);
    expect(flat).toContain(highlightIndexOf(4));
    expect(flat).toContain(highlightIndexOf(5));
    expect(flat).not.toContain(highlightIndexOf(7));
  });

  it('details the face and clothes: ears, nose, brows, collar, folds', () => {
    const sprite = generateSprite16('feature-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    });
    const grid = sprite.grid;
    const eyes: Array<[number, number]> = [];
    grid.forEach((row, y) => row.forEach((c, x) => {
      if (c === 8) eyes.push([x, y]);
    }));
    expect(eyes.length).toBeGreaterThan(0);
    const eyeY = Math.max(...eyes.map(([, y]) => y));
    const faceCx = Math.round(eyes.reduce((a, [x]) => a + x, 0) / eyes.length);
    const row = grid[eyeY];
    const contentXs = row.map((c, x) => (c !== 0 && c !== 1 ? x : -1)).filter((x) => x >= 0);
    const lx = Math.min(...contentXs);
    const rx = Math.max(...contentXs);
    expect(grid[eyeY][lx - 1]).toBe(1);
    expect(grid[eyeY][rx + 1]).toBe(1);
    expect(grid[eyeY + 2][faceCx]).toBe(shadeIndexOf(1));
    const upperY = Math.min(...eyes.map(([, y]) => y));
    const upperXs = [...new Set(eyes.filter(([, y]) => y === upperY).map(([x]) => x))];
    expect(upperXs.length).toBeGreaterThan(0);
    expect(upperXs.every((x) => grid[upperY - 2][x] === shadeIndexOf(4))).toBe(true);
    expect(grid[24].filter((c) => c === 11).length).toBeGreaterThanOrEqual(2);
  });

  it('maps edge tones toward the outline color, not a 3d bevel', () => {
    const sprite = generateSprite16('outline-check', 'female');
    expect(sprite.palette[shadeIndexOf(5)]).not.toBe(sprite.palette[5]);
  });

  it('adds metal pauldrons and a belt buckle on a basic body', () => {
    const sprite = generateSprite16('gear-detail', 'male', { bodyType: 'basic', headType: 'male' });
    const flat = sprite.grid.flat();
    expect(flat).toContain(9);
    expect(sprite.grid[34][11]).toBe(9);
    expect(sprite.grid[34][12]).toBe(9);
  });

  it('shades the torso-facing side of bare arms for volume', () => {
    const sprite = generateSprite16('armvol-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    });
    const zone = sprite.grid.slice(30, 36).flat();
    expect(zone).toContain(shadeIndexOf(1));
    expect(zone).toContain(1);
  });

  it('trims the collar in logo color with pants stripes and shoe laces', () => {
    const sprite = generateSprite16('finesse-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    });
    expect(sprite.grid[24].filter((c) => c === 11).length).toBeGreaterThanOrEqual(2);
    const stripeRows = sprite.grid.slice(36, 40).flat();
    expect(stripeRows).toContain(highlightIndexOf(6));
    expect(sprite.grid[40].slice(0, 24)).toContain(2);
  });

  it('generates a 4-beat run cycle with a shared flight frame', () => {
    const frames = generateSpriteFrames('frame-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'run')!;
    expect(frames).toHaveLength(4);
    for (const f of frames) {
      expect(f.grid.length).toBe(42);
      expect(f.width).toBe(SPRITE_WIDTH);
      expect(f.height).toBe(SPRITE_HEIGHT);
      expect(f.palette).toBe(frames[0].palette);
    }
    const [a, b, c, d] = frames.map((f) => JSON.stringify(f.grid));
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(c).not.toBe(d);
    expect(b).toBe(d);
  });

  it('keeps arms attached every frame: no gaps along the arm columns', () => {
    for (const build of ['slim', 'standard', 'broad'] as const) {
      const frames = generateSpriteFrames('armgap-check', 'male', {
        build,
        bodyType: 'basic',
        headType: 'male',
      }, 'run')!;
      expect(frames).toHaveLength(4);
      for (const f of frames) {
        // arm columns measured per frame (slim/broad shift them)
        const edgeCols = (fromLeft: boolean): number[] => {
          const xs = new Set<number>();
          for (let y = 30; y <= 35; y++) {
            const row = f.grid[y];
            if (fromLeft) {
              const lx = row.findIndex((c) => c !== 0);
              if (lx >= 0) {
                xs.add(lx);
                if (row[lx + 1] !== 0) xs.add(lx + 1);
              }
            } else {
              for (let x = row.length - 1; x >= 0; x--) {
                if (row[x] !== 0) {
                  xs.add(x);
                  if (row[x - 1] !== 0) xs.add(x - 1);
                  break;
                }
              }
            }
          }
          return [...xs].sort((a, b) => a - b).slice(0, 2);
        };
        for (const cols of [edgeCols(true), edgeCols(false)]) {
          expect(cols.length).toBeGreaterThan(0);
          const rows: number[] = [];
          for (let y = 28; y <= 37; y++) {
            if (cols.some((x) => f.grid[y][x] !== 0)) rows.push(y);
          }
          expect(rows.length).toBeGreaterThan(5);
          for (let k = 1; k < rows.length; k++) {
            expect(rows[k] - rows[k - 1]).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('keeps both legs visible on every run frame (no teleporting limbs)', () => {
    for (const build of ['slim', 'standard', 'broad'] as const) {
      const frames = generateSpriteFrames('noteleport-check', 'male', {
        build,
        bodyType: 'basic',
        headType: 'male',
      }, 'run')!;
      expect(frames).toHaveLength(4);
      for (const f of frames) {
        const legZone = f.grid.slice(36, 42);
        const left = legZone.flatMap((row) => row.slice(0, 12)).filter((v) => v !== 0).length;
        const right = legZone.flatMap((row) => row.slice(12, 24)).filter((v) => v !== 0).length;
        expect(left).toBeGreaterThanOrEqual(3);
        expect(right).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('generates attack frames for every body type, fist thrusts, torso fixed', () => {    for (const bodyType of ['basic', 'sleeveless', 'armor', 'jacket', 'vest', 'robe', 'hoodie', 'tunic', 'nope']) {
      const frames = generateSpriteFrames('frame-all', 'female', { bodyType }, 'attack')!;
      expect(frames).toHaveLength(3);
    }
    const frames = generateSpriteFrames('punch-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'attack')!;
    const grids = frames.map((f) => JSON.stringify(f.grid));
    expect(new Set(grids).size).toBe(3);
    // head never moves during a punch; legs match on strike/recover
    // (windup chambers the fist at the hip)
    const head = frames.map((f) => JSON.stringify(f.grid.slice(8, 23)));
    expect(new Set(head).size).toBe(1);
    const legs = frames.map((f) => JSON.stringify(f.grid.slice(36, 42)));
    expect(legs[1]).toBe(legs[2]);
    // fist chambers then thrusts: cell count stable within the extended
    // fist itself (no vanishing limbs)
    const counts = frames.map((f) => f.grid.flat().filter((c) => c !== 0).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(14);
  });
});
