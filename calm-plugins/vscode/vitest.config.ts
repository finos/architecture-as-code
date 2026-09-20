import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { jsonFromDisk } from './json-from-disk';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

export default defineConfig({
    plugins: [jsonFromDisk()],
    json: { stringify: true },
    server: {
        fs: {
            allow: [repoRoot],
        },
    },
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
