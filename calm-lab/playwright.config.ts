import { defineConfig, devices } from '@playwright/test';

// Layout checks that jsdom cannot make. They run against the production build, so build first:
// `npm run build:calm-lab` from the repository root.
export default defineConfig({
    testDir: './e2e',
    forbidOnly: !!process.env.CI,
    use: {
        baseURL: 'http://localhost:4173',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run serve -- --port 4173 --strictPort',
        port: 4173,
        reuseExistingServer: !process.env.CI,
    },
});
