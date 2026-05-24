import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import NotFound from '../../pages/NotFound';
import { renderWithRouter } from '../utils/router';

describe('NotFound Page', () => {
  it('renders 404 heading', () => {
    renderWithRouter(<NotFound />, { initialEntries: ['/nonexistent'] });
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders PAGE NOT FOUND title', () => {
    renderWithRouter(<NotFound />, { initialEntries: ['/nonexistent'] });
    expect(screen.getByText('PAGE NOT FOUND')).toBeInTheDocument();
  });

  it('renders explanation message', () => {
    renderWithRouter(<NotFound />, { initialEntries: ['/nonexistent'] });
    expect(
      screen.getByText("The page you're looking for doesn't exist...")
    ).toBeInTheDocument();
  });

  it('renders RETURN HOME link pointing to /', () => {
    renderWithRouter(<NotFound />, { initialEntries: ['/nonexistent'] });
    const returnLink = screen.getByRole('link', { name: /return home/i });
    expect(returnLink).toBeInTheDocument();
    expect(returnLink).toHaveAttribute('href', '/');
  });

  it('renders the sad pixel character SVG', () => {
    renderWithRouter(<NotFound />, { initialEntries: ['/nonexistent'] });
    const character = document.querySelector('.sad-pixel-character');
    expect(character).not.toBeNull();
  });

  it('renders RETURN HOME link with correct href', () => {
    renderWithRouter(<NotFound />, { initialEntries: ['/nonexistent'] });
    const returnLink = screen.getByRole('link', { name: /return home/i });
    expect(returnLink).toHaveAttribute('href', '/');
  });
});
