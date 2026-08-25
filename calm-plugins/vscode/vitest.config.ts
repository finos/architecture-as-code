import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.{ts,tsx}'],
        environment: 'node',
        alias: {
            // Mock the vscode module for unit tests — the code under test only
            // touches a small, deterministic slice of the API.
            vscode: new URL('./src/test/__mocks__/vscode.ts', import.meta.url)
                .pathname,
        },
    },
});
