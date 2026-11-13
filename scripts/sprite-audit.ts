/**
 * Audit des sprites : trous intérieurs, silhouettes disconnues, ancres d'équipement.
 * Run : npx tsx scripts/sprite-audit.ts
 */
import { PIXEL_HEADS, PIXEL_BODIES } from '../src/components/PixelAssets';
import { generateSprite16, generateSpriteFrames } from '../src/components/sprite/spriteGenerator';
import { SPRITE_BUILDS, SPRITE_HEIGHT, SPRITE_WIDTH, type SpriteBuild, type SpriteGrid } from '../src/components/sprite/spriteTypes';

interface Hole {
  x: number;
  y: number;
}

/**
 * Vides complètement encadrés : toute cellule vide non atteignable depuis le
 * bord de la grille (connectivité 4) est un trou.
 */
function interiorHoles(grid: SpriteGrid): Hole[] {
  const h = grid.length;
  const w = grid[0].length;
  const seen = Array.from({ length: h }, () => Array<boolean>(w).fill(false));
  const stack: Array<[number, number]> = [];
  for (let x = 0; x < w; x++) {
    stack.push([x, 0], [x, h - 1]);
  }
  for (let y = 0; y < h; y++) {
    stack.push([0, y], [w - 1, y]);
  }
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    if (seen[cy][cx] || grid[cy][cx] !== 0) continue;
    seen[cy][cx] = true;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  const holes: Hole[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] === 0 && !seen[y][x]) holes.push({ x, y });
    }
  }
  return holes;
}

function components(grid: SpriteGrid): number {
  const h = grid.length;
  const w = grid[0].length;
  const seen = Array.from({ length: h }, () => Array<boolean>(w).fill(false));
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] === 0 || seen[y][x]) continue;
      count += 1;
      const stack = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (seen[ny][nx] || grid[ny][nx] === 0) continue;
          seen[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }
    }
  }
  return count;
}

function ascii(grid: SpriteGrid): string {
  const legend = '.@#*oO%&$+~^=:;<>?';
  return grid
    .map((row) => row.map((c) => (c === 0 ? ' ' : legend[c % legend.length] ?? '#')).join(''))
    .join('\n');
}

const headTypes = Object.keys(PIXEL_HEADS);
const bodyTypes = Object.keys(PIXEL_BODIES);

const mode = process.argv[2] ?? 'holes';

if (mode === 'holes') {
  const byHead = new Map<string, number>();
  let total = 0;
  let worst: Array<{ head: string; body: string; build: SpriteBuild; n: number; holes: Hole[] }> = [];
  let compWorst: Array<{ head: string; body: string; build: SpriteBuild; n: number }> = [];
  for (const head of headTypes) {
    for (const body of bodyTypes) {
      for (const build of SPRITE_BUILDS) {
        const gender = head.startsWith('female') ? 'female' : 'male';
        const sprite = generateSprite16('audit', gender, {
          headType: head,
          bodyType: body,
          build,
        } as never);
        const holes = interiorHoles(sprite.grid);
        const comps = components(sprite.grid);
        if (holes.length > 0) {
          total += 1;
          byHead.set(head, (byHead.get(head) ?? 0) + 1);
          worst.push({ head, body, build, n: holes.length, holes });
        }
        if (comps > 1) compWorst.push({ head, body, build, n: comps });
      }
    }
  }
  worst = worst.sort((a, b) => b.n - a.n);
  console.log(`== ${total} combinaisons avec trous intérieurs (sur ${headTypes.length * bodyTypes.length * 3}) ==`);
  for (const [head, n] of [...byHead].sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${head}`);
  for (const w of worst.slice(0, 25)) {
    console.log(`  ${w.n} trous  head=${w.head} body=${w.body} build=${w.build}  @ ${w.holes.slice(0, 10).map((h) => `${h.x},${h.y}`).join(' ')}`);
  }
  const compsByHead = new Map<string, number>();
  for (const c of compWorst) compsByHead.set(c.head, (compsByHead.get(c.head) ?? 0) + 1);
  console.log(`== ${compWorst.length} silhouettes en plusieurs composantes ==`);
  for (const [head, n] of [...compsByHead].sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${head}`);
} else if (mode === 'frames') {
  // Trous/disconnections sur CHAQUE frame de chaque animation.
  const anims: Array<'run' | 'attack' | 'idle' | 'hit' | 'victory'> = ['run', 'attack', 'idle', 'hit', 'victory'];
  const seen = new Set<string>();
  for (const head of headTypes) {
    for (const body of bodyTypes) {
      const gender = head.startsWith('female') ? 'female' : 'male';
      for (const anim of anims) {
        const frames = generateSpriteFrames('audit', gender, { headType: head, bodyType: body } as never, anim)!;
        frames.forEach((f, i) => {
          const holes = interiorHoles(f.grid);
          const comps = components(f.grid);
          if (holes.length > 0) {
            const key = `holes ${anim} head=${head} body=${body} frame=${i}`;
            if (!seen.has(key)) {
              seen.add(key);
              console.log(`  ${holes.length} trous  ${key} @ ${holes.slice(0, 8).map((h) => `${h.x},${h.y}`).join(' ')}`);
            }
          }
          if (comps > 1) {
            const key = `comps ${anim} head=${head} body=${body} frame=${i} n=${comps}`;
            if (!seen.has(key)) {
              seen.add(key);
              console.log(`  ${comps} comps  ${key}`);
            }
          }
        });
      }
    }
  }
  console.log(`== ${seen.size} anomalies de frame ==`);
} else if (mode === 'render') {
  const head = process.argv[3] ?? 'male';
  const body = process.argv[4] ?? 'basic';
  const build = (process.argv[5] ?? 'standard') as SpriteBuild;
  const gender = head.startsWith('female') ? 'female' : 'male';
  const sprite = generateSprite16('audit', gender, { headType: head, bodyType: body, build } as never);
  console.log(ascii(sprite.grid));
  console.log('holes:', interiorHoles(sprite.grid).map((h) => `${h.x},${h.y}`).join(' '));
} else if (mode === 'anim') {
  const head = process.argv[3] ?? 'male';
  const body = process.argv[4] ?? 'basic';
  const kind = (process.argv[5] ?? 'run') as 'run' | 'attack' | 'idle' | 'hit' | 'victory';
  const gender = head.startsWith('female') ? 'female' : 'male';
  const frames = generateSpriteFrames('audit', gender, { headType: head, bodyType: body } as never, kind)!;
  frames.forEach((f, i) => {
    console.log(`--- frame ${i} ---`);
    console.log(ascii(f.grid));
    console.log('holes:', interiorHoles(f.grid).map((h) => `${h.x},${h.y}`).join(' '));
  });
} else if (mode === 'list') {
  console.log('heads:', headTypes.join(', '));
  console.log('bodies:', bodyTypes.join(', '));
  console.log('size:', SPRITE_WIDTH, 'x', SPRITE_HEIGHT);
}
