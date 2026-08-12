// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Apply Find-neighbors selection onto the current canvas (R28).
 * Inserts missing nodes as R4 references and copies relationships with the same unique-id.
 */

import type { Node, Edge } from '@xyflow/svelte';
import type { CalmArchitecture, CalmNode, CalmRelationship } from '@calmstudio/calm-core';
import { calmToFlow } from '$lib/stores/projection';
import { relativePathBetween } from '$lib/explorer/relativePath';
import type { NeighborHit } from './findNeighbors';

export interface AddNeighborsInput {
	hits: NeighborHit[];
	nodes: Node[];
	edges: Edge[];
	focusUniqueId: string;
	/** Current diagram relative path (for detailed-architecture). */
	currentRelativePath: string | null;
}

export interface AddNeighborsResult {
	nodes: Node[];
	edges: Edge[];
	addedNodeIds: string[];
	addedEdgeIds: string[];
}

function canvasHasNode(nodes: Node[], uniqueId: string): boolean {
	return nodes.some((n) => n.id === uniqueId || n.data?.calmId === uniqueId);
}

function edgeExists(edges: Edge[], relationshipUniqueId: string): boolean {
	return edges.some(
		(e) =>
			e.id === relationshipUniqueId ||
			e.id.startsWith(`${relationshipUniqueId}#`) ||
			(e.data as { calmRelId?: string } | undefined)?.calmRelId === relationshipUniqueId
	);
}

function toReferenceCalmNode(
	source: CalmNode,
	detailedArchitecture: string
): CalmNode {
	return {
		'unique-id': source['unique-id'],
		'node-type': source['node-type'],
		name: source.name,
		description: source.description || 'External architecture reference',
		details: {
			...(source.details ?? {}),
			'detailed-architecture': detailedArchitecture,
		},
	};
}

function focusPosition(nodes: Node[], focusUniqueId: string): { x: number; y: number } {
	const focus = nodes.find((n) => n.id === focusUniqueId || n.data?.calmId === focusUniqueId);
	return focus?.position ?? { x: 0, y: 0 };
}

function deepClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Merge selected neighbor hits into the current canvas.
 * Idempotent for existing nodes / relationship unique-ids.
 */
export function addNeighborsToCanvas(input: AddNeighborsInput): AddNeighborsResult {
	const { hits, focusUniqueId, currentRelativePath } = input;
	let nodes = [...input.nodes];
	let edges = [...input.edges];
	const addedNodeIds: string[] = [];
	const addedEdgeIds: string[] = [];

	const origin = focusPosition(nodes, focusUniqueId);
	const uniqueHits = dedupeHits(hits);

	const nodesToProject: CalmNode[] = [];
	const relsToProject: CalmRelationship[] = [];
	const positionMap = new Map<string, { x: number; y: number }>();

	// Keep focus in the projection so edge endpoints resolve.
	const focusNode = nodes.find((n) => n.id === focusUniqueId || n.data?.calmId === focusUniqueId);
	if (focusNode) {
		nodesToProject.push({
			'unique-id': focusUniqueId,
			'node-type': (focusNode.data?.calmType as string) ?? 'system',
			name: (focusNode.data?.label as string) ?? focusUniqueId,
			description: (focusNode.data?.description as string) ?? '',
		});
		positionMap.set(focusUniqueId, { ...focusNode.position });
	}

	let offsetIndex = 0;
	for (const hit of uniqueHits) {
		const needNode = !canvasHasNode(nodes, hit.neighborUniqueId);
		const needRel = !edgeExists(edges, hit.relationshipUniqueId);

		if (!needNode && !needRel) continue;

		if (needNode) {
			const homePath = hit.neighborHomePath || hit.sourceRelativePath;
			const detailedPath = currentRelativePath
				? relativePathBetween(currentRelativePath, homePath)
				: homePath;
			nodesToProject.push(toReferenceCalmNode(deepClone(hit.neighborNode), detailedPath));
			positionMap.set(hit.neighborUniqueId, {
				x: origin.x + 220 + (offsetIndex % 3) * 40,
				y: origin.y + Math.floor(offsetIndex / 3) * 100,
			});
			offsetIndex += 1;
		} else {
			const existing = nodes.find(
				(n) => n.id === hit.neighborUniqueId || n.data?.calmId === hit.neighborUniqueId
			);
			if (existing) {
				nodesToProject.push({
					'unique-id': hit.neighborUniqueId,
					'node-type': (existing.data?.calmType as string) ?? hit.neighborNodeType,
					name: (existing.data?.label as string) ?? hit.neighborName,
					description: (existing.data?.description as string) ?? '',
					details: existing.data?.calmDetails as CalmNode['details'],
				});
				positionMap.set(hit.neighborUniqueId, { ...existing.position });
			}
		}

		if (needRel) {
			// JSON clone — structuredClone fails on Svelte 5 reactive proxies
			relsToProject.push(deepClone(hit.relationship));
		}
	}

	if (nodesToProject.length === 0 && relsToProject.length === 0) {
		return { nodes, edges, addedNodeIds, addedEdgeIds };
	}

	const arch: CalmArchitecture = {
		nodes: nodesToProject,
		relationships: relsToProject,
	};
	const projected = calmToFlow(arch, positionMap);

	for (const n of projected.nodes) {
		if (n.id === focusUniqueId || n.data?.calmId === focusUniqueId) continue;
		if (canvasHasNode(nodes, n.id)) continue;
		nodes = [...nodes, n];
		addedNodeIds.push(n.id);
	}

	for (const e of projected.edges) {
		const calmRelId =
			(e.data as { calmRelId?: string } | undefined)?.calmRelId ?? e.id.split('#')[0]!;
		if (edgeExists(edges, calmRelId)) continue;
		// Both endpoints must exist on the canvas
		if (!canvasHasNode(nodes, e.source) || !canvasHasNode(nodes, e.target)) continue;
		edges = [...edges, e];
		addedEdgeIds.push(e.id);
	}

	return { nodes, edges, addedNodeIds, addedEdgeIds };
}

function dedupeHits(hits: NeighborHit[]): NeighborHit[] {
	const seen = new Set<string>();
	const out: NeighborHit[] = [];
	for (const hit of hits) {
		const key = `${hit.relationshipUniqueId}::${hit.neighborUniqueId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(hit);
	}
	return out;
}
