// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * duplicateRelationships.ts — Clone in-file CALM relationships for a duplicated node (R21).
 *
 * Only relationships in the current architecture are considered.
 * Peer nodes are never cloned; endpoints are rewired oldId → newId.
 */

import { nanoid } from 'nanoid';
import type { CalmArchitecture, CalmRelationship } from '@calmstudio/calm-core';
import { getReferencedNodeIds } from '@calmstudio/calm-core';

function relationshipMentionsNode(rel: CalmRelationship, nodeId: string): boolean {
	return getReferencedNodeIds(rel).includes(nodeId);
}

function rewireId(value: string, oldId: string, newId: string): string {
	return value === oldId ? newId : value;
}

function rewireRelationship(
	rel: CalmRelationship,
	oldId: string,
	newId: string
): CalmRelationship {
	const clone = JSON.parse(JSON.stringify(rel)) as CalmRelationship;
	clone['unique-id'] = nanoid();
	const rt = clone['relationship-type'];

	if ('connects' in rt) {
		rt.connects.source.node = rewireId(rt.connects.source.node, oldId, newId);
		rt.connects.destination.node = rewireId(rt.connects.destination.node, oldId, newId);
	} else if ('interacts' in rt) {
		rt.interacts.actor = rewireId(rt.interacts.actor, oldId, newId);
		rt.interacts.nodes = rt.interacts.nodes.map((n) => rewireId(n, oldId, newId));
	} else if ('composed-of' in rt) {
		rt['composed-of'].container = rewireId(rt['composed-of'].container, oldId, newId);
		rt['composed-of'].nodes = rt['composed-of'].nodes.map((n) => rewireId(n, oldId, newId));
	} else if ('deployed-in' in rt) {
		rt['deployed-in'].container = rewireId(rt['deployed-in'].container, oldId, newId);
		rt['deployed-in'].nodes = rt['deployed-in'].nodes.map((n) => rewireId(n, oldId, newId));
	}

	return clone;
}

/**
 * Duplicate relationships that mention `oldId`, rewiring endpoints to `newId`.
 * Does not mutate the input architecture.
 */
export function duplicateRelationshipsForNode(
	architecture: CalmArchitecture,
	oldId: string,
	newId: string
): CalmRelationship[] {
	return architecture.relationships
		.filter((rel) => relationshipMentionsNode(rel, oldId))
		.map((rel) => rewireRelationship(rel, oldId, newId));
}
