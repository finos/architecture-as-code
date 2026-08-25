// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      // Tests import source; the published export points at dist.
      '@calmstudio/diagram/render': fileURLToPath(
        new URL('../web-component/src/render/index.ts', import.meta.url)
      ),
    },
  },
});
