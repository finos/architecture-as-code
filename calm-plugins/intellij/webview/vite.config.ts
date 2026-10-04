import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Handlebars from 'handlebars';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const canonicalPath = fileURLToPath(new URL('./vendor/preview-0.6/calm-models/src/canonical/template-models.ts', import.meta.url));
export function templates() {
  return { name: 'precompile-calm-templates', load(id: string) {
    if (!id.endsWith('.hbs')) return;
    return `import H from 'handlebars/runtime'; export default H.template(${Handlebars.precompile(readFileSync(id, 'utf8'))});`;
  } };
}

export default defineConfig({
  plugins: [templates(), react()],
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  resolve: { alias: { '@finos/calm-models/canonical': canonicalPath } },
  build: {
    target: 'es2022',
    lib: { entry: 'src/main.tsx', name: 'CalmPreview', formats: ['iife'], fileName: () => 'index.js' },
    cssCodeSplit: false,
    rollupOptions: { output: { assetFileNames: 'index.[ext]' } },
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});
