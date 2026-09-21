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

  it('generates 3 run frames with moving limbs, same size and palette', () => {
    const frames = generateSpriteFrames('frame-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'run')!;
    expect(frames).toHaveLength(3);
    for (const f of frames) {
      expect(f.grid.length).toBe(42);
      expect(f.width).toBe(SPRITE_WIDTH);
      expect(f.height).toBe(SPRITE_HEIGHT);
      expect(f.palette).toBe(frames[0].palette);
    }
    const [a, b, c] = frames.map((f) => JSON.stringify(f.grid));
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it('generates attack frames for every body type', () => {
    for (const bodyType of ['basic', 'sleeveless', 'armor', 'jacket', 'vest', 'robe', 'hoodie', 'tunic']) {
      const frames = generateSpriteFrames('frame-all', 'female', { bodyType }, 'attack')!;
      expect(frames).toHaveLength(3);
    }
    const run = generateSpriteFrames('frame-kind', 'male', { bodyType: 'basic' }, 'run')!;
    const attack = generateSpriteFrames('frame-kind', 'male', { bodyType: 'basic' }, 'attack')!;
    expect(JSON.stringify(run.map((f) => f.grid))).not.toBe(JSON.stringify(attack.map((f) => f.grid)));
  });
});
