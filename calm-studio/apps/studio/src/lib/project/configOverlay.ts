// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmProjectConfig } from './types';

/**
 * Load user defaults first, then overlay the project file. Project wins.
 * Objects deep-merge; arrays replace when the project key is present (R62 / #60).
 */
export function overlayProjectConfig(
	user: CalmProjectConfig | null | undefined,
	project: CalmProjectConfig
): CalmProjectConfig {
	if (!user) return project;
	return deepMerge(user, project) as CalmProjectConfig;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base: unknown, overlay: unknown): unknown {
	if (Array.isArray(overlay)) return overlay;
	if (overlay === undefined) return base;
	if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay;
	const result: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(overlay)) {
		if (value === undefined) continue;
		result[key] = key in base ? deepMerge(base[key], value) : value;
	}
	return result;
}
