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
});
