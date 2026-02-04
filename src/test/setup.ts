import '@testing-library/jest-dom';
import { beforeAll, afterAll } from 'vitest';

// Suppress expected console.error calls during tests (Firebase error handling)
const originalConsoleError = console.error;

beforeAll(() => {
    console.error = (...args: any[]) => {
        // Suppress expected Firebase error messages during tests
        const message = args[0]?.toString() || '';
        if (message.includes('Firebase error')) {
            return; // Silently ignore expected Firebase errors
        }
        originalConsoleError.apply(console, args);
    };
});

afterAll(() => {
    console.error = originalConsoleError;
});
