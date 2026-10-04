import { defineConfig } from 'vitest/config';
import { canonicalPath, templates } from './vite.config';
export default defineConfig({ plugins: [templates()], resolve: { alias: { '@finos/calm-models/canonical': canonicalPath } }, test: { include: ['src/**/*.test.ts'], coverage: { reportsDirectory: '../../../sandbox/intellij/coverage' } } });
