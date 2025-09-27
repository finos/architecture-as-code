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
        // Bundle runtime dependencies into the extension so the installed VSIX does
        // not rely on node_modules being present in the target environment.
        // Keep 'vscode' external (provided by the host).
        external: ['vscode'],
        noExternal: [
            'yaml',
            'lodash',
            '@finos/calm-shared',
            '@finos/calm-models',
            'markdown-it',
            'mermaid',
            'jsdom'
        ],
        minify: false,
        outDir: 'dist',
    },
    // Webview (Browser environment)
    {
        entry: { 'webview/main': 'src/features/preview/webview/main.ts' },
        platform: 'browser',
        target: 'es2020',
        format: ['iife'],
        globalName: 'CalmWebview',
        sourcemap: true,
        clean: false,
        dts: false,
        minify: false,
        outDir: 'dist'
    }
])
