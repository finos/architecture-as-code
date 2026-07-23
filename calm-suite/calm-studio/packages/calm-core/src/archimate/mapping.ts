// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmRelationshipVariant } from '../types.js';

/** ArchiMate relationship name → required CALM 1.2 `relationship-type` variant. */
export const ARCHIMATE_TO_CALM_VARIANT: Record<string, CalmRelationshipVariant> = {
	Serving: 'interacts',
	Composition: 'composed-of',
	Aggregation: 'composed-of',
	Deployment: 'deployed-in',
	Assignment: 'connects',
	Realization: 'connects',
	Access: 'connects',
	Influence: 'connects',
	Triggering: 'connects',
	Flow: 'connects',
	Specialization: 'connects',
	Association: 'connects',
};

export function expectedCalmVariantForArchimateRelationship(
	archimateRelationship: string,
): CalmRelationshipVariant {
	return ARCHIMATE_TO_CALM_VARIANT[archimateRelationship] ?? 'connects';
}

/** Build default `metadata.archimate` for a new ArchiMate relationship. */
export function scaffoldArchimateRelationshipMetadata(
	archimateRelationship = 'Association',
): Record<string, unknown> {
	return {
		archimate: {
			relationship: archimateRelationship,
			'calm-core-variant': expectedCalmVariantForArchimateRelationship(archimateRelationship),
		},
	};
}
