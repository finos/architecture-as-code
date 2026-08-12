// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect } from 'vitest';
import { relativePathBetween } from '$lib/explorer/relativePath';

describe('relativePathBetween', () => {
	test('same directory', () => {
		expect(relativePathBetween('a/x.json', 'a/y.json')).toBe('y.json');
	});

	test('sibling directories', () => {
		expect(relativePathBetween('arch/a.json', 'data/b.json')).toBe('../data/b.json');
	});

	test('nested target', () => {
		expect(relativePathBetween('root.json', 'sub/nested.json')).toBe('sub/nested.json');
	});

	test('up and across', () => {
		expect(relativePathBetween('a/b/c.json', 'a/d.json')).toBe('../d.json');
	});

	test('target is parent directory file', () => {
		expect(relativePathBetween('a/b/c.json', 'a/b.json')).toBe('../b.json');
	});

	test('root-level files', () => {
		expect(relativePathBetween('a.json', 'b.json')).toBe('b.json');
	});
});
