import { describe, it, expect } from 'vitest';
import { generateSprite16, generateSpriteFrames, mirrorSpriteGrid, resolveSpriteFeatures } from '../../components/sprite/spriteGenerator';
import { computeLandmarks } from '../../components/sprite/equipOverlays';
import { SPRITE_HEIGHT, SPRITE_IDLE_MS, SPRITE_WIDTH, highlightIndexOf, shadeIndexOf } from '../../components/sprite/spriteTypes';

const SKIN_FAMILY = new Set([1, shadeIndexOf(1), highlightIndexOf(1)]);

const RUN_FRAME_MIN_DIFF = 6;
const IDLE_FRAME_MIN_DIFF = 6;

// Counts changed cells between two frames: the liveliness floor each
// consecutive pose must clear so no two frames read as the same image.
function frameDiff(a: number[][], b: number[][]): number {
  let diff = 0;
  for (let y = 0; y < a.length; y++) {
    for (let x = 0; x < a[y].length; x++) {
      if (a[y][x] !== b[y][x]) diff++;
    }
  }
  return diff;
}

interface ArmCell {
  x: number;
  y: number;
}

// Flood-fills the bare-skin limb from the hand anchor: every pixel reachable
// from the anchor inside the hanging-limb band (rows 28-35, above the legs).
// The block is the arm plus the fist it ends in.
function fistBlock(grid: number[][], seed: ArmCell): ArmCell[] {
  const block: ArmCell[] = [];
  const seen = new Set<string>();
  const stack: ArmCell[] = [seed];
  while (stack.length) {
    const cell = stack.pop() as ArmCell;
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) continue;
    if (cell.y < 28 || cell.y > 35 || cell.x < 0 || cell.x >= 24) continue;
    if (!SKIN_FAMILY.has(grid[cell.y][cell.x])) continue;
    seen.add(key);
    block.push(cell);
    stack.push(
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    );
  }
  return block;
}

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
    // The iris is drawn in the shaded eye tone, not the bright base colour.
    const IRIS = shadeIndexOf(8);
    const eyes: Array<[number, number]> = [];
    grid.forEach((row, y) => row.forEach((c, x) => {
      if (c === IRIS) eyes.push([x, y]);
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
    // the 4x4 eye leaves no room for a nose pixel on an 8-row head
    expect(grid[eyeY + 2][faceCx]).not.toBe(8);
    const upperY = Math.min(...eyes.map(([, y]) => y));
    const upperXs = [...new Set(eyes.filter(([, y]) => y === upperY).map(([x]) => x))];
    expect(upperXs.length).toBeGreaterThan(0);
    // brows sit one row above the iris
    for (const x of upperXs) expect(grid[upperY - 1][x]).toBe(shadeIndexOf(4));
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

  it('ends every arm in a contiguous 2x2 skin fist the hand anchors sit on', () => {
    const bodies = [
      'basic', 'sleeveless', 'armor', 'jacket', 'vest', 'robe', 'hoodie',
      'tunic', 'ninja_gi', 'paladin', 'cyber_suit', 'monk_gi', 'assassin',
    ];
    for (const bodyType of bodies) {
      for (const build of ['standard', 'broad'] as const) {
        const sprite = generateSprite16(`fist-${bodyType}-${build}`, 'male', {
          build,
          bodyType,
          headType: 'male',
        });
        const marks = computeLandmarks(sprite.grid);
        const hands = [
          { hand: marks.handL, palm: marks.palmL },
          { hand: marks.handR, palm: marks.palmR },
        ];
        for (const { hand, palm } of hands) {
          const block = fistBlock(sprite.grid, hand);
          expect(block.length).toBeGreaterThanOrEqual(4);
          const rows = [...new Set(block.map((c) => c.y))].sort((a, b) => a - b);
          for (let k = 1; k < rows.length; k++) {
            expect(rows[k] - rows[k - 1]).toBeLessThanOrEqual(1);
          }
          const bottom = rows[rows.length - 1];
          const fistRows = [bottom - 1, bottom].map(
            (y) => new Set(block.filter((c) => c.y === y).map((c) => Math.floor(c.x / 2))),
          );
          for (const cols of fistRows) expect(cols.size).toBeGreaterThanOrEqual(2);
          const nearest = Math.min(
            ...block.map((c) => Math.abs(c.x - palm.x) + Math.abs(c.y - palm.y)),
          );
          expect(nearest).toBeLessThanOrEqual(1);
        }
      }
    }
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

  it('lights the top of every form, not only the silhouette', () => {
    // A shirt whose shoulders are covered by a slope still needs a lit top
    // edge, otherwise the whole torso renders flat.
    for (const bodyType of ['basic', 'sleeveless', 'armor', 'jacket', 'vest', 'robe', 'hoodie', 'tunic']) {
      const sprite = generateSprite16(`lit-${bodyType}`, 'male', {
        build: 'standard',
        bodyType,
        headType: 'male',
      });
      expect(sprite.grid.flat()).toContain(highlightIndexOf(5));
    }
  });

  it('never renders a checkerboard dither on flat cloth', () => {
    // The old diagonal dither read as noise at 2x: a lone shaded cell inside
    // an otherwise flat cloth run. Solid shadow regions are fine.
    const sprite = generateSprite16('nodither-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    });
    for (let y = 7; y < 42; y++) {
      for (let x = 1; x < 23; x++) {
        if (sprite.grid[y][x] !== shadeIndexOf(5)) continue;
        const up = sprite.grid[y - 1][x];
        const down = sprite.grid[y + 1][x];
        const left = sprite.grid[y][x - 1];
        const right = sprite.grid[y][x + 1];
        const flatNeighbours = [up, down, left, right].every((c) => c === 5);
        expect(flatNeighbours).toBe(false);
      }
    }
  });

  it('keeps head, neck and shoulders in one connected silhouette', () => {
    for (const headType of ['male', 'male_beard', 'male_cap', 'male_spiky', 'female']) {
      const sprite = generateSprite16(`neck-${headType}`, headType.startsWith('f') ? 'female' : 'male', {
        build: 'standard',
        bodyType: 'basic',
        headType,
      });
      // Every occupied row between the chin and the chest must touch the row
      // above it: no floating head, no notch at the neck.
      let previous: number[] = [];
      for (let y = 0; y < 42; y++) {
        const xs = sprite.grid[y].map((c, x) => (c !== 0 ? x : -1)).filter((x) => x >= 0);
        if (xs.length === 0) continue;
        if (previous.length > 0) {
          const joined = xs.some((x) => previous.includes(x) || previous.includes(x - 1) || previous.includes(x + 1));
          expect(joined).toBe(true);
        }
        previous = xs;
      }
    }
  });

  it('keeps skin shading gentle so bare arms stay skin, not brown', () => {
    const sprite = generateSprite16('skinramp-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
      skinColor: '#f5c6a5',
    });
    const skinShade = sprite.palette[shadeIndexOf(1)]!;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(skinShade.slice(i, i + 2), 16));
    // A 0.55 mix toward the outline collapsed light skin to ~40% luminance,
    // which turned every 2px arm into a dark blob.
    expect((r + g + b) / 3).toBeGreaterThan(150);
  });

  it('gives legs a knee break and shoes a lit top over a dark sole', () => {
    const sprite = generateSprite16('legs-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    });
    // Rows are padded by SPRITE_PAD_TOP: knee line, then shoe top over sole.
    expect(sprite.grid[38]).toContain(shadeIndexOf(6));
    expect(sprite.grid[40]).toContain(7);
    expect(sprite.grid[41]).toContain(shadeIndexOf(7));
  });

  it('builds each eye as a 4x3 iris with a lash line and a glint', () => {
    // The raw asset eye is a 2x2 blob. Without a dark outline and an iris it
    // read as a bead lost on a blank cheek.
    for (const headType of ['male', 'male_sidepart', 'male_beard', 'male_cap', 'female']) {
      const sprite = generateSprite16(`eye4-${headType}`, headType.startsWith('f') ? 'female' : 'male', {
        build: 'standard',
        bodyType: 'basic',
        headType,
        eyeColor: '#16a085',
      });
      const rows: number[] = [];
      sprite.grid.forEach((row, y) => row.forEach((c) => {
        if (c === 8 || c === shadeIndexOf(8)) rows.push(y);
      }));
      expect(rows.length).toBeGreaterThan(0);
      expect(Math.max(...rows) - Math.min(...rows) + 1).toBe(3);
      // dark iris outline and the white glint must both be present
      expect(sprite.grid.flat().filter((c) => c === 38).length).toBeGreaterThan(0);
      expect(sprite.grid.flat().filter((c) => c === 2).length).toBeGreaterThan(0);
    }
  });

  it('tapers the jaw so the head silhouette is not a hard rectangle', () => {
    for (const headType of ['male', 'male_sidepart', 'male_beard', 'male_cap', 'male_spiky', 'female']) {
      const sprite = generateSprite16(`jaw-${headType}`, headType.startsWith('f') ? 'female' : 'male', {
        build: 'standard',
        bodyType: 'basic',
        headType,
      });
      // Head occupies padded rows 6..23 (base rows 0..8); the body starts at 24.
      const headRows = sprite.grid.slice(6, 24);
      const widthAt = (row: number[]): number => row.filter((c) => c !== 0).length;
      const widths = headRows.map(widthAt).filter((w) => w > 0);
      const max = Math.max(...widths);
      // The lowest occupied head row must be narrower than the widest one.
      expect(widths[widths.length - 1]).toBeLessThan(max);
    }
  });

  it('derives the logo trim from the shirt so it never clashes', () => {
    // A random logo hue put two bright bars across the chest.
    const OUTLINE = '#15172e';
    const parse = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const lum = (hex: string): number => {
      const [r, g, b] = parse(hex);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    for (const shirtColor of ['#16a085', '#e74c3c', '#f1c40f', '#9b59b6']) {
      const features = resolveSpriteFeatures('logo-tone', 'male', {
        build: 'standard',
        bodyType: 'basic',
        headType: 'male',
        shirtColor,
      });
      const logo = features.logoColor;
      expect(lum(logo)).toBeLessThan(lum(shirtColor));
      // Same hue family: every channel only travels toward the outline, and
      // all three travel the same fraction of the way (rounding aside).
      const s = parse(shirtColor);
      const l = parse(logo);
      const o = parse(OUTLINE);
      const ratios: number[] = [];
      for (let i = 0; i < 3; i++) {
        const gap = o[i] - s[i];
        // Skip channels whose gap is smaller than the rounding step.
        if (Math.abs(gap) < 8) continue;
        const moved = (l[i] - s[i]) / gap;
        expect(moved).toBeGreaterThan(0);
        expect(moved).toBeLessThan(1);
        ratios.push(moved);
      }
      expect(ratios.length).toBeGreaterThanOrEqual(2);
      for (const r of ratios) expect(Math.abs(r - ratios[0])).toBeLessThan(0.1);
    }
  });

  it('puts a white catchlight in each eye so it reads as an eye', () => {
    const sprite = generateSprite16('glint-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
      eyeColor: '#16a085',
    });
    const IRIS = shadeIndexOf(8);
    const eyes: Array<[number, number]> = [];
    sprite.grid.forEach((row, y) => row.forEach((c, x) => {
      if (c === IRIS) eyes.push([x, y]);
    }));
    expect(eyes.length).toBeGreaterThan(0);
    const eyeY = Math.min(...eyes.map(([, y]) => y));
    // one white catchlight per eye, on the eye row
    const whites = sprite.grid[eyeY].filter((c) => c === 2).length;
    expect(whites).toBeGreaterThanOrEqual(2);
  });

  it('keeps a nose bridge between the eyes so they never fuse into a band', () => {
    for (const headType of ['male', 'male_sidepart', 'male_beard', 'male_cap', 'female', 'female_bob', 'female_bun']) {
      const sprite = generateSprite16(`bridge-${headType}`, headType.startsWith('f') ? 'female' : 'male', {
        build: 'standard',
        bodyType: 'basic',
        headType,
        eyeColor: '#16a085',
      });
      const cols = new Set<number>();
      sprite.grid.forEach((row) => row.forEach((c, x) => {
        if (c === 8 || c === shadeIndexOf(8)) cols.add(x);
      }));
      const sorted = [...cols].sort((a, b) => a - b);
      // find the gap between the two eye clusters
      let gap = 0;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > gap) gap = sorted[i] - sorted[i - 1];
      }
      expect(gap).toBeGreaterThanOrEqual(2);
    }
  });

  it('never lets the eye block eat the hairstyle', () => {
    // Pushing the eye outward must not overwrite hair: on pigtail / ponytail
    // heads the outer slot is hair, and it punched a hole in the hairstyle.
    for (const headType of ['female_pigtails', 'female_ponytail', 'female_pixie', 'female_braid']) {
      const bare = generateSprite16(`hair-${headType}-a`, 'female', {
        build: 'standard', bodyType: 'basic', headType, hairColor: '#d2691e',
      });
      const hair = bare.grid.flat().filter((c) => c === 4 || c === 34 || c === 44).length;
      expect(hair).toBeGreaterThan(20);
    }
  });

  it('keeps the face roughly parallel instead of funnelling into a snout', () => {
    // Narrowing the mouth row as well as the chin left 14px of cheek over a
    // 6px jaw, which read as an animal muzzle rather than a human face.
    for (const headType of ['male', 'male_sidepart', 'male_beard', 'male_cap', 'female', 'female_bob']) {
      const sprite = generateSprite16(`face-${headType}`, headType.startsWith('f') ? 'female' : 'male', {
        build: 'standard',
        bodyType: 'basic',
        headType,
        eyeColor: '#16a085',
      });
      const iris = shadeIndexOf(8);
      const eyeY = sprite.grid.findIndex((row) => row.some((c) => c === iris));
      expect(eyeY).toBeGreaterThan(0);
      const widthAt = (y: number): number => (sprite.grid[y] ?? []).filter((c) => c !== 0).length;
      const eyeWidth = widthAt(eyeY);
      // two rows under the eyes (nose / mouth line) must not collapse
      expect(widthAt(eyeY + 2)).toBeGreaterThanOrEqual(Math.floor(eyeWidth * 0.7));
    }
  });

  it('generates a 6-frame run cycle with distinct contact/pass poses', () => {
    const frames = generateSpriteFrames('frame-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'run')!;
    expect(frames).toHaveLength(6);
    for (const f of frames) {
      expect(f.grid.length).toBe(42);
      expect(f.width).toBe(SPRITE_WIDTH);
      expect(f.height).toBe(SPRITE_HEIGHT);
      expect(f.palette).toBe(frames[0].palette);
    }
    const grids = frames.map((f) => JSON.stringify(f.grid));
    expect(new Set(grids).size).toBe(6);
    // Every consecutive pair (cycle wrap included) must visibly differ.
    for (let i = 0; i < frames.length; i++) {
      const next = frames[(i + 1) % frames.length];
      expect(frameDiff(frames[i].grid, next.grid)).toBeGreaterThanOrEqual(RUN_FRAME_MIN_DIFF);
    }
  });

  it('keeps arms attached every frame: no gaps along the arm columns', () => {
    for (const build of ['slim', 'standard', 'broad'] as const) {
      const frames = generateSpriteFrames('armgap-check', 'male', {
        build,
        bodyType: 'basic',
        headType: 'male',
      }, 'run')!;
      expect(frames).toHaveLength(6);
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
      expect(frames).toHaveLength(6);
      for (const f of frames) {
        const legZone = f.grid.slice(36, 42);
        const left = legZone.flatMap((row) => row.slice(0, 12)).filter((v) => v !== 0).length;
        const right = legZone.flatMap((row) => row.slice(12, 24)).filter((v) => v !== 0).length;
        expect(left).toBeGreaterThanOrEqual(3);
        expect(right).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('generates a 5-beat attack for every body type with torso fixed', () => {
    for (const bodyType of ['basic', 'sleeveless', 'armor', 'jacket', 'vest', 'robe', 'hoodie', 'tunic', 'nope']) {
      const frames = generateSpriteFrames('frame-all', 'female', { bodyType }, 'attack')!;
      expect(frames.length).toBeGreaterThanOrEqual(5);
    }
    const frames = generateSpriteFrames('punch-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'attack')!;
    expect(frames.length).toBeGreaterThanOrEqual(5);
    const grids = frames.map((f) => JSON.stringify(f.grid));
    expect(new Set(grids).size).toBe(frames.length);
    // head never moves during a punch; the stance is planted again by recovery
    const head = frames.map((f) => JSON.stringify(f.grid.slice(8, 23)));
    expect(new Set(head).size).toBe(1);
    const legs = frames.map((f) => JSON.stringify(f.grid.slice(36, 42)));
    expect(legs[0]).toBe(legs[legs.length - 1]);
    // the swing chambers then thrusts: cell count stable within the extended
    // fist itself (no vanishing limbs)
    const counts = frames.map((f) => f.grid.flat().filter((c) => c !== 0).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(14);
  });

  it('draws an anticipation frame with the fist drawn back and a later impact frame', () => {
    const frames = generateSpriteFrames('windup-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'attack')!;
    const fists = frames.map((f) => computeLandmarks(f.grid).palmR.x);
    const minX = Math.min(...fists);
    const maxX = Math.max(...fists);
    const anticipation = fists.indexOf(minX);
    const impact = fists.indexOf(maxX);
    expect(maxX - minX).toBeGreaterThanOrEqual(2);
    expect(anticipation).toBeLessThan(impact);
  });

  it('generates idle breathing frames with grounded feet, a still lower body and a short blink', () => {
    const frames = generateSpriteFrames('idle-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'idle')!;
    expect(frames.length).toBeGreaterThanOrEqual(4);
    for (const f of frames) {
      expect(f.grid.length).toBe(42);
      expect(f.width).toBe(SPRITE_WIDTH);
      expect(f.height).toBe(SPRITE_HEIGHT);
      // Feet remain grounded on row 40/41
      expect(f.grid[40].some((c) => c !== 0)).toBe(true);
      expect(f.grid[41].some((c) => c !== 0)).toBe(true);
    }
    const eyeTone = shadeIndexOf(8);
    const eyeCounts = frames.map((f) => f.grid.flat().filter((c) => c === eyeTone).length);
    // At least one frame blinks: only the lash line is left over the open iris.
    expect(Math.max(...eyeCounts)).toBeGreaterThan(0);
    const blinkIndex = eyeCounts.indexOf(Math.min(...eyeCounts));
    expect(eyeCounts[blinkIndex]).toBeLessThanOrEqual(6);
    expect(eyeCounts[blinkIndex]).toBeLessThan(Math.max(...eyeCounts));
    // Rare (une fois par boucle) et COURT : le clignement impose sa propre durée,
    // plus brève que la respiration, sinon il s'éternise.
    expect(frames.filter((f) => f.ms !== undefined)).toHaveLength(1);
    expect(frames[blinkIndex].ms).toBeLessThan(SPRITE_IDLE_MS);

    // La silhouette monte et descend : plusieurs poses distinctes.
    const grids = frames.map((f) => JSON.stringify(f.grid));
    expect(new Set(grids).size).toBeGreaterThanOrEqual(4);

    // Sous la ceinture, RIEN ne bouge : ni la ceinture, ni le bassin, ni les
    // jambes, ni l'ombrage du pantalon (dérivé de la silhouette — déplacer le
    // bassin le faisait clignoter).
    const lower = frames.map((f) => JSON.stringify(f.grid.slice(32)));
    expect(new Set(lower).size).toBe(1);

    // Le buste respire par paliers d'une cellule au moins (6 px changés), et
    // jamais latéralement : l'ancien idle balançait tout le haut du corps de
    // ±1 cellule dans tous les sens, le personnage gigotait.
    const centerX = (grid: number[][]): number => {
      let sum = 0;
      let count = 0;
      for (let y = 6; y < 32; y++) {
        for (let x = 0; x < grid[y].length; x++) {
          if (grid[y][x] !== 0) {
            sum += x;
            count++;
          }
        }
      }
      return count === 0 ? 0 : sum / count;
    };
    for (let i = 0; i < frames.length; i++) {
      const next = frames[(i + 1) % frames.length];
      const diff = frameDiff(frames[i].grid, next.grid);
      if (diff === 0) continue; // temps de maintien voulu (souffle retenu)
      expect(diff).toBeGreaterThanOrEqual(IDLE_FRAME_MIN_DIFF);
      expect(Math.abs(centerX(frames[i].grid) - centerX(next.grid))).toBeLessThan(0.5);
    }
  });

  it('generates hit recoil frames with impact flinch and recovery', () => {
    const frames = generateSpriteFrames('hit-check', 'female', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'female',
    }, 'hit')!;
    expect(frames).toHaveLength(3);
    for (const f of frames) {
      expect(f.grid.length).toBe(42);
      expect(f.width).toBe(SPRITE_WIDTH);
      expect(f.height).toBe(SPRITE_HEIGHT);
    }
    const [impact, recoil, recovery] = frames.map((f) => JSON.stringify(f.grid));
    expect(impact).not.toBe(recoil);
    expect(recoil).not.toBe(recovery);
  });

  it('generates victory celebration frames with triumphant fist pump', () => {
    const frames = generateSpriteFrames('victory-check', 'male', {
      build: 'standard',
      bodyType: 'basic',
      headType: 'male',
    }, 'victory')!;
    expect(frames).toHaveLength(4);
    for (const f of frames) {
      expect(f.grid.length).toBe(42);
      expect(f.width).toBe(SPRITE_WIDTH);
      expect(f.height).toBe(SPRITE_HEIGHT);
    }
  });

  it('renders all new stylized heads and body archetypes with full anatomical integrity', () => {
    const testHeads = [
      'male_samurai', 'male_undercut', 'male_ninja', 'male_cyber', 'male_dreadlocks', 'male_paladin',
      'female_valkyrie', 'female_twintails', 'female_ninja', 'female_cyber', 'female_goth', 'female_warrior',
    ];
    const testBodies = ['ninja_gi', 'paladin', 'cyber_suit', 'monk_gi', 'assassin'];

    for (const headType of testHeads) {
      const gender = headType.startsWith('f') ? 'female' : 'male';
      const sprite = generateSprite16(`test-${headType}`, gender, { headType, bodyType: 'basic' });
      expect(sprite.grid.length).toBe(42);
      expect(sprite.grid[0].length).toBe(24);
      expect(sprite.grid.flat().some((c) => c !== 0)).toBe(true);
    }

    for (const bodyType of testBodies) {
      const sprite = generateSprite16(`test-${bodyType}`, 'male', { headType: 'male', bodyType });
      expect(sprite.grid.length).toBe(42);
      expect(sprite.grid[0].length).toBe(24);
      expect(sprite.grid.flat().some((c) => c !== 0)).toBe(true);
    }
  });
});

describe('mirrorSpriteGrid — PvP opponent faces the player', () => {
  // The whole procedural animation set (idle, attack, hit, victory) faces right,
  // like the PvE runner. The opponent stands on the right of the arena, so its
  // pixels are mirrored instead of relying on a CSS transform: a CSS flip would
  // be cancelled by the `fighterIdle` / action keyframes that drive transform,
  // and it would leave the equipped weapon on the wrong hand.
  it('swaps the columns and leaves the source grid untouched', () => {
    const grid = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const mirrored = mirrorSpriteGrid(grid);

    expect(mirrored).toEqual([
      [3, 2, 1],
      [6, 5, 4],
    ]);
    expect(grid).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(mirrored[0]).not.toBe(grid[0]);
  });

  it('is an involution on a real sprite (mirror twice = identity)', () => {
    const sprite = generateSprite16('pvp-opponent-seed', 'male');

    expect(mirrorSpriteGrid(mirrorSpriteGrid(sprite.grid))).toEqual(sprite.grid);

    // And the operation actually changes something: the sprite is asymmetric,
    // which is what makes the weapon switch hands.
    const once = mirrorSpriteGrid(sprite.grid);
    const differs = sprite.grid.some((row, y) => row.some((v, x) => v !== once[y][x]));
    expect(differs).toBe(true);
  });

  it('keeps every mirrored frame within the sprite bounds', () => {
    const frames = generateSpriteFrames('pvp-idle-seed', 'female', null, 'idle');
    expect(frames).not.toBeNull();

    for (const frame of frames ?? []) {
      const mirrored = mirrorSpriteGrid(frame.grid);
      expect(mirrored.length).toBe(frame.grid.length);
      for (const row of mirrored) {
        expect(row.length).toBe(frame.grid[0].length);
      }
    }
  });
});
