import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { jsonFromDisk } from './json-from-disk';

export default defineConfig({
    plugins: [jsonFromDisk(), react(), tailwindcss()],
    json: { stringify: true },
    build: {
        target: 'esnext',
        outDir: 'dist/webview',
        rollupOptions: {
            input: resolve(__dirname, 'src/webview/main.tsx'),
            output: {
                entryFileNames: 'index.js',
                assetFileNames: 'index.[ext]',
                format: 'iife',
            },
        },
        cssCodeSplit: false,
        sourcemap: true,
        minify: false,
    },
    define: {
        'process.env': '{}',
    },
});
