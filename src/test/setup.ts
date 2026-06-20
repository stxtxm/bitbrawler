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

    // Polyfill HTMLCanvasElement.prototype.getContext
    if (typeof HTMLCanvasElement.prototype.getContext !== 'function') {
        HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
            fillRect: vi.fn(),
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            arc: vi.fn(),
        });
    }

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
