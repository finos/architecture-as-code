import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
export default defineConfig({
  testDir: './tests',
  outputDir: '../../../sandbox/intellij/browser-results',
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome', viewport: { width: 1200, height: 800 } },
  webServer: { cwd: repositoryRoot, command: 'npm run dev --workspace calm-plugins/intellij/webview -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
});
