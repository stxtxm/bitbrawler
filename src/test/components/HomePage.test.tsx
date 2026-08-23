import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import HomePage from '../../pages/HomePage';
import { renderWithRouter } from '../utils/router';

describe('HomePage', () => {
  it('does not display any OpenCode footer', () => {
    renderWithRouter(<HomePage />);
    expect(screen.queryByText(/Propulsé par OpenCode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/OpenCode/i)).not.toBeInTheDocument();
  });

  it('opens and closes patch notes modal', () => {
    renderWithRouter(<HomePage />);

    const notesButton = screen.getByRole('button', { name: 'PATCH NOTES' });
    fireEvent.click(notesButton);

    expect(screen.getByRole('button', { name: 'CLOSE' })).toBeInTheDocument();
    expect(screen.getByText(/limitless character progression/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    expect(screen.queryByText(/limitless character progression/i)).toBeNull();
  });
});
