// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Decorate Svelte Flow nodes with badges + severity computed from a CALM architecture.
 *
 * Intended as the integration point between calm-core viz/ pure modules and the
 * Svelte Flow rendering in CalmCanvas.svelte. The function is side-effect-free
 * and returns a new array — callers should replace their `nodes` state in one
 * shot to play well with Svelte Flow's `$state.raw` requirement.
 *
 * Usage in CalmCanvas:
 *
 *   import {
 *     createBadgeAPI, decoratorsAdapter, controlsAdapter, createSeverityResolver,
 *   } from '@calmstudio/calm-core';
 *   import { decorateFlowNodes } from '$lib/viz/integration/decorateFlowNodes';
 *
 *   const arch: CalmArchitecture = ...;
 *   const badgeAPI = createBadgeAPI(arch, [decoratorsAdapter, controlsAdapter]);
 *   const severity = createSeverityResolver(badgeAPI, arch);
 *   nodes = decorateFlowNodes(nodes, badgeAPI, severity);
 */

import type { Node } from '@xyflow/svelte';
import type { BadgeIndex } from '@calmstudio/calm-core';
import type { SeverityIndex } from '@calmstudio/calm-core';

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
