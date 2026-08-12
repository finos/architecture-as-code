// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	buildRelationshipTypeForVariant,
	resolveVariantSyncFromMetadata,
	writeArchimateRelationshipMetadata,
} from './relationshipVariantSync';

describe('writeArchimateRelationshipMetadata', () => {
	it('binds Serving to interacts calm-core-variant', () => {
		expect(writeArchimateRelationshipMetadata({}, 'Serving')).toEqual({
			archimate: {
				relationship: 'Serving',
				'calm-core-variant': 'interacts',
			},
		});
	});
});

describe('resolveVariantSyncFromMetadata', () => {
	it('returns interacts relationship-type when Serving selected on connects edge', () => {
		const result = resolveVariantSyncFromMetadata(
			{ archimate: { relationship: 'Serving' } },
			'connects',
			'customer',
			'portal',
		);
		expect(result.metadata).toEqual({
			archimate: {
				relationship: 'Serving',
				'calm-core-variant': 'interacts',
			},
		});
		expect(result.relationshipType).toEqual({
			interacts: { actor: 'customer', nodes: ['portal'] },
		});
	});

	it('does not change relationship-type when variant already matches', () => {
		const result = resolveVariantSyncFromMetadata(
			{ archimate: { relationship: 'Serving', 'calm-core-variant': 'interacts' } },
			'interacts',
			'customer',
			'portal',
		);
		expect(result.relationshipType).toBeUndefined();
	});
});

describe('buildRelationshipTypeForVariant', () => {
	it('builds interacts from endpoints', () => {
		expect(buildRelationshipTypeForVariant('interacts', 'a', 'b')).toEqual({
			interacts: { actor: 'a', nodes: ['b'] },
		});
	});
});
