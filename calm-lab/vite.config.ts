/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const shim = (name: string) => fileURLToPath(new URL(`./src/shims/${name}.ts`, import.meta.url));

// @finos/calm-shared/browser's dependency chain requests fs/path/buffer at bundle time but never
// touches fs/path at runtime (see shared/README.md "Browser entry point"). Map them to shims and
// resolve with the browser main field first, exactly as shared's own guard does.
export default defineConfig({
    plugins: [react()],
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        alias: [
            { find: /^(node:)?fs$/, replacement: shim('empty') },
            { find: /^(node:)?path$/, replacement: shim('empty') },
            { find: /^(node:)?buffer$/, replacement: shim('buffer') },
        ],
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    optimizeDeps: {
        include: ['reactflow'],
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx,js,jsx}'],
            exclude: ['src/shims/**', 'src/test-support/**', 'src/main.tsx'],
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
