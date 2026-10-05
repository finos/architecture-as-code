// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { opengrisIcons } from '../icons/opengris.js';

const opengrisColor: PackColor = {
	bg: '#f0fdf4',
	border: '#16a34a',
	stroke: '#15803d',
	badge: '[OGRIS]',
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
		icon: opengrisIcons[iconKey] ?? opengrisIcons['scheduler']!,
		color: opengrisColor,
		description,
		...(opts?.isContainer ? { isContainer: true } : {}),
		...(opts?.defaultChildren ? { defaultChildren: opts.defaultChildren } : {}),
	};
}

export const openGrisPack: PackDefinition = {
	id: 'opengris',
	label: 'OpenGRIS',
	version: '1.0.0',
	color: opengrisColor,
	nodes: [
		node(
			'opengris:scheduler',
			'Scheduler',
			'scheduler',
			'Central hub that routes tasks from clients to available workers via Cap\'n Proto/ZeroMQ',
		),
		node(
			'opengris:worker',
			'Worker',
			'worker',
			'Executes distributed tasks assigned by the scheduler; runs on GNU/Linux',
		),
		node(
			'opengris:worker-manager',
			'Worker Manager',
			'worker-manager',
			'Provisions and terminates workers on demand via adapters (Baremetal, AWS Batch, AWS ECS, IBM Symphony)',
			{ isContainer: true },
		),
		node(
			'opengris:client',
			'Client',
			'client',
			'Submits tasks to the scheduler and retrieves results; cross-platform (Windows/Linux)',
		),
		node(
			'opengris:object-storage',
			'Object Storage',
			'object-storage',
			'Stores serialized task arguments and results; C++ implementation for performance',
		),
		node(
			'opengris:cluster',
			'Cluster',
			'cluster',
			'Container grouping a full Scaler deployment (scheduler, workers, object storage)',
			{
				isContainer: true,
				defaultChildren: ['opengris:scheduler', 'opengris:worker', 'opengris:object-storage'],
			},
		),
		node(
			'opengris:task-graph',
			'Task Graph',
			'task-graph',
			'DAG-based task dependency graph from opengris-pargraph; nodes are functions, edges are data dependencies',
		),
		node(
			'opengris:parallel-function',
			'Parallel Function',
			'parallel-function',
			'Function decorated with @parallel from opengris-parfun executing via map-reduce across worker pool',
		),
	],
};
