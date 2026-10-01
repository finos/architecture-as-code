// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Parse and resolve a CALM CLI `-u` / CEngineering-App url-mapping.json (R75).
 * Mapping values are relative to the mapping file, not the project root.
 */

import { isHubArchitectureUrl } from '$lib/hub/hubUrl';

export type UrlMappingLookup =
	| { kind: 'hub' }
	| { kind: 'mapped'; path: string }
	| { kind: 'unmapped' };

export function mappingFileDirectory(mappingPath: string): string {
	const normalized = mappingPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	const idx = normalized.lastIndexOf('/');
	return idx < 0 ? '' : normalized.slice(0, idx);
}

/**
 * Join the mapping-file directory with a mapping value (posix, `..` allowed).
 * Returns null when the result would escape the project root.
 */
export function resolveMappingValue(mappingPath: string, relativeValue: string): string | null {
	const parts = mappingFileDirectory(mappingPath).split('/').filter(Boolean);
	for (const seg of relativeValue.replace(/\\/g, '/').split('/')) {
		if (!seg || seg === '.') continue;
		if (seg === '..') {
			if (parts.length === 0) return null;
			parts.pop();
			continue;
		}
		parts.push(seg);
	}
	return parts.join('/');
}

export function parseUrlMappingJson(
	raw: unknown,
	mappingPath: string
): { map: Map<string, string>; warnings: string[] } {
	const warnings: string[] = [];
	const map = new Map<string, string>();
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		warnings.push(`Invalid url-mapping file (${mappingPath}): expected a JSON object`);
		return { map, warnings };
	}
	for (const [url, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!url.trim()) {
			warnings.push(`Skipped empty URL key in ${mappingPath}`);
			continue;
		}
		if (typeof value !== 'string' || !value.trim()) {
			warnings.push(`Skipped mapping for ${url}: value must be a non-empty string`);
			continue;
		}
		const resolved = resolveMappingValue(mappingPath, value);
		if (resolved === null) {
			warnings.push(`Skipped mapping for ${url}: path escapes the project root`);
			continue;
		}
		map.set(url, resolved);
	}
	return { map, warnings };
}

export function lookupMappedUrl(
	url: string,
	map: Map<string, string>,
	hubBase: string | null | undefined
): UrlMappingLookup {
	if (isHubArchitectureUrl(url, hubBase ?? null)) return { kind: 'hub' };
	const path = map.get(url);
	if (path !== undefined) return { kind: 'mapped', path };
	return { kind: 'unmapped' };
}

/** Collect canonical http(s) `$id` / `$schema` / `$ref` strings from a JSON document. */
export function collectCanonicalUrls(doc: unknown): string[] {
	const found = new Set<string>();
	walkCanonicalUrls(doc, found);
	return [...found];
}

function walkCanonicalUrls(value: unknown, found: Set<string>): void {
	if (!value || typeof value !== 'object') return;
	if (Array.isArray(value)) {
		for (const item of value) walkCanonicalUrls(item, found);
		return;
	}
	const rec = value as Record<string, unknown>;
	for (const key of ['$id', '$schema', '$ref'] as const) {
		addCanonicalUrl(rec[key], found);
	}
	for (const nested of Object.values(rec)) walkCanonicalUrls(nested, found);
}

function addCanonicalUrl(raw: unknown, found: Set<string>): void {
	if (typeof raw === 'string') {
		if (/^https?:\/\//i.test(raw.split('#')[0] ?? '')) found.add(raw.split('#')[0]!);
		return;
	}
	if (Array.isArray(raw)) {
		for (const item of raw) addCanonicalUrl(item, found);
	}
}
