import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import Footer from '../../components/Footer';
import { renderWithRouter } from '../utils/router';
import { version } from '../../../package.json';

describe('Footer', () => {
  it('renders the copyright with the current year', () => {
    renderWithRouter(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${currentYear} Bitbrawler`))).toBeInTheDocument();
  });

  it('renders a link to the GitHub repository', () => {
    renderWithRouter(<Footer />);
    const githubLink = screen.getByRole('link', { name: /bitbrawler github repository/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/stxtxm/bitbrawler');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the credits text', () => {
    renderWithRouter(<Footer />);
    expect(screen.getByText(/Made with 🎮 by stxtxm/)).toBeInTheDocument();
  });

  it('renders the app version', () => {
    renderWithRouter(<Footer />);
    expect(screen.getByText(`v${version}`)).toBeInTheDocument();
  });

  it('renders the footer with contentinfo role', () => {
    renderWithRouter(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders the pixel divider', () => {
    renderWithRouter(<Footer />);
    const footer = screen.getByRole('contentinfo');
    const divider = footer.querySelector('.footer-pixel-divider');
    expect(divider).toBeInTheDocument();
  });

  it('renders a link to the Achievements page', () => {
    renderWithRouter(<Footer />);
    const achievementsLink = screen.getByText('Achievements');
    expect(achievementsLink).toBeInTheDocument();
    expect(achievementsLink.closest('a')).toHaveAttribute('href', '/achievements');
  });

  it('renders separator elements', () => {
    renderWithRouter(<Footer />);
    const separators = document.querySelectorAll('.footer-separator');
    expect(separators.length).toBeGreaterThanOrEqual(4);
  });
});
