// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * projection.ts — Pure bidirectional projection functions between
 * CalmArchitecture (CALM 1.2 nested form) and Svelte Flow.
 *
 * calmToFlow: converts a CalmArchitecture into Svelte Flow nodes[] and edges[].
 *   - `connects` variant → 1 edge (source.node → destination.node)
 *   - `composed-of`/`deployed-in` variant → N edges (container → each child)
 *   - `interacts` variant → N edges (actor → each interacted node)
 *   - `options` variant → 0 edges (no graph topology in spec)
 *   When a multi-child variant has N>1, each derived edge gets a suffixed
 *   unique-id (`<base>#<i>`) so Svelte Flow stays 1-edge-per-row.
 *
 * flowToCalm: converts Svelte Flow nodes[] and edges[] back to
 * CalmArchitecture. Each Svelte Flow edge becomes exactly one
 * CalmRelationship; multi-child round-trips therefore split into
 * separate single-child rels (a documented, lossy-but-correct trade-off).
 *
 * IMPORTANT: This file must NOT import from .svelte.ts files (not testable
 * in vitest without additional Svelte transform setup).
 */

import type { Node, Edge } from '@xyflow/svelte';
import type {
	CalmArchitecture,
	CalmControls,
	CalmInterface,
	CalmNode,
	CalmRelationship,
	CalmRelationshipType,
	CalmRelationshipVariant
} from '@calmstudio/calm-core';
import { resolveNodeType } from '$lib/canvas/nodeTypes';

/** The set of CALM variant keys that imply containment. */
const CONTAINMENT_VARIANTS: ReadonlySet<CalmRelationshipVariant> = new Set([
	'deployed-in',
	'composed-of'
]);

/**
 * Discover the variant key actually present on a relationship-type object.
 * Returns null when the variant is malformed (no recognised key).
 */
function variantOf(rt: CalmRelationshipType): CalmRelationshipVariant | null {
	if ('connects' in rt) return 'connects';
	if ('composed-of' in rt) return 'composed-of';
	if ('interacts' in rt) return 'interacts';
	if ('deployed-in' in rt) return 'deployed-in';
	if ('options' in rt) return 'options';
	return null;
}

/**
 * Returns one or more (source, target) pairs derived from a single CALM
 * relationship. For composed-of/deployed-in/interacts, expands to N pairs
 * — one per child/peer node.
 */
function expandEdgePairs(
	rel: CalmRelationship,
): Array<{ source: string; target: string; variant: CalmRelationshipVariant }> {
	const rt = rel['relationship-type'];
	if ('connects' in rt) {
		return [
			{
				source: rt.connects.source.node,
				target: rt.connects.destination.node,
				variant: 'connects'
			}
		];
	}
	if ('composed-of' in rt) {
		return rt['composed-of'].nodes.map((child) => ({
			source: rt['composed-of'].container,
			target: child,
			variant: 'composed-of' as const
		}));
	}
	if ('deployed-in' in rt) {
		return rt['deployed-in'].nodes.map((child) => ({
			source: rt['deployed-in'].container,
			target: child,
			variant: 'deployed-in' as const
		}));
	}
	if ('interacts' in rt) {
		return rt.interacts.nodes.map((peer) => ({
			source: rt.interacts.actor,
			target: peer,
			variant: 'interacts' as const
		}));
	}
	// `options` has no graph topology; skip.
	return [];
}

/**
 * Build a CALM 1.2 nested `relationship-type` from a flat (source, target,
 * variant) triple. Used when projecting Svelte Flow edges back to CALM.
 */
function buildRelationshipType(
	variant: CalmRelationshipVariant,
	source: string,
	target: string
): CalmRelationshipType {
	switch (variant) {
		case 'connects':
			return { connects: { source: { node: source }, destination: { node: target } } };
		case 'composed-of':
			return { 'composed-of': { container: source, nodes: [target] } };
		case 'deployed-in':
			return { 'deployed-in': { container: source, nodes: [target] } };
		case 'interacts':
			return { interacts: { actor: source, nodes: [target] } };
		case 'options':
			return { options: [] };
	}
}

/**
 * Converts a CalmArchitecture into Svelte Flow nodes and edges.
 */
