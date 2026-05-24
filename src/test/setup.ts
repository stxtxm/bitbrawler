import '@testing-library/jest-dom';
import { beforeAll, afterAll } from 'vitest';

const originalConsoleError = console.error;

beforeAll(() => {
    console.error = (...args: any[]) => {
        const message = args[0]?.toString() || '';
        if (message.includes('Supabase retry failed')) {
            return;
        }
        originalConsoleError.apply(console, args);
    };
});

afterAll(() => {
    console.error = originalConsoleError;
});
