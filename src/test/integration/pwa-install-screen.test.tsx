import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import PwaInstallScreen from '../../components/PwaInstallScreen';
import { usePwaInstallPrompt } from '../../hooks/usePwaInstallPrompt';

vi.mock('../../hooks/usePwaInstallPrompt', () => ({
  usePwaInstallPrompt: vi.fn(),
}));

describe('PwaInstallScreen', () => {
  const mockUsePwaInstallPrompt = usePwaInstallPrompt as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  it('renders install prompt and hides after accepted', async () => {
    const promptInstall = vi.fn().mockResolvedValue({ outcome: 'accepted', platform: 'web' });
    mockUsePwaInstallPrompt.mockReturnValue({
      canPrompt: true,
      promptInstall,
      isStandalone: false,
      isIos: false,
    });

    render(<PwaInstallScreen />);

    expect(screen.getByText('Install BitBrawler')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /install app/i }));

    await waitFor(() => {
      expect(promptInstall).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText('Install BitBrawler')).not.toBeInTheDocument();
    });
  });
});
