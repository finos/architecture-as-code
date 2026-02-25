import {defineConfig} from 'vitest/config';

import {CoverageV8Options} from 'vitest/node';

const v8CoverageSettings: CoverageV8Options = {
    enabled: true,
    reporter: ['text', 'json', 'html'],
    thresholds: {
        branches: 85,
        functions: 75,
        lines: 75,
        statements: 75
    },
    exclude: [
        'dist/**',
        '**/*.d.ts',
        'test_fixtures/**',
        '*.config.ts',
        'src/test-utils/fixture-loader.ts',
    ],
    include: ['src/**/*.ts'],
};

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            ...v8CoverageSettings,
        },
        testTimeout: 2000000
    }
});