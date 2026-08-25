// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts']
  },
  resolve: {
    alias: {
      // Production import is the built mcp file; tests run against source.
      '@calmstudio/mcp/dist/tools/render.js': fileURLToPath(
        new URL('../mcp-server/src/tools/render.ts', import.meta.url)
      ),
    },
  },
});
