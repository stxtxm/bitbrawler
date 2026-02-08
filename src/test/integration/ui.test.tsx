import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PixelCharacter } from '../../components/PixelCharacter';

describe('PixelCharacter Component', () => {
    it('should render an SVG element', () => {
        const { container } = render(<PixelCharacter seed="test" gender="male" />);
        const svg = container.querySelector('svg');
        expect(svg).toBeDefined();
        expect(svg?.getAttribute('viewBox')).toBe('0 0 12 18');
    });

    it('should contain paths/rects for the character pixels', () => {
        const { container } = render(<PixelCharacter seed="test" gender="female" />);
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBeGreaterThan(0);
    });

    it('should apply the scale prop to width and height', () => {
        const scale = 10;
        const { container } = render(<PixelCharacter seed="test" gender="male" scale={scale} />);
        const svg = container.querySelector('svg');

        expect(svg?.getAttribute('width')).toBe((12 * scale).toString());
        expect(svg?.getAttribute('height')).toBe((18 * scale).toString());
    });
});
