import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PixelItemIcon } from '../../components/PixelItemIcon';
import { ITEM_ASSETS } from '../../data/itemAssets';

describe('PixelItemIcon', () => {
  it('renders an SVG for an item asset', () => {
    const { container } = render(
      <PixelItemIcon pixels={ITEM_ASSETS[0].pixels} size={24} />
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(0);
  });

  it('upscales with an integer nearest-neighbour factor and pixelated rendering', () => {
    for (const requested of [8, 16, 22, 30, 64]) {
      const { container, unmount } = render(
        <PixelItemIcon pixels={ITEM_ASSETS[0].pixels} size={requested} />,
      );
      const svg = container.querySelector('svg');
      if (!svg) throw new Error('Missing icon SVG');

      const scale = Number(svg.getAttribute('data-scale'));
      const rendered = Number(svg.getAttribute('width'));

      expect(Number.isInteger(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(rendered).toBe(scale * 8);
      expect(svg.style.imageRendering).toBe('pixelated');
      expect(svg.getAttribute('shape-rendering')).toBe('crispEdges');

      unmount();
    }
  });
});
