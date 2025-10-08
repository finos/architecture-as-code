import {defineConfig} from 'vitest/config';
import {CoverageV8Options} from 'vitest/node';

const v8CoverageSettings: CoverageV8Options = {
    enabled: true,
    reporter: ['text', 'json', 'html'],
    exclude: ['**/*.spec.ts', '**/*.test.ts', 'dist/**', 'node_modules/**', '*.config.ts'],
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
    }
});