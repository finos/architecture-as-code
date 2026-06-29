// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    alias: {
      // Mock the vscode module for unit tests — pure functions don't need VS Code API
      vscode: new URL('./src/test/__mocks__/vscode.ts', import.meta.url).pathname
    }
  }
});
