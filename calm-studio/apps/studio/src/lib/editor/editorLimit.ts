// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Open-editor cap from project `.calmrj` only (R89).
 * Missing or not a positive integer → 10.
 */

import type { CalmProjectConfig } from '$lib/project/types';

export const DEFAULT_MAX_OPEN_EDITORS = 10;

export type OpenCapacity = 'ok' | 'evict' | 'refuse';

export function resolveMaxOpenEditors(config: CalmProjectConfig | null | undefined): number {
	const value = config?.ui?.maxOpenEditors;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
		return DEFAULT_MAX_OPEN_EDITORS;
	}
	return value;
}

/**
 * `ok` — under the limit.
 * `evict` — count equals the limit; opening another editor closes the oldest.
 * `refuse` — count is already above the limit; do not close anything.
 */
export function openCapacity(openCount: number, limit: number): OpenCapacity {
	if (openCount < limit) return 'ok';
	if (openCount === limit) return 'evict';
	return 'refuse';
}
