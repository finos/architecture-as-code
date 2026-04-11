// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
import path from 'path';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), svelteTesting()],
	resolve: {
		alias: {
			// Allow tests to import @calmstudio/calm-core/test-fixtures directly from source.
			// The package.json exports map only exposes '.', so test-fixtures must be aliased here.
			'@calmstudio/calm-core/test-fixtures': path.resolve('../../packages/calm-core/test-fixtures/index.ts'),
		},
	},
	ssr: {
		noExternal: ['@xyflow/svelte']
	},
	optimizeDeps: {
		include: ['ajv', 'ajv-formats'],
		exclude: [
			'svelte-codemirror-editor',
			'codemirror',
			'@codemirror/view',
			'@codemirror/state',
			'@codemirror/lang-json',
			'@codemirror/lint',
			'@codemirror/theme-one-dark',
		]
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
