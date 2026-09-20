// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { CALM_12_BASE_SCHEMA } from '$lib/stores/documentEnvelope';
import { emptyCalmArchitectureJson } from '$lib/explorer/newFile';
import {
	joinProjectRelative,
	normalizeNewFileName,
	validateFileName,
} from '$lib/explorer/folderName';

describe('new file from tree', () => {
	it('asks for a name and appends .json when missing', () => {
		expect(normalizeNewFileName('coa')).toBe('coa.json');
		expect(normalizeNewFileName('coa.json')).toBe('coa.json');
		expect(normalizeNewFileName('  coa.JSON  ')).toBe('coa.JSON');
	});

	it('rejects path separators and empty names', () => {
		expect(validateFileName('')).toBeTruthy();
		expect(validateFileName('a/b')).toBeTruthy();
		expect(validateFileName('a\\b')).toBeTruthy();
		expect(validateFileName('coa.json')).toBeNull();
	});

	it('writes under the target directory', () => {
		expect(joinProjectRelative('org/c', 'coa.json')).toBe('org/c/coa.json');
		expect(joinProjectRelative('', 'root.json')).toBe('root.json');
	});

	it('uses an empty CALM architecture envelope', () => {
		const parsed = JSON.parse(emptyCalmArchitectureJson()) as {
			$schema: string;
			nodes: unknown[];
			relationships: unknown[];
		};
		expect(parsed.$schema).toBe(CALM_12_BASE_SCHEMA);
		expect(parsed.nodes).toEqual([]);
		expect(parsed.relationships).toEqual([]);
	});
});
