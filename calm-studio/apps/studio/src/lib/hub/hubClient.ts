// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/** Browser fetch client for CALM Hub catalog APIs (R53–R54). */

import { normalizeHubUrl } from './hubUrl';

export interface HubNamespace {
	name: string;
	description?: string;
}

export interface HubPatternSummary {
	id: string;
	name: string;
	namespace: string;
	version?: string;
	url: string;
	pattern: object;
}

export interface HubArchitectureSummary {
	id: string;
	name: string;
	namespace: string;
	version?: string;
	url: string;
}

export type HubResourceKind = 'architectures' | 'patterns' | 'standards' | 'flows';

function valuesOf<T>(data: unknown): T[] {
	if (Array.isArray(data)) return data as T[];
	if (!data || typeof data !== 'object') return [];
	const rec = data as Record<string, unknown>;
	if (Array.isArray(rec['values'])) return rec['values'] as T[];
	if (Array.isArray(rec['namespaces'])) return rec['namespaces'] as T[];
	if (Array.isArray(rec['patterns'])) return rec['patterns'] as T[];
	if (Array.isArray(rec['architectures'])) return rec['architectures'] as T[];
	return [];
}

async function getJson(url: string): Promise<unknown> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Hub request failed ${res.status}: ${url}`);
	}
	return res.json();
}

function hubOrigin(hubUrl: string): string {
	return normalizeHubUrl(hubUrl) ?? hubUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
}

export function isNumericHubId(id: string): boolean {
	return /^\d+$/.test(id);
}

/** Storage API uses `/api/calm` + numeric ids; named API uses `/calm` + slugs. */
export function hubResourceUrl(
	hubUrl: string,
	kind: HubResourceKind,
	namespace: string,
	id: string,
	version?: string
): string {
	const origin = hubOrigin(hubUrl);
	const prefix = isNumericHubId(id) ? `${origin}/api` : origin;
	const path = `/calm/namespaces/${encodeURIComponent(namespace)}/${kind}/${encodeURIComponent(id)}`;
	return version ? `${prefix}${path}/versions/${encodeURIComponent(version)}` : `${prefix}${path}`;
}

export function hubArchitectureUrl(
	hubUrl: string,
	namespace: string,
	id: string,
	version: string
): string {
	return hubResourceUrl(hubUrl, 'architectures', namespace, id, version);
}

function catalogDedupeKey(item: Record<string, unknown>): string {
	if (typeof item['numericId'] === 'number') return `n:${item['numericId']}`;
	const id = item['id'];
	if (typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id))) return `n:${id}`;
	if (typeof item['customId'] === 'string' && item['customId']) return `c:${item['customId']}`;
	if (typeof item['name'] === 'string' && item['name']) return `c:${item['name']}`;
	return '';
}

export function catalogResourceId(item: Record<string, unknown>): string {
	if (typeof item['customId'] === 'string' && item['customId']) return item['customId'];
	if (item['id'] != null && String(item['id'])) return String(item['id']);
	if (typeof item['numericId'] === 'number') return String(item['numericId']);
	if (typeof item['name'] === 'string' && item['name']) return item['name'];
	return '';
}

function catalogResourceName(item: Record<string, unknown>, fallbackId: string): string {
	if (typeof item['name'] === 'string' && item['name']) return item['name'];
	if (typeof item['title'] === 'string' && item['title']) return item['title'];
	if (typeof item['customId'] === 'string' && item['customId']) return item['customId'];
	return fallbackId;
}

/** Storage `/api` first (has names + numeric ids), then named `/calm` mappings. */
async function listCatalog(hubUrl: string, path: string): Promise<Record<string, unknown>[]> {
	const origin = hubOrigin(hubUrl);
	const urls = [`${origin}/api${path}`, `${origin}${path}`];
	const batches = await Promise.all(
		urls.map(async (url) => {
			try {
				return valuesOf<Record<string, unknown>>(await getJson(url));
			} catch {
				return [];
			}
		})
	);
	const rows: Record<string, unknown>[] = [];
	const seen = new Set<string>();
	for (const item of batches.flat()) {
		const key = catalogDedupeKey(item);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		rows.push(item);
	}
	return rows;
}

async function getFirst(hubUrl: string, path: string): Promise<unknown> {
	const origin = hubOrigin(hubUrl);
	const bases = [`${origin}/api`, origin];
	let lastError: unknown;
	for (const base of bases) {
		try {
			return await getJson(`${base}${path}`);
		} catch (err) {
			lastError = err;
		}
	}
	throw lastError instanceof Error ? lastError : new Error(`Hub request failed: ${path}`);
}

export function alternateHubDocumentUrl(url: string): string | null {
	try {
		const parsed = new URL(url);
		if (parsed.pathname.startsWith('/api/')) {
			parsed.pathname = parsed.pathname.slice(4) || '/';
		} else {
			parsed.pathname = `/api${parsed.pathname}`;
		}
		return parsed.toString().replace(/\/$/, '');
	} catch {
		return null;
	}
}

async function getJsonWithApiFallback(url: string): Promise<unknown> {
	try {
		return await getJson(url);
	} catch (err) {
		const alt = alternateHubDocumentUrl(url);
		if (!alt || alt === url) throw err;
		return await getJson(alt);
	}
}

export async function listHubNamespaces(hubUrl: string): Promise<HubNamespace[]> {
	const data = await getFirst(hubUrl, '/calm/namespaces');
	return valuesOf<HubNamespace>(data)
		.map((ns) => ({
			name: typeof ns.name === 'string' ? ns.name : String((ns as { id?: string }).id ?? ''),
			description: ns.description,
		}))
		.filter((ns) => ns.name);
}

export async function listHubArchitectures(
	hubUrl: string,
	namespace: string
): Promise<HubArchitectureSummary[]> {
	const items = await listCatalog(
		hubUrl,
		`/calm/namespaces/${encodeURIComponent(namespace)}/architectures`
	);
	const out: HubArchitectureSummary[] = [];
	for (const item of items) {
		const id = catalogResourceId(item);
		if (!id) continue;
		const version = typeof item['version'] === 'string' ? item['version'] : '1.0.0';
		const url =
			typeof item['url'] === 'string'
				? item['url']
				: hubArchitectureUrl(hubUrl, namespace, id, version);
		out.push({
			id,
			name: catalogResourceName(item, id),
			namespace,
			version,
			url,
		});
	}
	return out;
}

export async function listHubArchitectureVersions(
	hubUrl: string,
	namespace: string,
	architectureId: string
): Promise<string[]> {
	const path = `/calm/namespaces/${encodeURIComponent(namespace)}/architectures/${encodeURIComponent(architectureId)}/versions`;
	const data = await getFirst(hubUrl, path);
	const items = valuesOf<unknown>(data);
	const versions = items
		.map((item) => {
			if (typeof item === 'string') return item;
			if (item && typeof item === 'object') {
				const rec = item as Record<string, unknown>;
				return String(rec['id'] ?? rec['version'] ?? rec['name'] ?? '');
			}
			return '';
		})
		.filter(Boolean);
	return versions.length > 0 ? versions : ['1.0.0'];
}

export async function fetchHubArchitecture(url: string): Promise<object> {
	const data = await getJsonWithApiFallback(url);
	if (!data || typeof data !== 'object') {
		throw new Error('Hub architecture is not an object');
	}
	return data as object;
}

export async function listHubPatterns(
	hubUrl: string,
	namespace: string
): Promise<HubPatternSummary[]> {
	const items = await listCatalog(
		hubUrl,
		`/calm/namespaces/${encodeURIComponent(namespace)}/patterns`
	);
	const out: HubPatternSummary[] = [];
	for (const item of items) {
		const id = catalogResourceId(item);
		if (!id) continue;
		const version = typeof item['version'] === 'string' ? item['version'] : '1.0.0';
		const url =
			typeof item['url'] === 'string'
				? item['url']
				: hubResourceUrl(hubUrl, 'patterns', namespace, id, version);
		let pattern: object = item;
		if (item['pattern'] && typeof item['pattern'] === 'object') {
			pattern = item['pattern'] as object;
		} else {
			pattern = { ...item, url };
		}
		out.push({
			id: `${namespace}:${id}@${version}`,
			name: catalogResourceName(item, id),
			namespace,
			version,
			url,
			pattern,
		});
	}
	return out;
}

export async function fetchHubPattern(url: string): Promise<object> {
	const data = await getJsonWithApiFallback(url);
	if (!data || typeof data !== 'object') {
		throw new Error('Hub pattern is not an object');
	}
	return data as object;
}

export function isCalmPatternSchema(doc: unknown): doc is object {
	if (!doc || typeof doc !== 'object') return false;
	const props = (doc as Record<string, unknown>)['properties'];
	return !!props && typeof props === 'object' && !Array.isArray(props);
}

/** Catalog list items are summaries. Fetch the versioned pattern schema before generate/open. */
export async function resolveHubPatternDocument(pattern: object, documentUrl?: string): Promise<object> {
	if (isCalmPatternSchema(pattern)) return pattern;
	const rec = pattern as Record<string, unknown>;
	const href = documentUrl ?? (typeof rec['url'] === 'string' ? rec['url'] : null);
	if (!href) {
		throw new Error('Hub pattern listing has no document URL to fetch');
	}
	const fetched = await fetchHubPattern(href);
	if (!isCalmPatternSchema(fetched)) {
		throw new Error('Hub pattern document is missing a JSON Schema properties object');
	}
	return fetched;
}
