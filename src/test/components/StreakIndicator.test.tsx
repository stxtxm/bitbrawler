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
});
