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
    lib: {
      entry: 'src/index.ts',
      name: 'CalmDiagram',
      formats: ['es', 'iife'],
      fileName: (format) => `calm-diagram.${format}.js`,
    },
    // Bundle everything — zero-dependency CDN use
    rollupOptions: {},
  },
});
