import {defineConfig} from 'vitest/config';

const v8CoverageSettings = {
    enabled: true,
    reporter: ['text', 'json', 'html'],
    thresholds: {
        branches: 85,
        functions: 75,
        lines: 75,
        statements: 75
    },
    exclude: ['**/index.ts', '**/*.config.ts', 'test_fixtures/**', 'dist/**'],
    include: ['**/*.ts'],
};

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            ...v8CoverageSettings,
        },
        testTimeout: 20000
    }
});