import '@testing-library/jest-dom';
import { vi, beforeAll, beforeEach } from 'vitest';

// Mock robuste pour Canvas
class MockCanvasContext {
    fillRect = vi.fn();
    clearRect = vi.fn();
    beginPath = vi.fn();
    moveTo = vi.fn();
    lineTo = vi.fn();
    closePath = vi.fn();
    fill = vi.fn();
    stroke = vi.fn();
    arc = vi.fn();
    quadraticCurveTo = vi.fn();
    fillText = vi.fn();
    measureText = vi.fn(() => ({ width: 0 }));
    save = vi.fn();
    restore = vi.fn();
    translate = vi.fn();
    rotate = vi.fn();
    scale = vi.fn();
    createLinearGradient = vi.fn().mockReturnValue({ addColorStop: vi.fn() });
}

// Définition globale
(global as any).CanvasRenderingContext2D = MockCanvasContext;

beforeAll(() => {
    // Polyfill HTMLCanvasElement
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextType) => {
        if (contextType === '2d') {
            return new MockCanvasContext();
        }
        return null;
    });

    // Polyfill window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });

    // Polyfill IntersectionObserver
    window.IntersectionObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    }));

    // Polyfill ResizeObserver
    // Must be re-applied on each test because vi.restoreAllMocks in some test
    // files (like app-offline-routing, terrain-canvas) can wipe the polyfill
    ensureResizeObserver();
});

beforeEach(() => {
    // Re-apply ResizeObserver before each test as a safety net, since
    // vi.restoreAllMocks() in afterEach of some tests restores it to undefined
    ensureResizeObserver();
});

function ensureResizeObserver() {
    if (typeof window.ResizeObserver === 'undefined') {
        window.ResizeObserver = vi.fn(() => ({
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
        }));
    }
}
