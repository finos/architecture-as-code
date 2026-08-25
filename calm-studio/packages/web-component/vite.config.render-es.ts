// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// `render` is a Node-only (no DOM) entry point used by build-time tooling
// (e.g. @finos/calm-docusaurus-plugin's remark/loader code, which imports it
// as an ES module). Built as its own single-entry bundle so it does not share
// a chunk with the main `calm-diagram.es.js` CDN bundle (see vite.config.ts).
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
      formats: ['es'],
      fileName: () => 'render.es.js',
    },
    rollupOptions: {},
  },
});
