// SPDX-FileCopyrightText: 2026 CalmStudio contributors
//
// SPDX-License-Identifier: Apache-2.0

/** ArchiMate layer values from calm-archimate-extension.schema.json */
export type ArchimateLayer = 'Business' | 'Application' | 'Technology' | 'Motivation' | 'Implementation';

/** ArchiMate viewpoint values from calm-archimate-extension.schema.json */
export type ArchimateViewpoint =
	| 'SystemContext'
	| 'ApplicationCooperation'
	| 'ApplicationUsage'
	| 'InformationStructure'
	| 'TechnologyDeployment'
	| 'ImplementationAndMigration';

const DATA_ELEMENT_TYPES = new Set(['archimate:dataObject', 'archimate:dataStore']);

const TECHNOLOGY_NODE_TYPES = new Set([
	'archimate:node',
	'archimate:device',
	'archimate:systemSoftware',
	'archimate:artifact',
	'archimate:path',
	'archimate:communicationNetwork',
]);

/**
 * Resolve default `layer` and `viewpoint` for an ArchiMate node type (PRD #14).
 */
export function resolveArchimateLayerViewpoint(nodeType: string): {
	layer: ArchimateLayer;
	viewpoint: ArchimateViewpoint;
} {
	if (nodeType.startsWith('archimate:business')) {
		return { layer: 'Business', viewpoint: 'SystemContext' };
	}
	if (DATA_ELEMENT_TYPES.has(nodeType)) {
		return { layer: 'Application', viewpoint: 'InformationStructure' };
	}
	if (nodeType.startsWith('archimate:application')) {
		return { layer: 'Application', viewpoint: 'ApplicationCooperation' };
	}
	if (
		nodeType.startsWith('archimate:technology') ||
		TECHNOLOGY_NODE_TYPES.has(nodeType)
	) {
		return { layer: 'Technology', viewpoint: 'TechnologyDeployment' };
	}
	return { layer: 'Application', viewpoint: 'ApplicationCooperation' };
}

/** Scaffold required `metadata` for a new ArchiMate node. */
export function scaffoldArchimateNodeMetadata(nodeType: string): Record<string, unknown> {
	const { layer, viewpoint } = resolveArchimateLayerViewpoint(nodeType);
	return {
		owner: 'TBD',
		archimate: {
			layer,
			element: nodeType,
			viewpoint,
		},
	};
}
