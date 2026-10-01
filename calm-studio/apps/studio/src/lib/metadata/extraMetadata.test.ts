// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	extraMetadataEntries,
	upsertExtraMetadata,
	removeExtraMetadata,
} from './extraMetadata';

describe('extraMetadataEntries (R86)', () => {
	it('marks JSON arrays with isArray and pretty value', () => {
		const entries = extraMetadataEntries(
			{ tags: ['a', 'b'], owner: 'team' },
			[['owner']]
		);
		const tags = entries.find((e) => e.key === 'tags');
		expect(tags?.isArray).toBe(true);
		expect(tags?.nested).toBe(true);
		expect(tags?.value).toContain('\n');
		expect(tags?.raw).toEqual(['a', 'b']);
		expect(entries.find((e) => e.key === 'owner')).toBeUndefined();
	});

	it('does not expose reserved keys', () => {
		const entries = extraMetadataEntries(
			{ _layout: { x: 1 }, tags: [] },
			[]
		);
		expect(entries.map((e) => e.key)).toEqual(['tags']);
		expect(entries[0]?.isArray).toBe(true);
	});
});

describe('upsertExtraMetadata', () => {
	it('parses JSON array strings into real arrays', () => {
		const next = upsertExtraMetadata({}, 'tags', '["a","b"]');
		expect(next.tags).toEqual(['a', 'b']);
		expect(Array.isArray(next.tags)).toBe(true);
	});

	it('removeExtraMetadata deletes the key', () => {
		expect(removeExtraMetadata({ tags: ['a'], other: 1 }, 'tags')).toEqual({ other: 1 });
	});
});
