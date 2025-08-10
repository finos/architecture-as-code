import { defineConfig } from 'tsup'

export default defineConfig([
    // Extension (Node environment)
    {
        entry: { extension: 'src/extension.ts' },
        platform: 'node',
        target: 'node18',
        format: ['cjs'],
        sourcemap: true,
        clean: true,
        dts: false,
        external: ['vscode'],
        minify: false,
        outDir: 'dist',
    },
    // Webview (Browser environment)
    {
        entry: { 'webview/main': 'src/webview/main.ts' },
        platform: 'browser',
        target: 'es2020',
        format: ['iife'],
        globalName: 'CalmWebview',
        sourcemap: true,
        clean: false,
        dts: false,
        minify: false,
        outDir: 'dist',
    }
])
