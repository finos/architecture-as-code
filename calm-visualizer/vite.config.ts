/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(), 
        nodePolyfills()
    ],
    test: {
        globals: true,
        environment: 'jsdom',
        environmentMatchGlobs: [['./src/**/*.tsx', 'jsdom']],
        setupFiles: ['./src/tests/vitest.setup.ts'],
    },
});
