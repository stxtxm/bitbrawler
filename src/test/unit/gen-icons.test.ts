import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

type Rgb = { r: number; g: number; b: number };
type Cell = Rgb | null;
type Art = Rgb[][];
type BadgeArt = Cell[][];

interface IconGenModule {
  P: Record<string, readonly number[]>;
  buildArtwork: (simple?: boolean) => Art;
  buildBadgeArt: () => BadgeArt;
}

const FLAT_STEEL: [number, number, number] = [174, 189, 212];
const FLAT_GOLD: [number, number, number] = [255, 204, 0];

const loadIconGen = async (): Promise<IconGenModule> => {
  const spec = pathToFileURL(resolve(process.cwd(), 'scripts/gen-icons.mjs')).href;
  return (await import(spec)) as unknown as IconGenModule;
};

const rgbOf = (c: Rgb): [number, number, number] => [c.r, c.g, c.b];

describe('gen-icons palette integrity', () => {
  it('defines flatSteel and flatGold for simple sword variants', async () => {
    const { P } = await loadIconGen();
    expect([...(P.flatSteel ?? [])]).toEqual(FLAT_STEEL);
    expect([...(P.flatGold ?? [])]).toEqual(FLAT_GOLD);
  });

  it('defines pommel color used by both sword handles', async () => {
    const { P } = await loadIconGen();
    expect(P.pommel).toBeDefined();
    expect(P.pommel.length).toBe(3);
  });

  it('draws the steel blade in the simple variant', async () => {
    const { buildArtwork } = await loadIconGen();
    const art = buildArtwork(true);
    expect(rgbOf(art[27][28])).toEqual(FLAT_STEEL);
    expect(rgbOf(art[27][26])).toEqual(FLAT_STEEL);
  });

  it('draws the gold blade in the simple variant', async () => {
    const { buildArtwork } = await loadIconGen();
    const art = buildArtwork(true);
    expect(rgbOf(art[25][6])).toEqual(FLAT_GOLD);
  });

  it('draws pommels on both handles in the simple variant', async () => {
    const { buildArtwork, P } = await loadIconGen();
    const art = buildArtwork(true);
    const expected = [...P.pommel] as [number, number, number];
    expect(rgbOf(art[31][31])).toEqual(expected);
    expect(rgbOf(art[31][0])).toEqual(expected);
  });

  it('keeps detailed blades shaded rather than flat', async () => {
    const { buildArtwork } = await loadIconGen();
    const art = buildArtwork(false);
    expect(rgbOf(art[27][28])).toEqual([109, 127, 155]);
    expect(rgbOf(art[27][26])).toEqual([233, 240, 250]);
    expect(rgbOf(art[25][6])).toEqual([255, 204, 0]);
  });

  it.each([true, false])('renders every cell with defined rgb (simple=%s)', async (simple) => {
    const { buildArtwork } = await loadIconGen();
    const art = buildArtwork(simple);
    for (const row of art) {
      for (const cell of row) {
        expect(cell).toBeDefined();
        expect(typeof cell.r).toBe('number');
        expect(typeof cell.g).toBe('number');
        expect(typeof cell.b).toBe('number');
      }
    }
  });
});

// ─── Badge de notification Android ──────────────────────────────────────────
// Android rend le small icon d'une notification en silhouette monochrome
// déduite du SEUL canal alpha (redessinée en blanc par le système) : un logo à
// gros aplat se lit donc comme un carré blanc dans la barre d'état — constaté
// sur Pixel 9a, y compris après #1200 qui n'avait réglé que la transparence.
// Garde-fous : glyphe creux (aucun pavé), marges sûres, blanc pur.

const OUTER_MARGIN = 3; // cellules vides sur chaque bord (≈9 % de 32)

