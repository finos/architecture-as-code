// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmRelationshipType, CalmRelationshipVariant } from '@calmstudio/calm-core';

export interface SwapResult {
	source: string;
	target: string;
	relationshipType: CalmRelationshipType;
}

/**
 * Swap the direction of a relationship for canvas source/target endpoints.
 * Supports connects, interacts, composed-of, and deployed-in variants.
 */
export function swapRelationshipDirection(
	variant: CalmRelationshipVariant,
	source: string,
	target: string
): SwapResult {
	switch (variant) {
		case 'connects':
			return {
				source: target,
				target: source,
				relationshipType: {
					connects: {
						source: { node: target },
						destination: { node: source },
					},
				},
			};
		case 'interacts':
			return {
				source: target,
				target: source,
				relationshipType: {
					interacts: { actor: target, nodes: [source] },
				},
			};
		case 'composed-of':
			return {
				source: target,
				target: source,
				relationshipType: {
					'composed-of': { container: target, nodes: [source] },
				},
			};
		case 'deployed-in':
			return {
				source: target,
				target: source,
				relationshipType: {
					'deployed-in': { container: target, nodes: [source] },
				},
			};
		case 'options':
			return { source, target, relationshipType: { options: [] } };
	}
}
