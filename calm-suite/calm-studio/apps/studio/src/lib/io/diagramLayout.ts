// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * diagramLayout.ts — persist the user's node arrangement in CALM `metadata`.
 *
 * Positions are presentation, not architecture, so they live under a namespaced
 * `calmstudio-layout` key in the document's metadata (a node-id → {x,y} map) —
 * canonical CALM that any non-Studio consumer ignores. Written at save time and
 * read back on load to restore the arrangement; nodes without a saved position
 * fall back to auto-layout, so docs authored elsewhere still lay out sensibly.
 *
 * Positions are stored exactly as Svelte Flow holds them (parent-relative for
 * nodes nested in a container), so the same value restores losslessly.
 */

import type { CalmArchitecture } from '@calmstudio/calm-core';
import { getMetadataValue, setMetadataValue } from './calmMetadata';

const LAYOUT_KEY = 'calmstudio-layout';

export type DiagramLayout = Record<string, { x: number; y: number }>;

/** Read the saved node-position map from document metadata (empty if absent). */
export function readLayout(arch: Pick<CalmArchitecture, 'metadata'>): DiagramLayout {
	const raw = getMetadataValue(arch.metadata, LAYOUT_KEY);
	if (!raw || typeof raw !== 'object') return {};
	const out: DiagramLayout = {};
	for (const [id, pos] of Object.entries(raw as Record<string, unknown>)) {
		if (pos && typeof pos === 'object') {
			const { x, y } = pos as { x?: unknown; y?: unknown };
			if (typeof x === 'number' && typeof y === 'number') out[id] = { x, y };
		}
	}
	return out;
}

/** Return metadata with the layout map set (or removed when empty), preserving other keys. */
export function writeLayout(meta: unknown, layout: DiagramLayout): unknown {
	return setMetadataValue(meta, LAYOUT_KEY, Object.keys(layout).length ? layout : null);
}
