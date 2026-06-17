import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PixelMonster } from '../../components/PixelMonster';

describe('PixelMonster', () => {
  it('renders goblin with correct name', () => {
    render(<PixelMonster monsterId="goblin" />);
    const svg = screen.getByLabelText('Goblin');
    expect(svg).toBeDefined();
    expect(svg.tagName).toBe('svg');
  });

  it('renders ogre', () => {
    render(<PixelMonster monsterId="ogre" />);
    expect(screen.getByLabelText('Ogre')).toBeDefined();
  });

  it('renders wraith', () => {
    render(<PixelMonster monsterId="wraith" />);
    expect(screen.getByLabelText('Wraith')).toBeDefined();
  });

  it('renders with custom scale', () => {
    render(<PixelMonster monsterId="goblin" scale={8} />);
    const svg = screen.getByLabelText('Goblin');
    expect(svg.getAttribute('width')).toBe('128');
    expect(svg.getAttribute('height')).toBe('128');
  });

  it('returns null for unknown monster ID', () => {
    const { container } = render(<PixelMonster monsterId={'unknown' as any} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders SVG element', () => {
    render(<PixelMonster monsterId="ogre" />);
    expect(screen.getByLabelText('Ogre').tagName).toBe('svg');
  });
});
