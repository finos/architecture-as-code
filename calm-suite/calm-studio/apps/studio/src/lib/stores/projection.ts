// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * projection.ts — Pure bidirectional projection functions between CalmArchitecture and Svelte Flow.
 *
 * calmToFlow: converts a CalmArchitecture into Svelte Flow nodes[] and edges[].
 * flowToCalm: converts Svelte Flow nodes[] and edges[] back to CalmArchitecture.
 *
 * IMPORTANT: This file must NOT import from .svelte.ts files (not testable in vitest without
 * additional Svelte transform setup). Only imports types from @xyflow/svelte and @calmstudio/calm-core,
 * and the pure resolveNodeType function.
 */

import type { Node, Edge } from '@xyflow/svelte';
import type { CalmArchitecture, CalmControls, CalmInterface, CalmNode, CalmRelationship } from '@calmstudio/calm-core';
import { resolveNodeType } from '$lib/canvas/nodeTypes';

/** The set of CALM edge types that imply containment. */
const CONTAINMENT_EDGE_TYPES = new Set(['deployed-in', 'composed-of']);

/**
 * Converts a CalmArchitecture into Svelte Flow nodes and edges.
 *
 * @param arch - The CALM architecture to project.
 * @param positionMap - Optional map of node unique-id to {x, y} position.
 *   Known nodes use their stored position; unknown nodes get staggered defaults.
 * @returns { nodes, edges } ready for use with SvelteFlow.
 */
export function calmToFlow(
	arch: CalmArchitecture,
	positionMap?: Map<string, { x: number; y: number; width?: number; height?: number }>
): { nodes: Node[]; edges: Edge[] } {
	// Build containment map from relationships:
	// For deployed-in: source is deployed IN destination → destination is parent
	// For composed-of: source is composed OF destination → source is parent
	const childToParent = new Map<string, string>();
	const parentChildren = new Map<string, Set<string>>();

	for (const rel of arch.relationships) {
		if (!CONTAINMENT_EDGE_TYPES.has(rel['relationship-type'])) continue;

		let parentId: string;
		let childId: string;

		if (rel['relationship-type'] === 'deployed-in') {
			// source is deployed inside destination
			parentId = rel.destination;
			childId = rel.source;
		} else {
			// composed-of: source contains destination
			parentId = rel.source;
			childId = rel.destination;
		}

		childToParent.set(childId, parentId);
		if (!parentChildren.has(parentId)) {
			parentChildren.set(parentId, new Set());
		}
		parentChildren.get(parentId)!.add(childId);
	}

	// Compute nesting depth for each node (for zIndex)
	function getDepth(nodeId: string): number {
		let depth = 0;
		let current = nodeId;
		while (childToParent.has(current)) {
			depth++;
			current = childToParent.get(current)!;
		}
		return depth;
	}

	// All nodes that are parents
	const parentIds = new Set(parentChildren.keys());

	const nodes: Node[] = arch.nodes.map((cn: CalmNode, idx: number) => {
		const isParent = parentIds.has(cn['unique-id']);
		const parentId = childToParent.get(cn['unique-id']);
		const depth = getDepth(cn['unique-id']);

		const posEntry = positionMap?.get(cn['unique-id']);
		const position = posEntry ? { x: posEntry.x, y: posEntry.y } : { x: 100 + idx * 160, y: 100 };

		const type = isParent ? 'container' : resolveNodeType(cn['node-type']);
		const node: Node = {
			id: cn['unique-id'],
			type,
			position,
			data: {
				label: cn.name,
				calmId: cn['unique-id'],
				calmType: cn['node-type'],
				description: cn.description ?? '',
				interfaces: cn.interfaces ?? [],
				customMetadata: cn.customMetadata ?? {},
				controls: cn.controls,
				'data-classification': cn['data-classification'],
				metadata: cn.metadata,
			},
		};

		// Apply containment: set parentId and extent for child nodes
		if (parentId) {
			node.parentId = parentId;
			node.extent = 'parent';
			node.zIndex = depth;
		}

		// Container nodes: use ELK-computed dimensions or defaults
		if (type === 'container') {
			node.width = posEntry?.width ?? 300;
			node.height = posEntry?.height ?? 200;
		}
		return node;
	});

	// Svelte Flow requires parent nodes to appear before their children in the array.
	// Sort by depth so top-level nodes come first.
	nodes.sort((a, b) => getDepth(a.id) - getDepth(b.id));

	const edges: Edge[] = arch.relationships.map((cr: CalmRelationship) => ({
		id: cr['unique-id'],
		source: cr.source,
		target: cr.destination,
		type: cr['relationship-type'],
		data: {
			protocol: cr.protocol,
			description: cr.description,
			controls: cr.controls,
			metadata: cr.metadata,
		},
	}));

	return { nodes, edges };
}

