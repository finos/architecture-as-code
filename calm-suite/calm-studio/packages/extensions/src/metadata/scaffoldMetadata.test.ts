// SPDX-FileCopyrightText: 2026 CalmStudio contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { scaffoldNodeMetadata, scaffoldRelationshipMetadata } from './scaffoldMetadata.js';

describe('scaffoldNodeMetadata', () => {
	it('scaffolds archimate node metadata', () => {
		expect(scaffoldNodeMetadata('archimate:applicationComponent')).toEqual({
			owner: 'TBD',
			archimate: {
				layer: 'Application',
				element: 'archimate:applicationComponent',
				viewpoint: 'ApplicationCooperation',
			},
		});
	});

	it('returns undefined for core types', () => {
		expect(scaffoldNodeMetadata('service')).toBeUndefined();
	});
});

describe('scaffoldRelationshipMetadata', () => {
	it('scaffolds archimate relationship when either endpoint is archimate', () => {
		expect(scaffoldRelationshipMetadata('service', 'archimate:node')).toEqual({
			archimate: {
				relationship: 'Association',
				'calm-core-variant': 'connects',
			},
		});
	});

	it('returns undefined when neither endpoint is archimate', () => {
		expect(scaffoldRelationshipMetadata('service', 'database')).toBeUndefined();
	});
});
