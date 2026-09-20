// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
import path from 'path';
import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
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
