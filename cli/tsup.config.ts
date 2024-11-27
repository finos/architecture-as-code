

import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    sourcemap: false,
    clean: true,
    external: ['canvas', 'fsevents', /node_modules/],
    noExternal: ['@finos/calm-shared', /tsup/],
    bundle: true,
    splitting: false,
    minify: false,
    shims: true,
    target: 'es2021',
    treeshake: true
});