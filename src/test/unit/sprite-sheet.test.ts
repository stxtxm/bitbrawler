import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

interface SheetSeed {
  seed: string;
  gender: 'male' | 'female';
}

interface SheetLoadout {
  label: string;
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

interface SpritePlacement {
  row: number;
  col: number;
  seed: string;
  gender: string;
  loadout: string;
  kind: string;
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SheetDimensions {
  width: number;
  height: number;
  rows: number;
  cols: number;
  scale: number;
  gap: number;
}

interface ComposedSheet {
  width: number;
  height: number;
  rgba: Uint8Array;
  sprites: SpritePlacement[];
}

interface SheetModule {
  SHEET_DEFAULT_SCALE: number;
  SHEET_GAP: number;
  SHEET_KINDS: string[];
  SHEET_SEEDS: SheetSeed[];
  SHEET_LOADOUTS: SheetLoadout[];
  frameCountOfKind: (kind: string) => number;
  sheetDimensions: (opts?: { scale?: number; gap?: number }) => SheetDimensions;
  composeSheet: (opts?: { scale?: number; gap?: number }) => ComposedSheet;
  encodePNG: (rgba: Uint8Array, width: number, height: number) => Buffer;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const loadSheet = async (): Promise<SheetModule> => {
  const spec = pathToFileURL(resolve(process.cwd(), 'scripts/render-sprite-sheet.mjs')).href;
  return (await import(spec)) as unknown as SheetModule;
};

interface PngChunk {
  type: string;
  data: Buffer;
}

const readChunks = (png: Buffer): PngChunk[] => {
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 8 + length + 4;
    if (type === 'IEND') break;
  }
  return chunks;
};

describe('render-sprite-sheet', () => {
  it('covers every animation state of the renderer', async () => {
    const sheet = await loadSheet();
    expect(sheet.SHEET_KINDS).toEqual(['idle', 'run', 'attack', 'hit', 'victory']);
    for (const kind of sheet.SHEET_KINDS) {
      expect(sheet.frameCountOfKind(kind)).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses several production-like seeds and loadouts', async () => {
    const sheet = await loadSheet();
    expect(sheet.SHEET_SEEDS.length).toBeGreaterThanOrEqual(3);
    expect(sheet.SHEET_LOADOUTS.length).toBeGreaterThanOrEqual(3);
  });

  it('computes stable sheet dimensions from rows, cols and scale', async () => {
    const sheet = await loadSheet();
    const rows = sheet.SHEET_SEEDS.length * sheet.SHEET_LOADOUTS.length * sheet.SHEET_KINDS.length;
    const cols = Math.max(...sheet.SHEET_KINDS.map((k) => sheet.frameCountOfKind(k)));
    const dims = sheet.sheetDimensions();
    expect(dims.rows).toBe(rows);
    expect(dims.cols).toBe(cols);
    expect(dims.scale).toBe(sheet.SHEET_DEFAULT_SCALE);
    expect(dims.width).toBe((cols * (24 + sheet.SHEET_GAP) + sheet.SHEET_GAP) * dims.scale);
    expect(dims.height).toBe((rows * (42 + sheet.SHEET_GAP) + sheet.SHEET_GAP) * dims.scale);
  });

  it('places exactly one sprite per generated frame', async () => {
    const sheet = await loadSheet();
    const composed = sheet.composeSheet({ scale: 1 });
    const expected = sheet.SHEET_SEEDS.length
      * sheet.SHEET_LOADOUTS.length
      * sheet.SHEET_KINDS.reduce((sum, k) => sum + sheet.frameCountOfKind(k), 0);
    expect(composed.sprites).toHaveLength(expected);
    expect(composed.rgba.length).toBe(composed.width * composed.height * 4);
  });

  it('draws visible pixels for every sprite cell', async () => {
    const sheet = await loadSheet();
    const composed = sheet.composeSheet({ scale: 1 });
    for (const sprite of composed.sprites) {
      let opaque = 0;
      for (let y = sprite.y; y < sprite.y + sprite.height; y++) {
        for (let x = sprite.x; x < sprite.x + sprite.width; x++) {
          if (composed.rgba[(y * composed.width + x) * 4 + 3] > 0) opaque++;
        }
      }
      expect(opaque, `sprite ${sprite.kind}/${sprite.loadout}/${sprite.frame}`).toBeGreaterThan(0);
    }
  });

  it('encodes an RGBA PNG with a re-decodable signature and IHDR', async () => {
    const sheet = await loadSheet();
    const width = 3;
    const height = 2;
    const rgba = new Uint8Array(width * height * 4).fill(255);
    const png = sheet.encodePNG(rgba, width, height);
    expect([...png.subarray(0, PNG_SIGNATURE.length)]).toEqual(PNG_SIGNATURE);

    const chunks = readChunks(png);
    expect(chunks[0]?.type).toBe('IHDR');
    expect(chunks[0]?.data.readUInt32BE(0)).toBe(width);
    expect(chunks[0]?.data.readUInt32BE(4)).toBe(height);
    expect(chunks[0]?.data[8]).toBe(8);
    expect(chunks[0]?.data[9]).toBe(6);
    expect(chunks[chunks.length - 1]?.type).toBe('IEND');

    const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
    const raw = inflateSync(idat);
    expect(raw.length).toBe(height * (width * 4 + 1));
  });
});
