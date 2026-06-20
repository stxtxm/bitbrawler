import '@testing-library/jest-dom';
import { vi, beforeAll } from 'vitest';

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
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    }));
});
