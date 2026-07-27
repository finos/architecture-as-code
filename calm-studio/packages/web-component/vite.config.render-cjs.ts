// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// `render` is a Node-only (no DOM) entry point used by build-time tooling
// (e.g. @finos/calm-docusaurus-plugin's webpack loader, which is bundled as
// CJS). The default `vite.config.ts` only emits an ES module for `render`,
// which is unreachable from a plain Node `require()` call. This config adds
// a CJS build so consumers using `require('@calmstudio/diagram/render')`
// resolve correctly.
export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        customElement: true,
      },
    }),
  ],
  build: {
    emptyOutDir: false, // ES + iife builds already wrote dist/
    lib: {
      entry: 'src/render/index.ts',
      formats: ['cjs'],
      fileName: () => 'render.cjs',
    },
    rollupOptions: {},
  },
});
