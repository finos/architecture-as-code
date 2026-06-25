// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * gemaraCatalogs.ts — retrieve + parse Gemara control catalogs for the
 * "Bind from grc.store" flow, with a small in-memory cache so re-binding the
 * same catalog doesn't refetch.
 *
 * Two entry points:
 *   - loadFromRef:   fetch a catalog version from the grc.store hub + parse.
 *   - loadFromPaste: parse a pasted catalog (the hub-down / CORS fallback).
 *
 * No Svelte reactivity here (plain module): callers own their UI loading/error
 * state. There is NO provenance verification — see hub.ts.
 */

import {
	catalogVersionUrl,
	getCatalog,
	getCatalogVersion,
	parseCatalogMetadata,
	parseControlCatalog,
	GemaraParseError,
	type GemaraCatalogRef,
	type GemaraControlCatalog,
	type HubClientOptions
} from '@calmstudio/calm-core';
import { parse as parseYaml } from 'yaml';

export interface LoadedCatalog {
	ref: GemaraCatalogRef;
	title?: string;
}

type RefCoords = Pick<GemaraCatalogRef, 'namespace' | 'catalogId' | 'version'>;

const cache = new Map<string, LoadedCatalog>();
const controlCache = new Map<string, GemaraControlCatalog>();

function readEnv(key: string): string | undefined {
	const env = import.meta.env as unknown as Record<string, string | undefined>;
	return env[key];
}

/**
 * Hub client used for fetching. In dev this is the same-origin `/grc-hub` proxy
 * path (VITE_GRC_HUB_URL) so the browser dodges the hub's missing CORS; in prod
 * it's unset and the client falls back to its default (https://hub.grc.store).
 */
function fetchClient(): HubClientOptions | undefined {
	const baseUrl = readEnv('VITE_GRC_HUB_URL');
	return baseUrl ? { baseUrl } : undefined;
}

/**
 * Base used for the persisted provenance citation (the relative proxy path is
 * not portable). Prefers VITE_GRC_HUB_PUBLIC_URL, else the fetch base when it's
 * absolute, else the client default.
 */
function citationClient(): HubClientOptions | undefined {
	const pub = readEnv('VITE_GRC_HUB_PUBLIC_URL');
	if (pub) return { baseUrl: pub };
	const fetchBase = readEnv('VITE_GRC_HUB_URL');
	return fetchBase && /^https?:\/\//.test(fetchBase) ? { baseUrl: fetchBase } : undefined;
}

function refKey(ref: RefCoords): string {
	return `${ref.namespace ? ref.namespace + '/' : ''}${ref.catalogId}@${ref.version}`;
}

export function getCachedCatalog(ref: RefCoords): LoadedCatalog | undefined {
	return cache.get(refKey(ref));
}

export function clearCatalogCache(): void {
	cache.clear();
	controlCache.clear();
}

/**
 * Fetch + parse a control catalog's FULL body (controls with their
 * guidelines/threats refs + assessment-requirements), cached. Unlike
 * loadFromRef (metadata only), this is what the Governance view needs to join
 * controls to the guidelines they satisfy.
 */
export async function loadControlCatalogFull(
	ref: { namespace: string; catalogId: string; version: string },
	client: HubClientOptions | undefined = fetchClient()
): Promise<GemaraControlCatalog> {
	const key = refKey(ref);
	const hit = controlCache.get(key);
	if (hit) return hit;
	const { body } = await getCatalogVersion(ref.namespace, ref.catalogId, ref.version, client);
	const cat = parseControlCatalog(body);
	controlCache.set(key, cat);
	return cat;
}

/**
 * Resolve a catalog's metadata from the grc.store hub for a whole-catalog
 * attach (cached). Uses the catalog DETAIL endpoint (title + releases) rather
 * than the version body — it's lighter and avoids the body's `registry_fetch`
 * failures, and a whole-catalog attach only needs metadata.
 */
export async function loadFromRef(
	ref: { namespace: string; catalogId: string; version: string },
	client: HubClientOptions | undefined = fetchClient()
): Promise<LoadedCatalog> {
	const key = refKey(ref);
	const hit = cache.get(key);
	if (hit) return hit;

	const detail = await getCatalog(ref.namespace, ref.catalogId, client);
	const release = detail.releases.find((r) => r.version === ref.version);
	if (!release) {
		throw new Error(`No version "${ref.version}" published for ${ref.namespace}/${ref.catalogId}`);
	}
	const fullRef: GemaraCatalogRef = {
		namespace: ref.namespace,
		catalogId: ref.catalogId,
		version: ref.version,
		hubUrl: catalogVersionUrl(ref.namespace, ref.catalogId, ref.version, citationClient()),
		...(release.manifest_digest ? { manifestDigest: release.manifest_digest } : {})
	};
	const loaded: LoadedCatalog = {
		ref: fullRef,
		...(detail.title ? { title: detail.title } : {})
	};
	cache.set(key, loaded);
	return loaded;
}

/**
 * Parse a pasted catalog's metadata. Coordinates come from a hint where given,
 * else the catalog's own metadata; namespace is left absent when none is given
 * (the binding's "unverified" status conveys the lack of a trusted source).
 * Gemara catalogs are YAML by default (e.g. from `grcli unpack`); YAML is a JSON
 * superset, so this accepts both.
 */
export function loadFromPaste(
	text: string,
	refHint: Partial<RefCoords> = {}
): LoadedCatalog {
	let doc: unknown;
	try {
		doc = parseYaml(text);
	} catch (e) {
		throw new GemaraParseError(
			'Could not parse catalog as YAML or JSON: ' + (e instanceof Error ? e.message : String(e))
		);
	}
	const md = parseCatalogMetadata(doc);
	const ref: GemaraCatalogRef = {
		...(refHint.namespace ? { namespace: refHint.namespace } : {}),
		catalogId: refHint.catalogId ?? md.id ?? 'catalog',
		version: refHint.version ?? md.version ?? 'unversioned'
	};
	const loaded: LoadedCatalog = { ref, ...(md.title ? { title: md.title } : {}) };
	cache.set(refKey(ref), loaded);
	return loaded;
}
