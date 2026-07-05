import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreakIndicator from '../../components/StreakIndicator';

describe('StreakIndicator', () => {
  it('renders streak count', () => {
    render(<StreakIndicator streak={3} canRoll={true} />);
    expect(screen.getByText('3 DAYS')).toBeDefined();
  });

  it('renders compact variant', () => {
    render(<StreakIndicator streak={5} canRoll={true} compact={true} />);
    expect(screen.getByText('5')).toBeDefined();
  });

  it('shows warning when cannot roll', () => {
    render(<StreakIndicator streak={3} canRoll={false} />);
    expect(screen.getByText(/KEEP STREAK/)).toBeDefined();
  });

  it('shows tier label for base streak', () => {
    render(<StreakIndicator streak={1} canRoll={true} />);
    expect(screen.getByText('BASE')).toBeDefined();
  });

  it('applies streak-gray class for streak 1-2', () => {
    const { container } = render(<StreakIndicator streak={1} canRoll={true} />);
    expect(container.querySelector('.streak-gray')).not.toBeNull();
    expect(container.querySelector('.streak-silver')).toBeNull();
    expect(container.querySelector('.streak-gold')).toBeNull();
    expect(container.querySelector('.streak-rainbow')).toBeNull();
  });

  it('applies streak-silver class for streak 3-4', () => {
    const { container } = render(<StreakIndicator streak={3} canRoll={true} />);
    expect(container.querySelector('.streak-silver')).not.toBeNull();
    expect(container.querySelector('.streak-gray')).toBeNull();
  });

  it('applies streak-gold class for streak 5-9', () => {
    const { container } = render(<StreakIndicator streak={7} canRoll={true} />);
    expect(container.querySelector('.streak-gold')).not.toBeNull();
    expect(container.querySelector('.streak-silver')).toBeNull();
  });

  it('applies streak-rainbow class for streak 10+', () => {
    const { container } = render(<StreakIndicator streak={12} canRoll={true} />);
    expect(container.querySelector('.streak-rainbow')).not.toBeNull();
    expect(container.querySelector('.streak-gold')).toBeNull();
  });

  it('shows milestone burst at streak 3', () => {
    const { container } = render(<StreakIndicator streak={3} canRoll={true} />);
    expect(container.querySelector('.streak-milestone-burst')).not.toBeNull();
  });

  it('shows milestone burst at streak 5', () => {
    const { container } = render(<StreakIndicator streak={5} canRoll={true} />);
    expect(container.querySelector('.streak-milestone-burst')).not.toBeNull();
  });

  it('shows milestone burst at streak 10', () => {
    const { container } = render(<StreakIndicator streak={10} canRoll={true} />);
    expect(container.querySelector('.streak-milestone-burst')).not.toBeNull();
  });

  it('does not show milestone burst at non-milestone streak', () => {
    const { container } = render(<StreakIndicator streak={4} canRoll={true} />);
    expect(container.querySelector('.streak-milestone-burst')).toBeNull();
  });

  it('applies compact color classes correctly', () => {
    const { container } = render(<StreakIndicator streak={10} canRoll={true} compact={true} />);
    expect(container.querySelector('.streak-indicator.compact.streak-rainbow')).not.toBeNull();
  });
});
