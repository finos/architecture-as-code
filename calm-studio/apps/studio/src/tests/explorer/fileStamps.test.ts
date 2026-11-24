// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { changedStampPaths } from '$lib/explorer/fileStamps';

describe('changedStampPaths', () => {
	it('reports added, removed, and modified paths', () => {
		const previous = [
			{ relativePath: 'a.json', modified: 1 },
			{ relativePath: 'b.json', modified: 2 },
		];
		const next = [
			{ relativePath: 'b.json', modified: 3 },
			{ relativePath: 'c.json', modified: 4 },
		];
		expect(changedStampPaths(previous, next).sort()).toEqual(['a.json', 'b.json', 'c.json']);
	});

	it('returns nothing when stamps match', () => {
		const stamps = [{ relativePath: 'a.json', modified: 1 }];
		expect(changedStampPaths(stamps, stamps)).toEqual([]);
	});
});
