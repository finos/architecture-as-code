import { defineConfig } from 'vitest/config'

// Local vitest config so the runner doesn't walk up the directory tree and
// pick up the extension's vitest.config.mts (which lives one folder above
// and depends on different node_modules).
export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
    },
})
