// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    alias: {
      // Mock the vscode module for unit tests — pure functions don't need VS Code API
      // fileURLToPath is required on Windows: URL.pathname is `/C:/...`.
      vscode: fileURLToPath(new URL('./src/test/__mocks__/vscode.ts', import.meta.url))
    }
  }
});
