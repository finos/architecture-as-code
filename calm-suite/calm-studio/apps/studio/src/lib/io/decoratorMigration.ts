// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * decoratorMigration.ts — Pure helpers for moving decorators between the
 * (legacy) embedded `architecture.decorators[]` form and the standalone
 * `*.decorators.json` sidecar.
 *
 * No Svelte/DOM dependencies — safe to unit test and to reuse from headless
 * consumers (e.g. the MCP server's import path) if/when that parity is added.
 */

import type { CalmArchitecture, CalmDecorator } from '@calmstudio/calm-core';
import { mergeDecoratorAppliesTo } from '@calmstudio/calm-core';

/**
 * Split a parsed architecture into its decorator-free document and the
 * decorators that were embedded in it. Used to migrate legacy files (decorators
 * in the architecture body) to the sidecar form. Returns an empty array when
 * the document carries none.
 */
export function liftEmbeddedDecorators(arch: CalmArchitecture): {
	arch: CalmArchitecture;
	decorators: CalmDecorator[];
} {
	const { decorators, ...rest } = arch as CalmArchitecture & { decorators?: CalmDecorator[] };
	return { arch: rest as CalmArchitecture, decorators: decorators ?? [] };
}

/**
 * Merge `incoming` decorators into `existing`, keyed by `unique-id`. For a
 * matching id the `applies-to` lists are unioned and the incoming decorator's
 * other fields (`data`, `target`) win — mirroring the idempotent upsert used by
 * the governance overlay. New ids are appended. Neither input is mutated.
 *
 * Used when opening a file: decorators already lifted from the document body are
 * `existing`, and the `*.decorators.json` sidecar's are `incoming` — so a file
 * that has both (mid-migration) ends up with the union rather than a clobber.
 */
export function mergeDecoratorLists(
	existing: CalmDecorator[],
	incoming: CalmDecorator[],
): CalmDecorator[] {
	const result = [...existing];
	for (const inc of incoming) {
		const idx = result.findIndex((d) => d['unique-id'] === inc['unique-id']);
		if (idx >= 0) {
			// Replace in place so existing decorators keep their on-disk order
			// (avoids noisy reordering diffs in the arch/sidecar on the next save).
			result[idx] = mergeDecoratorAppliesTo(result[idx], inc);
		} else {
			result.push(inc);
		}
	}
	return result;
}
