import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { ConnectionBlockerProvider, useConnectionBlocker } from '../context/ConnectionBlockerContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useGame } from '../context/GameContext';

vi.mock('../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}));

vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}));

const TestHarness = () => {
  const { requireConnection } = useConnectionBlocker();
  const [resolved, setResolved] = useState(false);

  return (
    <div>
      <button onClick={() => requireConnection().then(setResolved)}>trigger</button>
      {resolved ? <span>resolved</span> : null}
    </div>
  );
};

describe('ConnectionBlockerProvider', () => {
  const mockUseOnlineStatus = useOnlineStatus as unknown as ReturnType<typeof vi.fn>;
  const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks and shows offline screen when connection is required', async () => {
    mockUseOnlineStatus.mockReturnValue(false);
    mockUseGame.mockReturnValue({
      firebaseAvailable: false,
      retryConnection: vi.fn().mockResolvedValue(false),
    });

    render(
      <ConnectionBlockerProvider>
        <TestHarness />
      </ConnectionBlockerProvider>
    );

    fireEvent.click(screen.getByText('trigger'));

    expect(await screen.findByText('OFFLINE MODE')).toBeInTheDocument();
    expect(screen.queryByText('resolved')).not.toBeInTheDocument();
  });

  it('resolves immediately when connection is available', async () => {
    mockUseOnlineStatus.mockReturnValue(true);
    mockUseGame.mockReturnValue({
      firebaseAvailable: true,
      retryConnection: vi.fn().mockResolvedValue(true),
    });

    render(
      <ConnectionBlockerProvider>
        <TestHarness />
      </ConnectionBlockerProvider>
    );

    fireEvent.click(screen.getByText('trigger'));

    await waitFor(() => {
      expect(screen.getByText('resolved')).toBeInTheDocument();
    });
    expect(screen.queryByText('OFFLINE MODE')).not.toBeInTheDocument();
  });

  it('disables retry button while checking connection', async () => {
    mockUseOnlineStatus.mockReturnValue(false);

    let resolveRetry: (value: boolean) => void = () => {};
    const retryConnection = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRetry = resolve;
        })
    );

    mockUseGame.mockReturnValue({
      firebaseAvailable: false,
      retryConnection,
    });

    render(
      <ConnectionBlockerProvider>
        <TestHarness />
      </ConnectionBlockerProvider>
    );

    fireEvent.click(screen.getByText('trigger'));
    const retryButton = await screen.findByRole('button', { name: /retry connection/i });

    fireEvent.click(retryButton);
    expect(retryButton).toBeDisabled();

    await act(async () => {
      resolveRetry(true);
    });

    await waitFor(() => {
      expect(retryButton).not.toBeDisabled();
    });
  });
});
