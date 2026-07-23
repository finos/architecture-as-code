// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type {
	CalmRelationshipType,
	CalmRelationshipVariant,
} from '@calmstudio/calm-core';
import { expectedCalmVariantForArchimateRelationship } from '@calmstudio/calm-core';
import { writeMetadataPath } from './metadataForm';

export function buildRelationshipTypeForVariant(
	variant: CalmRelationshipVariant,
	source: string,
	target: string,
): CalmRelationshipType {
	switch (variant) {
		case 'connects':
			return {
				connects: { source: { node: source }, destination: { node: target } },
			};
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

/** Apply ArchiMate relationship metadata and derive `calm-core-variant`. */
export function writeArchimateRelationshipMetadata(
	metadata: Record<string, unknown> | undefined,
	relationship: string,
): Record<string, unknown> {
	let next = writeMetadataPath(metadata, ['archimate', 'relationship'], relationship);
	next = writeMetadataPath(
		next,
		['archimate', 'calm-core-variant'],
		expectedCalmVariantForArchimateRelationship(relationship),
	);
	return next;
}

export function resolveVariantSyncFromMetadata(
	metadata: Record<string, unknown>,
	currentVariant: CalmRelationshipVariant,
	source: string,
	target: string,
): { metadata: Record<string, unknown>; relationshipType?: CalmRelationshipType } {
	const archimate = metadata.archimate;
	if (!archimate || typeof archimate !== 'object') {
		return { metadata };
	}
	const archimateRel = (archimate as Record<string, unknown>).relationship;
	if (typeof archimateRel !== 'string' || !archimateRel) {
		return { metadata };
	}

	const nextMetadata = writeArchimateRelationshipMetadata(metadata, archimateRel);
	const expectedVariant = expectedCalmVariantForArchimateRelationship(archimateRel);
	if (currentVariant === expectedVariant) {
		return { metadata: nextMetadata };
	}

	return {
		metadata: nextMetadata,
		relationshipType: buildRelationshipTypeForVariant(expectedVariant, source, target),
	};
}
