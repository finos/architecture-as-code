// SPDX-FileCopyrightText: 2026 CalmStudio contributors
//
// SPDX-License-Identifier: Apache-2.0

import { scaffoldArchimateNodeMetadata } from '../packs/archimateMetadataDefaults.js';

/** Default `metadata` object when placing a new node from the palette, if the pack defines required fields. */
export function scaffoldNodeMetadata(calmType: string): Record<string, unknown> | undefined {
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
