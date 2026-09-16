import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PixelMonster } from '../../components/PixelMonster';

describe('PixelMonster', () => {
  it('renders goblin with correct name', () => {
    render(<PixelMonster monsterId="goblin" />);
    const canvas = screen.getByLabelText('Goblin');
    expect(canvas).toBeDefined();
    expect(canvas.tagName).toBe('CANVAS');
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
    const canvas = screen.getByLabelText('Goblin');
    expect(canvas.getAttribute('width')).toBe('128');
    expect(canvas.getAttribute('height')).toBe('128');
  });

  it('returns null for unknown monster ID', () => {
    const { container } = render(<PixelMonster monsterId={'unknown' as any} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders canvas element', () => {
    render(<PixelMonster monsterId="ogre" />);
    expect(screen.getByLabelText('Ogre').tagName).toBe('CANVAS');
  });

  it('flags baked glow when aura is set, without css filters', () => {
    render(<PixelMonster monsterId="void_titan" aura="dark" />);
    const canvas = screen.getByLabelText('VOID TITAN') as HTMLCanvasElement;
    expect(canvas.getAttribute('data-glow')).toBe('on');
    expect(canvas.style.filter ?? '').not.toContain('drop-shadow');
  });
});
