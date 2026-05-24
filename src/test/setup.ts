import '@testing-library/jest-dom';
import { beforeAll, afterAll, vi } from 'vitest';

const originalConsoleError = console.error;

beforeAll(() => {
    // Suppress expected Supabase error logs
    console.error = (...args: any[]) => {
        const message = args[0]?.toString() || '';
        if (message.includes('Supabase retry failed')) {
            return;
        }
        originalConsoleError.apply(console, args);
    };

    // Polyfill window.matchMedia for jsdom (used by PWA install hook)
    if (typeof window.matchMedia !== 'function') {
        Object.defineProperty(window, 'matchMedia', {
            value: (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }),
            writable: true,
            configurable: true,
        });
    }
});

afterAll(() => {
    console.error = originalConsoleError;
});
