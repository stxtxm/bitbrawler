import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PixelIcon } from '../../components/PixelIcon';

describe('PixelIcon', () => {
    it('renders skull icon', () => {
        const { container } = render(<PixelIcon type="skull" size={16} />);
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('renders swords icon', () => {
        const { container } = render(<PixelIcon type="swords" size={16} />);
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('renders stat icons', () => {
        const { container } = render(<PixelIcon type="strength" size={16} />);
        expect(container.querySelector('svg')).not.toBeNull();
    });
});
