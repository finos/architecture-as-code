// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { readMetadataPath, writeMetadataPath, getMetadataFieldsForRelationship, groupMetadataFields } from './metadataForm';

describe('metadataForm paths', () => {
	it('reads nested archimate fields', () => {
		const metadata = {
			owner: 'team-a',
			archimate: { layer: 'Application', viewpoint: 'ApplicationCooperation' },
		};
		expect(readMetadataPath(metadata, ['archimate', 'layer'])).toBe('Application');
	});

	it('writes nested archimate fields immutably', () => {
		const original = { owner: 'TBD', archimate: { layer: 'Business', element: 'archimate:businessActor', viewpoint: 'SystemContext' } };
		const next = writeMetadataPath(original, ['archimate', 'viewpoint'], 'ApplicationCooperation');
		expect(next.archimate).toEqual({
			layer: 'Business',
			element: 'archimate:businessActor',
			viewpoint: 'ApplicationCooperation',
		});
		expect(original.archimate).toEqual({
			layer: 'Business',
			element: 'archimate:businessActor',
			viewpoint: 'SystemContext',
		});
	});
});

describe('getMetadataFieldsForRelationship', () => {
	it('returns archimate relationship field when either endpoint is archimate', () => {
		const fields = getMetadataFieldsForRelationship('service', 'archimate:applicationComponent');
		expect(fields).toHaveLength(2);
		expect(fields![0]!.key).toBe('relationship');
		expect(fields![1]!.key).toBe('calm-core-variant');
	});

	it('returns null for core-only relationships', () => {
		expect(getMetadataFieldsForRelationship('service', 'database')).toBeNull();
	});
});

describe('groupMetadataFields', () => {
	it('keeps top-level fields inline and groups nested paths for the dialog', () => {
		const grouped = groupMetadataFields([
			{ key: 'owner', label: 'Owner', required: true, kind: 'string', path: ['owner'] },
			{
				key: 'layer',
				label: 'Layer',
				required: true,
				kind: 'enum',
				enumValues: ['Application'],
				path: ['archimate', 'layer'],
			},
			{
				key: 'viewpoint',
				label: 'Viewpoint',
				required: false,
				kind: 'enum',
				enumValues: ['SystemContext'],
				path: ['archimate', 'viewpoint'],
			},
		]);
		expect(grouped.top).toHaveLength(1);
		expect(grouped.top[0]?.key).toBe('owner');
		expect(grouped.nested).toHaveLength(1);
		expect(grouped.nested[0]?.key).toBe('archimate');
		expect(grouped.nested[0]?.fields.map((f) => f.key)).toEqual(['layer', 'viewpoint']);
	});
});
