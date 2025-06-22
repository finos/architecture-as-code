import {defineConfig} from 'vitest/config';
import {CoverageV8Options} from "vitest/node";

const v8CoverageSettings: CoverageV8Options = {
    enabled: true,
    reporter: ['text', 'json', 'html'],
    thresholds: {
        branches: 85,
        functions: 75,
        lines: 75,
        statements: 75
    },
    exclude: ['test_fixtures/**'],
    include: ['**/*.ts']
}

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            ...v8CoverageSettings,
        },

    }
})