import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import SwUpdateToast from '../components/SwUpdateToast';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';

vi.mock('../hooks/useServiceWorkerUpdate', () => ({
  useServiceWorkerUpdate: vi.fn(),
}));

describe('SwUpdateToast', () => {
  const mockUseServiceWorkerUpdate = useServiceWorkerUpdate as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prompts for update and sends SKIP_WAITING', () => {
    const postMessage = vi.fn();
    mockUseServiceWorkerUpdate.mockReturnValue({
      waiting: {
        postMessage,
      },
    });

    render(<SwUpdateToast />);

    expect(screen.getByText('Nouvelle version dispo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mettre a jour/i }));
    expect(postMessage).toHaveBeenCalledWith('SKIP_WAITING');

    fireEvent.click(screen.getByRole('button', { name: /plus tard/i }));
    expect(screen.queryByText('Nouvelle version dispo')).not.toBeInTheDocument();
  });
});
