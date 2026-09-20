import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const srcPacks = resolve(repoRoot, 'extensions/packs');
const destPacks = resolve(here, 'dist/extensions/packs');

function copyFallbackPacks() {
  if (!existsSync(srcPacks)) {
    console.warn('[esbuild] bundled extension packs not found at', srcPacks);
    return;
  }
  mkdirSync(destPacks, { recursive: true });
  cpSync(srcPacks, destPacks, { recursive: true });
}

copyFallbackPacks();

const ctx = await esbuild.context({
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
  console.log('[esbuild] watching extension...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