/** Décode le PNG RGBA produit par scripts/gen-icons.mjs (filtre 0 uniquement). */
const decodeRgbaPng = (file: string): { size: number; alpha: number[]; rgb: [number, number, number][] } => {
  const buf = readFileSync(resolve(process.cwd(), file));
  let pos = 8; // saute la signature PNG
  let size = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') size = data.readUInt32BE(0);
    if (type === 'IDAT') idat.push(Buffer.from(data));
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = size * 4 + 1;
  const alpha: number[] = [];
  const rgb: [number, number, number][] = [];
  for (let y = 0; y < size; y++) {
    expect(raw[y * stride]).toBe(0); // un seul filtre : None (émetteur maison)
    for (let x = 0; x < size; x++) {
      const i = y * stride + 1 + x * 4;
      alpha.push(raw[i + 3]);
      rgb.push([raw[i], raw[i + 1], raw[i + 2]]);
    }
  }
  return { size, alpha, rgb };
};

describe('gen-icons badge de notification (carré blanc Android)', () => {
  it('construit un glyphe creux : aucun pavé plein (max 4×4 cellules)', async () => {
    const { buildBadgeArt } = await loadIconGen();
    const art = buildBadgeArt();
    let largest = 0;
    for (let s = 1; s <= 12; s++) {
      let found = false;
      for (let y = 0; y + s <= art.length && !found; y++) {
        for (let x = 0; x + s <= art.length && !found; x++) {
          let full = true;
          for (let dy = 0; dy < s && full; dy++) {
            for (let dx = 0; dx < s && full; dx++) if (art[y + dy][x + dx] === null) full = false;
          }
          if (full) found = true;
        }
      }
      if (found) largest = s;
    }
    // Le buste de l'ancien badge faisait ~12×10 cellules pleines → carré blanc
    // une fois réduit à 24 dp par le système.
    expect(largest).toBeLessThanOrEqual(4);
  });

  it('laisse une marge sûre transparente sur tout le pourtour', async () => {
    const { buildBadgeArt } = await loadIconGen();
    const art = buildBadgeArt();
    const last = art.length - 1;
    for (let i = 0; i < art.length; i++) {
      for (let d = 0; d < OUTER_MARGIN; d++) {
        expect(art[d][i]).toBeNull();
        expect(art[last - d][i]).toBeNull();
        expect(art[i][d]).toBeNull();
        expect(art[i][last - d]).toBeNull();
      }
    }
  });

  it('est monochrome blanc, peu dense, et dessine les deux épées', async () => {
    const { buildBadgeArt } = await loadIconGen();
    const art = buildBadgeArt();
    const cells = art.flat().filter((c): c is Rgb => c !== null);
    expect(cells.length / (art.length * art.length)).toBeLessThan(0.15);
    for (const c of cells) expect(rgbOf(c)).toEqual([255, 255, 255]);
    expect(art[8][8]).not.toBeNull(); // pointe de l'épée acier (haut-gauche)
    expect(art[8][23]).not.toBeNull(); // pointe de l'épée dorée (haut-droite)
    expect(art[28][28]).not.toBeNull(); // pommeau acier (bas-droite)
    expect(art[28][3]).not.toBeNull(); // pommeau doré (bas-gauche)
  });

  it('le badge-96.png livré est transparent, blanc et creux', () => {
    const { size, alpha, rgb } = decodeRgbaPng('public/badge-96.png');
    expect(size).toBe(96);
    const px = size * size;
    const opaque = alpha.filter((a) => a > 128).length;
    expect(opaque / px).toBeGreaterThan(0.03); // le glyphe existe vraiment
    expect(opaque / px).toBeLessThan(0.15); // …et reste un tracé creux
    const margin = (OUTER_MARGIN * size) / 32; // 9 px
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (x < margin || y < margin || x >= size - margin || y >= size - margin) {
          expect(alpha[i]).toBe(0); // marge sûre Android
        } else if (alpha[i] > 128) {
          expect(rgb[i]).toEqual([255, 255, 255]); // silhouette blanche pure
        }
      }
    }
  });
});
