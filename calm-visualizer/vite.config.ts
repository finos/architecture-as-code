/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        environmentMatchGlobs: [['./src/**/*.tsx', 'jsdom']],
        setupFiles: ['./src/tests/vitest.setup.ts'],
    },
});
