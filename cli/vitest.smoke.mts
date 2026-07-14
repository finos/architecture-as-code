import { defineConfig } from 'vitest/config';

// Smoke tests drive the packed CLI against a real, Docker-hosted CalmHub.
// They are slow and stateful, so: no coverage, long timeouts, one file at a
// time (a single shared hub is started in global-setup.ts).
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['smoke/**/*.smoke.spec.ts'],
        testTimeout: 120_000,
        hookTimeout: 240_000,
        fileParallelism: false,
        pool: 'forks',
        globalSetup: ['./smoke/global-setup.ts'],
    },
});
