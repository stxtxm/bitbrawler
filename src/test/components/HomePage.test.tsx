import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../../pages/HomePage';

describe('HomePage', () => {
  it('opens and closes patch notes modal', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const notesButton = screen.getByRole('button', { name: 'PATCH NOTES' });
    fireEvent.click(notesButton);

    expect(screen.getByRole('button', { name: 'CLOSE' })).toBeInTheDocument();
    expect(screen.getByText(/Daily reset reliability/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    expect(screen.queryByText(/Daily reset reliability/i)).toBeNull();
  });
});