export function calmToFlow(
	arch: CalmArchitecture,
	positionMap?: Map<string, { x: number; y: number; width?: number; height?: number }>
): { nodes: Node[]; edges: Edge[] } {
	// Build containment map from CALM relationships.
	//   composed-of: container is parent of each child
	//   deployed-in: container is parent of each child
	const childToParent = new Map<string, string>();
	const parentChildren = new Map<string, Set<string>>();

	for (const rel of arch.relationships) {
		const v = variantOf(rel['relationship-type']);
		if (!v || !CONTAINMENT_VARIANTS.has(v)) continue;

		for (const pair of expandEdgePairs(rel)) {
			const parentId = pair.source; // container
			const childId = pair.target;  // each child
			childToParent.set(childId, parentId);
			if (!parentChildren.has(parentId)) parentChildren.set(parentId, new Set());
			parentChildren.get(parentId)!.add(childId);
		}
	}

	function getDepth(nodeId: string): number {
		let depth = 0;
		let current = nodeId;
		while (childToParent.has(current)) {
			depth++;
			current = childToParent.get(current)!;
		}
		return depth;
	}

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
				metadata: cn.metadata
			}
		};

		if (parentId) {
			node.parentId = parentId;
			node.extent = 'parent';
			node.zIndex = depth;
		}

		if (type === 'container') {
			node.width = posEntry?.width ?? 300;
			node.height = posEntry?.height ?? 200;
		}
		return node;
	});

	// Svelte Flow requires parents before children.
	nodes.sort((a, b) => getDepth(a.id) - getDepth(b.id));

	// Expand each CALM relationship into one or more Svelte Flow edges.
	// We tag each edge with its source CalmRelationship's unique-id and variant
	// in `data.calm` so flowToCalm can reconstruct the nested form losslessly
	// for the common 1:1 case and as separate single-child rels for the
	// multi-child case (documented trade-off).
	const edges: Edge[] = [];
	for (const cr of arch.relationships) {
		const pairs = expandEdgePairs(cr);
		const multi = pairs.length > 1;
		pairs.forEach((pair, i) => {
			edges.push({
				id: multi ? `${cr['unique-id']}#${i}` : cr['unique-id'],
				source: pair.source,
				target: pair.target,
				type: pair.variant,
				data: {
					calmRelId: cr['unique-id'],
					calmVariant: pair.variant,
					protocol: cr.protocol,
					description: cr.description,
					controls: cr.controls,
					metadata: cr.metadata
				}
			});
		});
	}

	return { nodes, edges };
}

/**
 * Converts Svelte Flow nodes and edges back to a CalmArchitecture.
 */
export function flowToCalm(nodes: Node[], edges: Edge[]): CalmArchitecture {
	// Build a lookup from Svelte Flow node ID to CALM unique-id (calmId).
	const flowIdToCalmId = new Map<string, string>();
	for (const n of nodes) {
		const calmId = (n.data as { calmId?: string })?.calmId;
		if (calmId) flowIdToCalmId.set(n.id, calmId);
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
			name: d.label
		};

		if (d.description) node.description = d.description;
		if (d.interfaces && d.interfaces.length > 0) node.interfaces = d.interfaces;
		if (d.customMetadata && Object.keys(d.customMetadata).length > 0) {
			node.customMetadata = d.customMetadata;
		}
		if (d.controls && Object.keys(d.controls).length > 0) node.controls = d.controls;
		if (d['data-classification']) node['data-classification'] = d['data-classification'];
		if (d.metadata && Object.keys(d.metadata).length > 0) node.metadata = d.metadata;

		return node;
	});

	const calmRelationships: CalmRelationship[] = edges.map((e: Edge) => {
		const edgeData = (e.data ?? {}) as {
			calmRelId?: string;
			calmVariant?: CalmRelationshipVariant;
			protocol?: string;
			description?: string;
			controls?: CalmControls;
			metadata?: Record<string, unknown>;
		};

		const variant =
			edgeData.calmVariant ??
			((e.type as CalmRelationshipVariant | undefined) ?? 'connects');
		const sourceId = flowIdToCalmId.get(e.source) ?? e.source;
		const targetId = flowIdToCalmId.get(e.target) ?? e.target;

		const rel: CalmRelationship = {
			'unique-id': e.id,
			'relationship-type': buildRelationshipType(variant, sourceId, targetId)
		};

		if (edgeData.protocol) rel.protocol = edgeData.protocol;
		if (edgeData.description) rel.description = edgeData.description;
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
