import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { jsonFromDisk } from './json-from-disk';

export default defineConfig({
    plugins: [jsonFromDisk()],
    json: { stringify: true },
    test: {
        include: ['src/**/*.test.{ts,tsx}'],
        environment: 'node',
        alias: {
            // Mock the vscode module for unit tests — the code under test only
            // touches a small, deterministic slice of the API.
            // fileURLToPath is required on Windows: URL.pathname is `/C:/...`.
            vscode: fileURLToPath(new URL('./src/test/__mocks__/vscode.ts', import.meta.url)),
        },
    },
});
