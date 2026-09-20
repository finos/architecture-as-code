// SPDX-FileCopyrightText: 2026 CalmStudio contributors
//
// SPDX-License-Identifier: Apache-2.0

import { getPackForNodeType, resolvePackNode } from '../registry.js';
import { scaffoldArchimateNodeMetadata } from '../packs/archimateMetadataDefaults.js';

function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
	return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

function findNodeEntry(calmType: string) {
	return (
		resolvePackNode(calmType) ??
		getPackForNodeType(calmType)?.nodes.find((n) => n.typeId === calmType)
	);
}

/** Default `metadata` object when placing a new node from the palette, if the pack defines required fields. */
export function scaffoldNodeMetadata(calmType: string): Record<string, unknown> | undefined {
	const fromPack = findNodeEntry(calmType)?.defaults?.metadata;
	if (fromPack) {
		return cloneMetadata(fromPack);
	}
	if (calmType.startsWith('archimate:')) {
		return scaffoldArchimateNodeMetadata(calmType);
	}
	return undefined;
}

/** Default relationship `metadata` when connecting nodes in an ArchiMate diagram. */
export function scaffoldRelationshipMetadata(
	sourceType: string,
	targetType: string,
): Record<string, unknown> | undefined {
	const sourcePack = getPackForNodeType(sourceType);
	const targetPack = getPackForNodeType(targetType);
	const fromPack =
		sourcePack?.relationshipDefaults?.metadata ?? targetPack?.relationshipDefaults?.metadata;
	if (fromPack) {
		return cloneMetadata(fromPack);
	}
	if (sourceType.startsWith('archimate:') || targetType.startsWith('archimate:')) {
		return {
			archimate: {
				relationship: 'Association',
				'calm-core-variant': 'connects',
			},
		};
	}
	return undefined;
}
