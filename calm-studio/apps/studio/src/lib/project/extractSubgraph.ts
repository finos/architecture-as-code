// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmArchitecture, CalmNode, CalmRelationship } from '@calmstudio/calm-core';
import { getContainerAndNodes, getReferencedNodeIds } from '@calmstudio/calm-core';

export interface ExtractSubgraphResult {
	childArchitecture: CalmArchitecture;
	/** All node ids moved to the child file (including root). */
	extractIds: Set<string>;
	/** Relationships fully inside the extract set (move to child). */
	internalRelationships: CalmRelationship[];
	/** Relationships that cross the extract boundary (stay on parent, endpoints on stub). */
	boundaryRelationships: CalmRelationship[];
}

/**
 * Collect node + containment descendants + partition relationships (R27 / #21).
 */
export function collectExtractSubgraph(
	architecture: CalmArchitecture,
	rootUniqueId: string
): ExtractSubgraphResult {
	const nodes = architecture.nodes ?? [];
	const relationships = architecture.relationships ?? [];
	const byId = new Map(nodes.map((n) => [n['unique-id'], n]));

	if (!byId.has(rootUniqueId)) {
		throw new Error(`Node "${rootUniqueId}" not found in architecture`);
	}

	const extractIds = new Set<string>([rootUniqueId]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const rel of relationships) {
			const cn = getContainerAndNodes(rel);
			if (!cn || !extractIds.has(cn.container)) continue;
			for (const childId of cn.nodes) {
				if (!extractIds.has(childId) && byId.has(childId)) {
					extractIds.add(childId);
					grew = true;
				}
			}
		}
	}

	const internalRelationships: CalmRelationship[] = [];
	const boundaryRelationships: CalmRelationship[] = [];

	for (const rel of relationships) {
		const refs = getReferencedNodeIds(rel);
		if (refs.length === 0) continue;
		const allInside = refs.every((id) => extractIds.has(id));
		const allOutside = refs.every((id) => !extractIds.has(id));
		if (allInside) {
			internalRelationships.push(rel);
		} else if (!allOutside) {
			boundaryRelationships.push(rel);
		}
	}

	const childNodes: CalmNode[] = nodes.filter((n) => extractIds.has(n['unique-id']));
	const childArchitecture: CalmArchitecture = {
		nodes: childNodes,
		relationships: internalRelationships,
	};

	return {
		childArchitecture,
		extractIds,
		internalRelationships,
		boundaryRelationships,
	};
}

/**
 * Build parent architecture after extract: remove extract set, insert stub,
 * keep boundary + fully-outside relationships.
 */
export function applyExtractToParent(
	architecture: CalmArchitecture,
	rootUniqueId: string,
	detailedArchitecturePath: string
): { parentArchitecture: CalmArchitecture; childArchitecture: CalmArchitecture } {
	const { childArchitecture, extractIds, internalRelationships } = collectExtractSubgraph(
		architecture,
		rootUniqueId
	);

	const rootNode = (architecture.nodes ?? []).find((n) => n['unique-id'] === rootUniqueId);
	if (!rootNode) {
		throw new Error(`Node "${rootUniqueId}" not found`);
	}

	const existingDetails =
		typeof rootNode.details === 'object' && rootNode.details !== null
			? (rootNode.details as Record<string, unknown>)
			: {};

	const stub: CalmNode = {
		...rootNode,
		details: {
			...existingDetails,
			'detailed-architecture': detailedArchitecturePath,
		},
	};

	const remainingNodes = (architecture.nodes ?? [])
		.filter((n) => !extractIds.has(n['unique-id']))
		.concat([stub]);

	const internalIds = new Set(internalRelationships.map((r) => r['unique-id']));
	const remainingRels = (architecture.relationships ?? []).filter(
		(r) => !internalIds.has(r['unique-id'])
	);

	const parentArchitecture: CalmArchitecture = {
		...architecture,
		nodes: remainingNodes,
		relationships: remainingRels,
	};

	return { parentArchitecture, childArchitecture };
}
