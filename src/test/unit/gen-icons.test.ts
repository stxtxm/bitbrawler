import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Rgb = { r: number; g: number; b: number };
type Art = Rgb[][];

interface IconGenModule {
  P: Record<string, readonly number[]>;
  buildArtwork: (simple?: boolean) => Art;
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