/**
 * Converts Svelte Flow nodes and edges back to a CalmArchitecture.
 *
 * Reads all CALM fields from node.data and edge.data/type.
 * Preserves customMetadata from node.data.customMetadata.
 *
 * @param nodes - Svelte Flow nodes (must have data.calmId, data.calmType, data.label)
 * @param edges - Svelte Flow edges (must have id, source, target, type)
 * @returns A CalmArchitecture with nodes and relationships reconstructed.
 */
export function flowToCalm(nodes: Node[], edges: Edge[]): CalmArchitecture {
	// Build a lookup from Svelte Flow node ID to CALM unique-id (calmId).
	// These differ when nodes are created in the editor (separate nanoids).
	const flowIdToCalmId = new Map<string, string>();
	for (const n of nodes) {
		const calmId = (n.data as { calmId?: string })?.calmId;
		if (calmId) {
			flowIdToCalmId.set(n.id, calmId);
		}
	}

	const calmNodes: CalmNode[] = nodes.map((n: Node) => {
		const d = n.data as {
			calmId: string;
			calmType: string;
			label: string;
			description?: string;
			interfaces?: CalmInterface[];
			customMetadata?: Record<string, string>;
			controls?: CalmControls;
			'data-classification'?: string;
			metadata?: Record<string, unknown>;
		};

		const node: CalmNode = {
			'unique-id': d.calmId,
			'node-type': d.calmType,
			name: d.label,
		};

		if (d.description) {
			node.description = d.description;
		}

		if (d.interfaces && d.interfaces.length > 0) {
			node.interfaces = d.interfaces;
		}

		if (d.customMetadata && Object.keys(d.customMetadata).length > 0) {
			node.customMetadata = d.customMetadata;
		}

		if (d.controls && Object.keys(d.controls).length > 0) {
			node.controls = d.controls;
		}

		if (d['data-classification']) {
			node['data-classification'] = d['data-classification'];
		}

		if (d.metadata && Object.keys(d.metadata).length > 0) {
			node.metadata = d.metadata;
		}

		return node;
	});

	const calmRelationships: CalmRelationship[] = edges.map((e: Edge) => {
		const edgeData = (e.data ?? {}) as {
			protocol?: string;
			description?: string;
			controls?: CalmControls;
			metadata?: Record<string, unknown>;
		};

		const rel: CalmRelationship = {
			'unique-id': e.id,
			'relationship-type': (e.type ?? 'connects') as CalmRelationship['relationship-type'],
			source: flowIdToCalmId.get(e.source) ?? e.source,
			destination: flowIdToCalmId.get(e.target) ?? e.target,
		};

		if (edgeData.protocol) {
			rel.protocol = edgeData.protocol;
		}

		if (edgeData.description) {
			rel.description = edgeData.description;
		}

		if (edgeData.controls && Object.keys(edgeData.controls).length > 0) {
			rel.controls = edgeData.controls;
		}

		if (edgeData.metadata && Object.keys(edgeData.metadata).length > 0) {
			rel.metadata = edgeData.metadata;
		}

		return rel;
	});

	return { nodes: calmNodes, relationships: calmRelationships };
}
