// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        customElement: true,
      },
    }),
  ],
  build: {
    emptyOutDir: false, // ES build already wrote dist/
    lib: {
      entry: 'src/index.ts',
      name: 'CalmDiagram',
      formats: ['iife'],
      fileName: () => 'calm-diagram.iife.js',
    },
    rollupOptions: {},
  },
});
