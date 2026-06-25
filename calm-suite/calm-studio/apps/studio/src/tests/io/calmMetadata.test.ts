// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { getMetadataValue, setMetadataValue } from '$lib/io/calmMetadata';

describe('calmMetadata — keyed get/set over both CALM metadata shapes', () => {
	it('object form: get, set, and remove (empty result drops to undefined)', () => {
		expect(getMetadataValue({ a: 1 }, 'a')).toBe(1);
		expect(getMetadataValue({ a: 1 }, 'missing')).toBeUndefined();
		expect(setMetadataValue({ a: 1 }, 'b', 2)).toEqual({ a: 1, b: 2 });
		expect(setMetadataValue({ a: 1, b: 2 }, 'b', null)).toEqual({ a: 1 });
		expect(setMetadataValue({ a: 1 }, 'a', undefined)).toBeUndefined();
	});

	it('array form: first match wins on read; other entries preserved on write', () => {
		expect(getMetadataValue([{ a: 1 }, { b: 2 }], 'b')).toBe(2);
		expect(getMetadataValue([{ name: 'X' }, { name: 'Y' }], 'name')).toBe('X'); // first wins
		const out = setMetadataValue([{ owner: 'z' }, { name: 'old' }], 'name', 'new') as unknown[];
		expect(out).toContainEqual({ owner: 'z' }); // non-name entry kept
		expect(getMetadataValue(out, 'name')).toBe('new');
		// Removing the only name-bearing entry leaves the rest intact.
		expect(setMetadataValue([{ owner: 'z' }, { name: 'x' }], 'name', null)).toEqual([{ owner: 'z' }]);
	});

	it('tolerates null array entries and non-object metadata', () => {
		expect(getMetadataValue([null, { name: 'X' }] as never, 'name')).toBe('X');
		// null entries (no matching key) are preserved through a write.
		expect(setMetadataValue([null, { name: 'X' }] as never, 'name', 'Y')).toEqual([{ name: 'Y' }, null]);
		// A non-object metadata value is replaced by an object when a key is set.
		expect(setMetadataValue('weird' as never, 'name', 'X')).toEqual({ name: 'X' });
		expect(getMetadataValue(undefined, 'name')).toBeUndefined();
		expect(getMetadataValue('weird' as never, 'name')).toBeUndefined();
	});
});
