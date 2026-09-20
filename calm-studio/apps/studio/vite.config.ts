// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
import path from 'path';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), svelteTesting()],
	server: {
		fs: {
			// npm-workspaces installs some deps (e.g. @sveltejs/kit) into
			// calm-studio/node_modules, outside Vite's default
			// allow root at apps/studio. Allow up to the repo root.
			// Repo root from cwd (calm-studio/apps/studio) = 3 ups.
			allow: [path.resolve('../../..')],
		},
	},
	resolve: {
		alias: {
			// Allow tests to import @calmstudio/calm-core/test-fixtures directly from source.
			// The package.json exports map only exposes '.', so test-fixtures must be aliased here.
			'@calmstudio/calm-core/test-fixtures': path.resolve('../../packages/calm-core/test-fixtures/index.ts'),
			'@finos/calm-shared/generate': path.resolve('../../../shared/src/commands/generate/generate-core.ts'),
			'@finos/calm-shared/validate': path.resolve('../../../shared/src/commands/validate/validate-core.ts'),
			'@finos/calm-shared/document-loader-types': path.resolve('../../../shared/src/document-loader/types.ts'),
			'$calm-release': path.resolve('../../../calm/release'),
			'$calm-draft': path.resolve('../../../calm/draft'),
			// generate-core → SchemaDirectory → logger imports winston (Node). Stub for the browser.
			winston: path.resolve('src/lib/shims/winston.ts'),
		},
		// CodeMirror uses internal symbols + instanceof checks across @codemirror/state,
		// @codemirror/view and @codemirror/language. Multiple module copies break those
		// checks ("Unrecognized extension value in extension set"). Force single instance.
		dedupe: [
			'codemirror',
			'svelte-codemirror-editor',
			'@codemirror/state',
			'@codemirror/view',
			'@codemirror/language',
			'@codemirror/lang-json',
			'@codemirror/lint',
			'@codemirror/theme-one-dark',
		],
	},
	ssr: {
		noExternal: ['@xyflow/svelte']
	},
	optimizeDeps: {
		include: ['ajv', 'ajv-formats'],
		exclude: ['winston'],
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'jsdom',
		globals: true,
		passWithNoTests: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			include: ['src/**/*.ts', 'src/**/*.svelte.ts'],
			exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/tests/e2e/**'],
			thresholds: {
				lines: 60,
				functions: 60,
				branches: 60,
				statements: 60,
			},
		},
	}
});
