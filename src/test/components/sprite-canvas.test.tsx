import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { SpriteCanvas } from '../../components/sprite/SpriteCanvas';
import { PixelGridCanvas } from '../../components/sprite/PixelGridCanvas';
import { SPRITE_DISPLAY_SCALE } from '../../components/sprite/spriteTypes';

describe('SpriteCanvas', () => {
  it('applies the global display shrink for a given scale', () => {
    const { container } = render(<SpriteCanvas seed="canvas-hero" gender="male" scale={4} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('width')).toBe(String(12 * 4 * SPRITE_DISPLAY_SCALE));
    expect(canvas?.getAttribute('height')).toBe(String(21 * 4 * SPRITE_DISPLAY_SCALE));
  });

  it('flags baked glow when aura is set, without css filters', () => {
    const { container } = render(<SpriteCanvas seed="aura-hero" gender="female" aura="fire" />);
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('data-glow')).toBe('on');
    expect(canvas?.style.filter ?? '').not.toContain('drop-shadow');
  });

  it('renders without crashing when equipped items are unknown ids', () => {
    const { container } = render(
      <SpriteCanvas
        seed="gear-hero"
        gender="male"
        equippedItems={{ weapon: 'nope', armor: null, accessory: null }}
      />,
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('cycles animation frames on a timer and cleans up on unmount', () => {
    vi.useFakeTimers();
    const { container, unmount } = render(
      <SpriteCanvas seed="anim-hero" gender="female" animate="run" />,
    );
    expect(container.querySelector('canvas')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector('canvas')).not.toBeNull();
    unmount();
    vi.useRealTimers();
  });
});

describe('PixelGridCanvas', () => {
  it('renders any grid at the requested scale', () => {
    const { container } = render(
      <PixelGridCanvas grid={[[1, 0], [0, 1]]} palette={{ 1: '#ff0000' }} scale={8} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('width')).toBe('16');
    expect(canvas?.getAttribute('height')).toBe('16');
  });
});
