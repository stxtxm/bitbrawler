import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AffinityBadge } from '../../components/AffinityBadge';

describe('AffinityBadge', () => {
  it('renders with fire element', () => {
    render(<AffinityBadge element="fire" />);
    const badge = screen.getByLabelText('Fire');
    expect(badge).toBeDefined();
    expect(badge.tagName).toBe('svg');
  });

  it('renders with water element', () => {
    render(<AffinityBadge element="water" />);
    expect(screen.getByLabelText('Water')).toBeDefined();
  });

  it('renders with custom size', () => {
    render(<AffinityBadge element="earth" size={24} />);
    const badge = screen.getByLabelText('Earth');
    expect(badge.getAttribute('width')).toBe('24');
    expect(badge.getAttribute('height')).toBe('24');
  });

  it('renders with SVG element', () => {
    render(<AffinityBadge element="light" />);
    expect(screen.getByLabelText('Light').tagName).toBe('svg');
  });
});
