// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	ARCHIMATE_TO_CALM_VARIANT,
	expectedCalmVariantForArchimateRelationship,
	scaffoldArchimateRelationshipMetadata,
} from './mapping.js';

describe('expectedCalmVariantForArchimateRelationship', () => {
	it('maps Serving to interacts', () => {
		expect(expectedCalmVariantForArchimateRelationship('Serving')).toBe('interacts');
	});

	it('maps Composition to composed-of', () => {
		expect(expectedCalmVariantForArchimateRelationship('Composition')).toBe('composed-of');
	});

	it('maps Association to connects', () => {
		expect(expectedCalmVariantForArchimateRelationship('Association')).toBe('connects');
	});
});

describe('scaffoldArchimateRelationshipMetadata', () => {
	it('includes calm-core-variant derived from relationship', () => {
		expect(scaffoldArchimateRelationshipMetadata('Serving')).toEqual({
			archimate: {
				relationship: 'Serving',
				'calm-core-variant': 'interacts',
			},
		});
	});
});

describe('ARCHIMATE_TO_CALM_VARIANT', () => {
	it('covers all standard ArchiMate relationship names', () => {
		expect(Object.keys(ARCHIMATE_TO_CALM_VARIANT)).toContain('Serving');
		expect(ARCHIMATE_TO_CALM_VARIANT.Serving).toBe('interacts');
	});
});
