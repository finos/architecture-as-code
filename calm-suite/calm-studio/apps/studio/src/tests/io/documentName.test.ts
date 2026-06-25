// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { readDocumentName, writeDocumentName } from '$lib/io/documentName';
import { finalizeCalmForWrite } from '$lib/io/export';

describe('documentName — persist the title in CALM metadata', () => {
	it('round-trips a name through object-form metadata', () => {
		const meta = writeDocumentName(undefined, 'Payments Platform');
		expect(meta).toEqual({ name: 'Payments Platform' });
		expect(readDocumentName({ metadata: meta as never })).toBe('Payments Platform');
	});

	it('preserves other keys in object-form metadata', () => {
		const meta = writeDocumentName({ owner: 'platform-team' }, 'Payments Platform');
		expect(meta).toEqual({ owner: 'platform-team', name: 'Payments Platform' });
	});

	it('reads and updates a name in array-form metadata, keeping other entries', () => {
		const arr = [{ owner: 'x' }, { name: 'Old Name' }];
		expect(readDocumentName({ metadata: arr as never })).toBe('Old Name');
		const updated = writeDocumentName(arr, 'New Name') as unknown[];
		expect(readDocumentName({ metadata: updated as never })).toBe('New Name');
		expect(updated).toContainEqual({ owner: 'x' }); // other entries kept
	});

	it('returns null when no name is present', () => {
		expect(readDocumentName({ metadata: undefined })).toBeNull();
		expect(readDocumentName({ metadata: { owner: 'x' } as never })).toBeNull();
		expect(readDocumentName({ metadata: [] as never })).toBeNull();
	});

	it('clearing a name drops metadata entirely when it becomes empty', () => {
		expect(writeDocumentName({ name: 'X' }, null)).toBeUndefined();
		expect(writeDocumentName({ name: 'X', owner: 'y' }, '')).toEqual({ owner: 'y' });
	});

	it('finalizeCalmForWrite writes metadata.name and the title survives a re-parse', () => {
		const json = JSON.stringify({ nodes: [], relationships: [] });
		const out = JSON.parse(finalizeCalmForWrite(json, 'Trade Surveillance'));
		expect(out.metadata).toEqual({ name: 'Trade Surveillance' });
		expect(readDocumentName(out)).toBe('Trade Surveillance');
		// undefined name leaves metadata untouched
		const untouched = JSON.parse(finalizeCalmForWrite(json));
		expect(untouched.metadata).toBeUndefined();
	});
});
