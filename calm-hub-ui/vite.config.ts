/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    test: {
        globals: true,
        environment: 'jsdom',
        environmentMatchGlobs: [['./src/**/*.tsx', 'jsdom']],
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            provider: 'v8',
        },
    },
    build: {
        outDir: 'build',
    },
    server: {
        proxy: {
            '/calm': 'http://localhost:8080',
        },
    },
});
