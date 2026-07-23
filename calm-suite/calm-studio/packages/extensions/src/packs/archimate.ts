// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { archimateIcons } from '../icons/archimate.js';

const ARCHIMATE_SCHEMA_URL =
	'https://calm.finos.org/extensions/archimate/calm-archimate-extension.schema.json';

const archimateColor: PackColor = {
	bg: '#f5f0ff',
	border: '#8b5cf6',
	stroke: '#7c3aed',
	badge: '[ARCHIMATE]',
};

function node(
	typeId: string,
	label: string,
	iconKey: string,
	description: string,
): PackDefinition['nodes'][number] {
	return {
		typeId,
		label,
		icon: archimateIcons[iconKey] ?? archimateIcons['applicationComponent']!,
		color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
		description,
		rectangleLayout: true,
	};
}

export const archimatePack: PackDefinition = {
	id: 'archimate',
	label: 'Archimate Model',
	version: '1.0.0',
	color: archimateColor,
	schemaUrl: ARCHIMATE_SCHEMA_URL,
	nodes: [
		node('archimate:businessActor', 'Business Actor', 'businessActor', 'Business actor'),
		node('archimate:businessRole', 'Business Role', 'businessRole', 'Business role'),
		node('archimate:businessProcess', 'Business Process', 'businessProcess', 'Business process'),
		node('archimate:dataObject', 'Data Object', 'dataObject', 'Data Object is a collection of data'),
		node('archimate:dataStore', 'Data Store', 'dataStore', 'Data Store is a collection of data'),
		node(
			'archimate:applicationService',
			'Application Service',
			'applicationService',
			'Application Service is a collection of data',
		),
		node(
			'archimate:applicationEvent',
			'Application Event',
			'applicationEvent',
			'Application Event is a collection of data',
		),
		node(
			'archimate:applicationProcess',
			'Application Process',
			'applicationProcess',
			'Application Process is a collection of data',
		),
		node(
			'archimate:applicationInteraction',
			'Application Interaction',
			'applicationInteraction',
			'Application Interaction is a collection of data',
		),
		node(
			'archimate:applicationFunction',
			'Application Function',
			'applicationFunction',
			'Application Function is a collection of data',
		),
		node(
			'archimate:applicationInterface',
			'Application Interface',
			'applicationInterface',
			'Application Interface is a collection of data',
		),
		node(
			'archimate:applicationComponent',
			'Application Component',
			'applicationComponent',
			'Application Component is a collection of data',
		),
		node(
			'archimate:applicationCollaboration',
			'Application Collaboration',
			'applicationCollaboration',
			'Application Collaboration is a collection of data',
		),
		node('archimate:node', 'Node', 'node', 'Technology node'),
		node('archimate:device', 'Device', 'device', 'Device'),
		node('archimate:systemSoftware', 'System Software', 'systemSoftware', 'System software'),
		node(
			'archimate:technologyService',
			'Technology Service',
			'technologyService',
			'Technology service',
		),
		node(
			'archimate:technologyInterface',
			'Technology Interface',
			'technologyInterface',
			'Technology interface',
		),
		node('archimate:artifact', 'Artifact', 'artifact', 'Deployable artifact'),
		node('archimate:path', 'Path', 'path', 'Communication path'),
		node(
			'archimate:communicationNetwork',
			'Communication Network',
			'communicationNetwork',
			'Communication network',
		),
	],
};
