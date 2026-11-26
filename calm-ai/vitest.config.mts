import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: { include: ['evals/**/*.spec.ts'] },
});
