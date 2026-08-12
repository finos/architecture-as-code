// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import {
	normalizeProjectRelative,
	resolveDetailedArchitecture,
} from '$lib/reference/resolveReference';

describe('resolveReference', () => {
	test('normalizeProjectRelative resolves parent segments', () => {
		expect(normalizeProjectRelative('arch/../data/x.json')).toBe('data/x.json');
	});

	test('normalizeProjectRelative detects escape above root', () => {
		expect(normalizeProjectRelative('../outside.json')).toBe('..');
	});

	test('resolveDetailedArchitecture treats http as external', () => {
		const result = resolveDetailedArchitecture('arch/a.json', 'https://example.com/x.json');
		expect(result).toEqual({ kind: 'external', url: 'https://example.com/x.json' });
	});

	test('resolveDetailedArchitecture resolves in-project relative path', () => {
		const result = resolveDetailedArchitecture('arch/a.json', '../data/b.json');
		expect(result).toEqual({ kind: 'in-project', relativePath: 'data/b.json' });
	});

	test('resolveDetailedArchitecture flags outside-project when path escapes root', () => {
		const result = resolveDetailedArchitecture('arch/a.json', '../../outside/b.json');
		expect(result.kind).toBe('outside-project');
	});
});
