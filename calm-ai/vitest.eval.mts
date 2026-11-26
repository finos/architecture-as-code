import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['evals/**/*.eval.ts'],
        testTimeout: 360_000,
        fileParallelism: false,
    },
});
