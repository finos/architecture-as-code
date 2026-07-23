// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'tsup';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANONICAL_META = resolve(__dirname, '../../../../calm/release/1.2/meta');
const DEST = resolve(__dirname, 'dist/schemas');

const SCHEMA_FILES = [
	'calm.json',
	'core.json',
	'control.json',
	'control-requirement.json',
	'interface.json',
	'flow.json',
	'evidence.json',
	'units.json',
];

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	sourcemap: true,
	splitting: false,
	treeshake: true,
	external: ['ajv', 'ajv-formats'],
	onSuccess: async () => {
		mkdirSync(DEST, { recursive: true });
		for (const f of SCHEMA_FILES) {
			cpSync(resolve(CANONICAL_META, f), resolve(DEST, f));
		}
	},
});
