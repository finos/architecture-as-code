// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      // Disable custom elements for testing — jsdom/node don't support them
      compilerOptions: {
        customElement: false,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
