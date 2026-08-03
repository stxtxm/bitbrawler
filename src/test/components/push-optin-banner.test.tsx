import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PushOptInBanner } from '../../components/PushOptInBanner';
import {
  isPushSupported,
  requestPermission,
  subscribePush,
  serializeSubscription,
} from '../../utils/pushNotifications';
import { useNotification } from '../../hooks/useNotification';

vi.mock('../../hooks/useNotification', () => ({
  useNotification: vi.fn(),
}));

vi.mock('../../utils/pushNotifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/pushNotifications')>();
  return {
    ...actual,
    isPushSupported: vi.fn(),
    requestPermission: vi.fn(),
    subscribePush: vi.fn(),
    serializeSubscription: vi.fn(),
  };
});

const mockUseNotification = useNotification as unknown as ReturnType<typeof vi.fn>;
const mockIsPushSupported = isPushSupported as unknown as ReturnType<typeof vi.fn>;
const mockRequestPermission = requestPermission as unknown as ReturnType<typeof vi.fn>;
const mockSubscribePush = subscribePush as unknown as ReturnType<typeof vi.fn>;
const mockSerializeSubscription = serializeSubscription as unknown as ReturnType<typeof vi.fn>;

const DISMISS_KEY = 'pushOptInDismissed';

const subscription = {
  endpoint: 'https://push.example.com/sub',
  p256dh: 'p256dh',
  auth: 'auth',
};

const setPermission = (permission: NotificationPermission | undefined) => {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: permission !== undefined ? { permission } : undefined,
  });
};

const setServiceWorkerSupport = (has: boolean) => {
  if (has) {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({}) },
    });
  } else {
    delete (window.navigator as { serviceWorker?: unknown }).serviceWorker;
  }
};

describe('PushOptInBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setPermission('default');
    setServiceWorkerSupport(true);
    mockIsPushSupported.mockReturnValue(true);
    mockUseNotification.mockReturnValue({ notify: vi.fn() });
    mockSerializeSubscription.mockReturnValue(subscription);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    setPermission(undefined);
    setServiceWorkerSupport(false);
  });

  it('renders nothing when push is not supported', () => {
    mockIsPushSupported.mockReturnValue(false);
    render(<PushOptInBanner onSubscribe={vi.fn()} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders nothing when permission is already granted', () => {
    setPermission('granted');
    render(<PushOptInBanner onSubscribe={vi.fn()} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders nothing when permission is denied', () => {
    setPermission('denied');
    render(<PushOptInBanner onSubscribe={vi.fn()} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders nothing when previously dismissed', () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    render(<PushOptInBanner onSubscribe={vi.fn()} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders the banner when supported and permission is default', () => {
    render(<PushOptInBanner onSubscribe={vi.fn()} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByText('Se rappeler de moi')).toBeInTheDocument();
  });

  it('renders both action buttons', () => {
    render(<PushOptInBanner onSubscribe={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /Se rappeler de moi/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plus tard' })).toBeInTheDocument();
  });

  it('dismisses and persists localStorage when clicking Plus tard', () => {
    render(<PushOptInBanner onSubscribe={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('requests permission and reports the subscription on accept', async () => {
    mockRequestPermission.mockResolvedValue('granted');
    const ready = { done: true };
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(ready) },
    });
    const onSubscribe = vi.fn();
    render(<PushOptInBanner onSubscribe={onSubscribe} />);

    fireEvent.click(screen.getByRole('button', { name: /Se rappeler de moi/ }));

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
      expect(mockSubscribePush).toHaveBeenCalledWith(ready);
      expect(mockSerializeSubscription).toHaveBeenCalled();
      expect(onSubscribe).toHaveBeenCalledWith(subscription);
    });
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('does not subscribe when permission is not granted', async () => {
    mockRequestPermission.mockResolvedValue('denied');
    render(<PushOptInBanner onSubscribe={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Se rappeler de moi/ }));

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    });
    expect(mockSubscribePush).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('shows a success toast after subscribing', async () => {
    mockRequestPermission.mockResolvedValue('granted');
    const notify = vi.fn();
    mockUseNotification.mockReturnValue({ notify });
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({}) },
    });
    render(<PushOptInBanner onSubscribe={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Se rappeler de moi/ }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(expect.stringContaining('🔔'), 'success', 3000);
    });
  });
});