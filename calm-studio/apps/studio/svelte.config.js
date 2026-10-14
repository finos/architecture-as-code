// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
import path from 'path';
import adapter from '@sveltejs/adapter-static';

/**
 * Empty in dev and in the standalone image (served at `/`).
 * The Hub gateway image sets BASE_PATH=/studio so Studio can share that origin.
 * SvelteKit requires a leading slash and no trailing slash.
 */
function studioBase() {
	const raw = process.env.BASE_PATH || '';
	if (!raw || raw === '/') return '';
	const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
	if (!base.startsWith('/')) {
		throw new Error(`BASE_PATH must be empty or start with / (got ${raw})`);
	}
	return base;
}

const base = studioBase();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		...(base ? { paths: { base } } : {}),
		alias: {
			'@finos/calm-shared/generate': path.resolve('../../../shared/src/commands/generate/generate-core.ts'),
			'@finos/calm-shared/validate': path.resolve('../../../shared/src/commands/validate/validate-core.ts'),
			'@finos/calm-shared/document-loader-types': path.resolve('../../../shared/src/document-loader/types.ts'),
			'$calm-release': path.resolve('../../../calm/release'),
			'$calm-draft': path.resolve('../../../calm/draft'),
			winston: path.resolve('src/lib/shims/winston.ts'),
		}
	}
};

export default config;
