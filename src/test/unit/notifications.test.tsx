import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { NotificationProvider } from '../../context/NotificationContext';
import { NotificationDisplay } from '../../components/NotificationDisplay';
import { useNotification } from '../../hooks/useNotification';

// Test component that uses notifications
const TestComponent = () => {
  const { notify } = useNotification();

  return (
    <div>
      <button onClick={() => notify('Test success', 'success', 3000)}>Success</button>
      <button onClick={() => notify('Test error', 'error', 3000)}>Error</button>
      <button onClick={() => notify('Test xp', 'xp', 2000)}>XP</button>
    </div>
  );
};

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render without crashing', () => {
    render(
      <NotificationProvider>
        <div>Test</div>
      </NotificationProvider>,
    );
  });

  it('should throw error if useNotification is used outside provider', () => {
    const BadComponent = () => {
      useNotification();
      return <div>Test</div>;
    };

    expect(() => render(<BadComponent />)).toThrow(
      'useNotification must be used within NotificationProvider',
    );
  });

  it('should create notification via hook', () => {
    render(
      <NotificationProvider>
        <NotificationDisplay />
        <TestComponent />
      </NotificationProvider>,
    );

    const button = screen.getByText('Success');
    act(() => {
      button.click();
    });

    expect(screen.getByText('Test success')).toBeInTheDocument();
  });

  it('should auto-dismiss notification after duration', () => {
    render(
      <NotificationProvider>
        <NotificationDisplay />
        <TestComponent />
      </NotificationProvider>,
    );

    const button = screen.getByText('Success');
    act(() => {
      button.click();
    });

    expect(screen.getByText('Test success')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Test success')).not.toBeInTheDocument();
  });

  it('should dismiss notification manually', () => {
    render(
      <NotificationProvider>
        <NotificationDisplay />
        <TestComponent />
      </NotificationProvider>,
    );

    const button = screen.getByText('Success');
    act(() => {
      button.click();
    });

    const closeButton = screen.getByLabelText('Close notification');
    act(() => {
      closeButton.click();
    });

    expect(screen.queryByText('Test success')).not.toBeInTheDocument();
  });

  it('should apply correct CSS class based on type', () => {
    render(
      <NotificationProvider>
        <NotificationDisplay />
        <TestComponent />
      </NotificationProvider>,
    );

    act(() => {
      screen.getByText('Success').click();
    });

    const notification = screen.getByRole('alert');
    expect(notification).toHaveClass('notification--success');
  });

  it('should keep max 3 notifications', () => {
    render(
      <NotificationProvider>
        <NotificationDisplay />
        <TestComponent />
      </NotificationProvider>,
    );

    const button = screen.getByText('Success');

    act(() => {
      button.click();
      button.click();
      button.click();
      button.click(); // 4th notification
    });

    // Only 3 should be visible
    const notifications = screen.getAllByRole('alert');
    expect(notifications).toHaveLength(3);
  });

  it('should vibrate on success notification', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(window.navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
    });

    render(
      <NotificationProvider>
        <NotificationDisplay />
        <TestComponent />
      </NotificationProvider>,
    );

    act(() => {
      screen.getByText('Success').click();
    });

    expect(vibrateMock).toHaveBeenCalledWith(100);
  });

  it('should show XP notification', () => {
    render(
      <NotificationProvider>
        <NotificationDisplay />
        <TestComponent />
      </NotificationProvider>,
    );

    act(() => {
      screen.getByText('XP').click();
    });

    expect(screen.getByText('Test xp')).toBeInTheDocument();
    const notification = screen.getByRole('alert');
    expect(notification).toHaveClass('notification--xp');
  });
});
