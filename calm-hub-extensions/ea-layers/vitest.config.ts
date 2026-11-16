import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.spec.ts', 'src/main.ts'],
            thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
        },
    },
});
