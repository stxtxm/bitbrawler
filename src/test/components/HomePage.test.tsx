import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import HomePage from '../../pages/HomePage';
import { renderWithRouter } from '../utils/router';

describe('HomePage', () => {
  it('opens and closes patch notes modal', () => {
    renderWithRouter(<HomePage />);

    const notesButton = screen.getByRole('button', { name: 'PATCH NOTES' });
    fireEvent.click(notesButton);

    expect(screen.getByRole('button', { name: 'CLOSE' })).toBeInTheDocument();
    expect(screen.getByText(/AI-driven fixes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    expect(screen.queryByText(/AI-driven fixes/i)).toBeNull();
  });
});
