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
    }
}

export default defineConfig({
    test: {
        globals: true,
        coverage: {
            provider: 'v8',
            ...v8CoverageSettings,
        },
    }
})