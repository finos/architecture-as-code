// SPDX-FileCopyrightText: 2026 CalmStudio contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	resolveArchimateLayerViewpoint,
	scaffoldArchimateNodeMetadata,
} from './archimateMetadataDefaults.js';

describe('resolveArchimateLayerViewpoint', () => {
	it('maps business types to Business / SystemContext', () => {
		expect(resolveArchimateLayerViewpoint('archimate:businessActor')).toEqual({
			layer: 'Business',
			viewpoint: 'SystemContext',
		});
	});

	it('maps application types to Application / ApplicationCooperation', () => {
		expect(resolveArchimateLayerViewpoint('archimate:applicationComponent')).toEqual({
			layer: 'Application',
			viewpoint: 'ApplicationCooperation',
		});
	});

	it('maps data types to Application / InformationStructure', () => {
		expect(resolveArchimateLayerViewpoint('archimate:dataObject')).toEqual({
			layer: 'Application',
			viewpoint: 'InformationStructure',
		});
	});

	it('maps technology types to Technology / TechnologyDeployment', () => {
		expect(resolveArchimateLayerViewpoint('archimate:node')).toEqual({
			layer: 'Technology',
			viewpoint: 'TechnologyDeployment',
		});
	});
});

describe('scaffoldArchimateNodeMetadata', () => {
	it('includes owner, element, layer, and viewpoint', () => {
		expect(scaffoldArchimateNodeMetadata('archimate:applicationService')).toEqual({
			owner: 'TBD',
			archimate: {
				layer: 'Application',
				element: 'archimate:applicationService',
				viewpoint: 'ApplicationCooperation',
			},
		});
	});
});
