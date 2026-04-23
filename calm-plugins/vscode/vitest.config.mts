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
        // Integration tests run under @vscode/test-electron (Mocha + real VSCode),
        // not vitest. Exclude them from the unit-test run.
        exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', 'test/integration/**'],
        coverage: {
            provider: 'v8',
            ...v8CoverageSettings,
        },
    }
});