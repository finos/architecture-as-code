// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { fluxnovaIcons } from '../icons/fluxnova.js';

const fluxnovaColor: PackColor = {
	bg: '#fff7ed',
	border: '#f97316',
	stroke: '#ea580c',
	badge: '[FN]',
};

function node(
	typeId: string,
	label: string,
	iconKey: string,
	description: string,
	opts?: { isContainer?: boolean; defaultChildren?: string[] },
): PackDefinition['nodes'][number] {
	return {
		typeId,
		label,
		icon: fluxnovaIcons[iconKey] ?? fluxnovaIcons['engine']!,
		color: fluxnovaColor,
		description,
		...(opts?.isContainer ? { isContainer: true } : {}),
		...(opts?.defaultChildren ? { defaultChildren: opts.defaultChildren } : {}),
	};
}

export const fluxnovaPack: PackDefinition = {
	id: 'fluxnova',
	label: 'FluxNova',
	version: '1.0.0',
	color: fluxnovaColor,
	nodes: [
		node('fluxnova:engine', 'BPM Engine', 'engine', 'FluxNova BPMN 2.0 process execution engine'),
		node(
			'fluxnova:rest-api',
			'REST API',
			'rest-api',
			'FluxNova REST API layer (200+ endpoints, OpenAPI)',
		),
		node('fluxnova:cockpit', 'Cockpit', 'cockpit', 'Process monitoring and operations dashboard'),
		node(
			'fluxnova:admin',
			'Admin',
			'admin',
			'User/group/tenant management and authorization console',
		),
		node(
			'fluxnova:tasklist',
			'Tasklist',
			'tasklist',
			'Task assignment and lifecycle management UI',
		),
		node('fluxnova:modeler', 'Modeler', 'modeler', 'BPMN/DMN visual modeling tool'),
		node(
			'fluxnova:external-task-worker',
			'External Task Worker',
			'external-task-worker',
			'Polyglot service that polls and executes external tasks',
		),
		node(
			'fluxnova:dmn-engine',
			'DMN Engine',
			'dmn-engine',
			'Decision Model and Notation rules engine',
		),
		node(
			'fluxnova:process-db',
			'Process Database',
			'process-db',
			'Persistent store for process state, history, and audit logs',
		),
		node(
			'fluxnova:platform',
			'FluxNova Platform',
			'platform',
			'Container for the full FluxNova deployment',
			{
				isContainer: true,
				defaultChildren: [
					'fluxnova:engine',
					'fluxnova:rest-api',
					'fluxnova:cockpit',
					'fluxnova:admin',
				],
			},
		),
	],
};
