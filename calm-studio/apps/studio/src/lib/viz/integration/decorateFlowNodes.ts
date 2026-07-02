// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Decorate Svelte Flow nodes with badges + severity computed from a CALM architecture.
 *
 * Two APIs:
 *   - `decorateFlowNodes(nodes, badgeAPI, severity)` — pre-built indices (advanced)
 *   - `decorateFromArch(nodes, arch, opts?)` — builds indices once and returns decorated nodes (recommended)
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

export type OverlayModeForDecoration = 'default' | 'threat';

export function decorateFlowNodes(
	nodes: Node[],
	badgeAPI: BadgeIndex,
	severity: SeverityIndex,
	overlayMode: OverlayModeForDecoration = 'default'
): Node[] {
	return nodes.map((node) => {
		const calmId =
			((node.data as Record<string, unknown> | undefined)?.calmId as string | undefined) ?? node.id;
		const badges = badgeAPI.forNode(calmId);
		const sev = overlayMode === 'threat' ? severity.forNode(calmId) : 'unknown';
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
 * spike's two default adapters — decorators and controls), then decorate.
 *
 * `overlayMode` controls whether severity tints flow into `data.severity`:
 *   - 'default' (default): badges always render, severity is forced to 'unknown'
 *     so node borders stay neutral.
 *   - 'threat': badges + computed severity → node borders tinted by severity.
 */
export function decorateFromArch(
	nodes: Node[],
	arch: CalmArchitecture,
	opts?: { overlayMode?: OverlayModeForDecoration }
): Node[] {
	const badgeAPI = createBadgeAPI(arch, [decoratorsAdapter, controlsAdapter]);
	const severity = createSeverityResolver(badgeAPI, arch);
	return decorateFlowNodes(nodes, badgeAPI, severity, opts?.overlayMode ?? 'default');
}

/**
 * Extract all "threat" decorator badges across an architecture, sorted by
 * severity (highest first), useful for populating the ThreatPanel side surface.
 */
export function collectThreatBadges(
	arch: CalmArchitecture
): import('@calmstudio/calm-core').Badge[] {
	const badgeAPI = createBadgeAPI(arch, [decoratorsAdapter, controlsAdapter]);
	const out: import('@calmstudio/calm-core').Badge[] = [];
	for (const n of arch.nodes ?? []) {
		for (const b of badgeAPI.forNode(n['unique-id'])) {
			if (b.source === 'decorators' && b.data?.decoratorType === 'threat') out.push(b);
		}
	}
	return out;
}
