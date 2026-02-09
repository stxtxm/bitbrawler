import { describe, it, expect } from 'vitest';
import { PIXEL_HEADS, PIXEL_BODIES } from '../../components/PixelAssets';

describe('PixelAssets integrity', () => {
  it('ensures all head grids are 8x12', () => {
    Object.entries(PIXEL_HEADS).forEach(([, grid]) => {
      expect(grid.length).toBe(8);
      grid.forEach((row) => {
        expect(row.length).toBe(12);
        expect(Array.isArray(row)).toBe(true);
      });
    });
  });

  it('ensures all body grids are 9x12', () => {
    Object.entries(PIXEL_BODIES).forEach(([, grid]) => {
      expect(grid.length).toBe(9);
      grid.forEach((row) => {
        expect(row.length).toBe(12);
        expect(Array.isArray(row)).toBe(true);
      });
    });
  });
});
