// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Decorate Svelte Flow nodes with badges + severity computed from a CALM architecture.
 *
 * Two APIs:
 *   - `decorateFlowNodes(nodes, badgeAPI, severity)` — pre-built indices (advanced)
 *   - `decorateFromArch(nodes, arch)` — builds indices once and returns decorated nodes (recommended)
 *
 * Both are pure functions that return new node arrays — callers should replace
 * their `$state.raw` nodes array in one shot to keep Svelte Flow happy.
 */

import type { Node } from '@xyflow/svelte';
import type { BadgeIndex, CalmArchitecture } from '@calmstudio/calm-core';
import type { SeverityIndex } from '@calmstudio/calm-core';
import {
	createBadgeAPI,
	createSeverityResolver,
	decoratorsAdapter,
	controlsAdapter
} from '@calmstudio/calm-core';

export function decorateFlowNodes(nodes: Node[], badgeAPI: BadgeIndex, severity: SeverityIndex): Node[] {
	return nodes.map((node) => {
		const calmId =
			((node.data as Record<string, unknown> | undefined)?.calmId as string | undefined) ?? node.id;
		const badges = badgeAPI.forNode(calmId);
		const sev = severity.forNode(calmId);
		return {
			...node,
			data: {
				...node.data,
				badges,
				severity: sev
			}
		};
	});
}

/**
 * Convenience wrapper: build BadgeAPI + severity resolver from the arch (with the
 * spike's two default adapters — decorators and controls), then decorate. Cheap
 * enough to call on every re-projection of the model.
 */
export function decorateFromArch(nodes: Node[], arch: CalmArchitecture): Node[] {
	const badgeAPI = createBadgeAPI(arch, [decoratorsAdapter, controlsAdapter]);
	const severity = createSeverityResolver(badgeAPI, arch);
	return decorateFlowNodes(nodes, badgeAPI, severity);
}
