// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Resolve CALM Hub base URL (R53 / #52).
 * Project `.calmrj` `hub.url` wins. `~/.calm.json` is only for hosts that can
 * read the user home directory — the browser SPA never attempts that.
 *
 * Stored value is origin only (scheme + host + port). Paths such as `/api`
 * or `/calm` are stripped — the Hub client appends them when it calls Hub.
 */

import type { CalmProjectConfig } from '$lib/project/types';

export function normalizeHubUrl(value: string | undefined | null): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	try {
		const url = new URL(trimmed);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return url.origin;
	} catch {
		return null;
	}
}

export function hubUrlFromProject(config: CalmProjectConfig | null | undefined): string | null {
	return normalizeHubUrl(config?.hub?.url);
}

export function isHubArchitectureUrl(href: string, hubBase: string | null): boolean {
	const base = normalizeHubUrl(hubBase);
	if (!base) return false;
	try {
		const url = new URL(href);
		const hub = new URL(base);
		if (url.origin !== hub.origin) return false;
		return /\/calm\//.test(url.pathname);
	} catch {
		return false;
	}
}
