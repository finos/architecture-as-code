import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    reporters: [['verbose', { summary: false }]],
    include: ['src/__tests__/**/*.test.ts'],
  },
});
