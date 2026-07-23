// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { readMetadataPath, writeMetadataPath, getMetadataFieldsForRelationship } from './metadataForm';

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
