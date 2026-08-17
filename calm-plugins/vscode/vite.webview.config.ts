import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react(), tailwindcss()],
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
