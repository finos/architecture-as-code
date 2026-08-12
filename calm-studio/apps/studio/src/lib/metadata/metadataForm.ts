// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/** Field descriptor for schema-driven metadata forms (R17). */
export interface MetadataFieldDescriptor {
	key: string;
	label: string;
	required: boolean;
	kind: 'string' | 'enum';
	enumValues?: string[];
	/** Dot path for nested values, e.g. `archimate.layer` */
	path: string[];
	readOnly?: boolean;
}

const LIFECYCLE = ['planned', 'active', 'deprecated', 'retired'] as const;
const CRITICALITY = ['low', 'medium', 'high', 'critical'] as const;
const DATA_CLASSIFICATION = ['public', 'internal', 'confidential', 'restricted'] as const;
const LAYERS = ['Business', 'Application', 'Technology', 'Motivation', 'Implementation'] as const;
const VIEWPOINTS = [
	'SystemContext',
	'ApplicationCooperation',
	'ApplicationUsage',
	'InformationStructure',
	'TechnologyDeployment',
	'ImplementationAndMigration',
] as const;

/** ArchiMate node metadata fields derived from calm-archimate-extension.schema.json */
export function getArchimateNodeMetadataFields(nodeType: string): MetadataFieldDescriptor[] {
	return [
		{ key: 'owner', label: 'Owner', required: true, kind: 'string', path: ['owner'] },
		{
			key: 'lifecycle',
			label: 'Lifecycle',
			required: false,
			kind: 'enum',
			enumValues: [...LIFECYCLE],
			path: ['lifecycle'],
		},
		{
			key: 'criticality',
			label: 'Criticality',
			required: false,
			kind: 'enum',
			enumValues: [...CRITICALITY],
			path: ['criticality'],
		},
		{
			key: 'dataClassification',
			label: 'Data classification',
			required: false,
			kind: 'enum',
			enumValues: [...DATA_CLASSIFICATION],
			path: ['dataClassification'],
		},
		{
			key: 'layer',
			label: 'Layer',
			required: true,
			kind: 'enum',
			enumValues: [...LAYERS],
			path: ['archimate', 'layer'],
		},
		{
			key: 'element',
			label: 'Element',
			required: true,
			kind: 'string',
			path: ['archimate', 'element'],
			readOnly: true,
		},
		{
			key: 'viewpoint',
			label: 'Viewpoint',
			required: true,
			kind: 'enum',
			enumValues: [...VIEWPOINTS],
			path: ['archimate', 'viewpoint'],
		},
		{
			key: 'stereotype',
			label: 'Stereotype',
			required: false,
			kind: 'string',
			path: ['archimate', 'stereotype'],
		},
		{
			key: 'color',
			label: 'Color',
			required: false,
			kind: 'string',
			path: ['archimate', 'color'],
		},
	];
}

const ARCHIMATE_RELATIONSHIP_TYPES = [
	'Composition',
	'Aggregation',
	'Assignment',
	'Realization',
	'Serving',
	'Access',
	'Influence',
	'Triggering',
	'Flow',
	'Specialization',
	'Association',
	'Deployment',
] as const;

/** ArchiMate relationship metadata fields from calm-archimate-extension.schema.json */
export function getArchimateRelationshipMetadataFields(): MetadataFieldDescriptor[] {
	return [
		{
			key: 'relationship',
			label: 'ArchiMate relationship',
			required: true,
			kind: 'enum',
			enumValues: [...ARCHIMATE_RELATIONSHIP_TYPES],
			path: ['archimate', 'relationship'],
		},
		{
			key: 'calm-core-variant',
			label: 'CALM core variant',
			required: true,
			kind: 'enum',
			enumValues: ['connects', 'interacts', 'composed-of', 'deployed-in', 'options'],
			path: ['archimate', 'calm-core-variant'],
			readOnly: true,
		},
	];
}

export function getMetadataFieldsForNodeType(calmType: string): MetadataFieldDescriptor[] | null {
	if (calmType.startsWith('archimate:')) {
		return getArchimateNodeMetadataFields(calmType);
	}
	return null;
}

/** Metadata fields for a CALM relationship when either endpoint uses an extension pack. */
export function getMetadataFieldsForRelationship(
	sourceType: string,
	targetType: string,
): MetadataFieldDescriptor[] | null {
	if (sourceType.startsWith('archimate:') || targetType.startsWith('archimate:')) {
		return getArchimateRelationshipMetadataFields();
	}
	return null;
}

export function readMetadataPath(
	metadata: Record<string, unknown> | undefined,
	path: string[],
): string {
	let current: unknown = metadata;
	for (const segment of path) {
		if (typeof current !== 'object' || current === null) return '';
		current = (current as Record<string, unknown>)[segment];
	}
	return typeof current === 'string' ? current : '';
}

export function writeMetadataPath(
	metadata: Record<string, unknown> | undefined,
	path: string[],
	value: string,
): Record<string, unknown> {
	const root = metadata ? structuredClone(metadata) : {};
	let current: Record<string, unknown> = root;
	for (let i = 0; i < path.length - 1; i++) {
		const segment = path[i]!;
		const next = current[segment];
		if (typeof next !== 'object' || next === null || Array.isArray(next)) {
			current[segment] = {};
		}
		current = current[segment] as Record<string, unknown>;
	}
	const leaf = path[path.length - 1]!;
	if (value === '') {
		delete current[leaf];
	} else {
		current[leaf] = value;
	}
	return root;
}
