import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setNavigatorOnline = (onLine: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: onLine
  });
};

describe('lazyPages', () => {
  let onLineDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.resetModules();
    onLineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
  });

  afterEach(() => {
    if (onLineDescriptor) {
      Object.defineProperty(window.navigator, 'onLine', onLineDescriptor);
    }
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns false from canPrefetch when browser is offline', async () => {
    setNavigatorOnline(false);
    const { canPrefetch } = await import('../../routes/lazyPages');
    expect(canPrefetch()).toBe(false);
  });

  it('returns true from canPrefetch when browser is online', async () => {
    setNavigatorOnline(true);
    const { canPrefetch } = await import('../../routes/lazyPages');
    expect(canPrefetch()).toBe(true);
  });

  it('does not preload Arena page while offline', async () => {
    const loadArenaModule = vi.fn();
    setNavigatorOnline(false);
    vi.doMock('../../pages/Arena', () => {
      loadArenaModule();
      return { default: () => null };
    });

    const { prefetchArena } = await import('../../routes/lazyPages');
    await prefetchArena();

    expect(loadArenaModule).not.toHaveBeenCalled();
  });

  it('preloads Arena page while online', async () => {
    const loadArenaModule = vi.fn();
    setNavigatorOnline(true);
    vi.doMock('../../pages/Arena', () => {
      loadArenaModule();
      return { default: () => null };
    });

    const { prefetchArena } = await import('../../routes/lazyPages');
    await prefetchArena();

    expect(loadArenaModule).toHaveBeenCalledTimes(1);
  });
});
