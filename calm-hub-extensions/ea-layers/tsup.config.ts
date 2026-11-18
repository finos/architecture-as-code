import { defineConfig } from 'tsup';

// One file with no dependencies, so the image needs no node_modules.
export default defineConfig({
    entry: ['src/main.ts'],
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    clean: true,
    bundle: true,
});
