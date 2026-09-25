// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Resolve document / pack schema URLs for the metadata editor (R17 / R75)
 * and log loaded vs missing entries so a missing Standard is visible in the console.
 */

import { SchemaDirectory } from '@finos/calm-shared/generate';
import { isHubArchitectureUrl } from '$lib/hub/hubUrl';
import { collectCanonicalUrls, lookupMappedUrl } from '$lib/project/urlMapping';
import { isBundledCalmSchemaId } from '$lib/templates/bundledCalmSchemas';
import {
	createProjectCalmDocumentLoader,
	type UrlMappingSource,
} from '$lib/templates/mappedCalmLoader';

export const METADATA_SCHEMA_LOG = '[CalmStudio metadata-schema]';

export type MetadataSchemaResolveEvent = {
	url: string;
	loaded: boolean;
	source?: 'url-mapping' | 'bundled';
	path?: string;
	reason?: string;
};

export type MetadataSchemaResolveResult = {
	events: MetadataSchemaResolveEvent[];
	mappingWarnings: string[];
	/** Successfully loaded schema documents keyed by canonical URL. */
	documents: Map<string, object>;
};

function documentIdOf(url: string): string {
	return url.split('#')[0] ?? url;
}

function isJsonSchemaOrg(url: string): boolean {
	try {
		return new URL(url).hostname === 'json-schema.org';
	} catch {
		return false;
	}
}

export function seedMetadataSchemaUrls(options: {
	documentSchema?: string | string[];
	packSchemaUrl?: string;
}): string[] {
	const raw = options.documentSchema;
	const fromDoc = !raw ? [] : Array.isArray(raw) ? raw : [raw];
	const seeds = [...fromDoc, options.packSchemaUrl ?? '']
		.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
		.map(documentIdOf);
	return [...new Set(seeds)];
}

export async function resolveMetadataSchemas(
	seedUrls: string[],
	mapping?: UrlMappingSource
): Promise<MetadataSchemaResolveResult> {
	const { loader, warnings, map } = await createProjectCalmDocumentLoader(mapping);
	const schemaDirectory = new SchemaDirectory(loader, false);
	await schemaDirectory.loadSchemas();

	const events: MetadataSchemaResolveEvent[] = [];
	const documents = new Map<string, object>();
	const queue = [...seedUrls];
	const seen = new Set<string>();
	const hubBase = mapping?.hubUrl ?? null;

	while (queue.length > 0) {
		const url = documentIdOf(queue.shift()!);
		if (!url || seen.has(url)) continue;
		seen.add(url);

		if (isJsonSchemaOrg(url) && !isBundledCalmSchemaId(url)) {
			events.push({
				url,
				loaded: false,
				reason: 'JSON Schema meta-schema is not bundled',
			});
			continue;
		}

		if (isHubArchitectureUrl(url, hubBase)) {
			events.push({
				url,
				loaded: false,
				reason: 'Hub instance URL skipped by url-mapping',
			});
			continue;
		}

		const mapped = lookupMappedUrl(url, map, hubBase);
		try {
			const doc = await schemaDirectory.getSchema(url);
			if (!doc) {
				const reason =
					mapped.kind === 'mapped'
						? `mapped file missing (${mapped.path})`
						: isBundledCalmSchemaId(url)
							? 'bundled schema lookup failed'
							: 'unmapped URL (no network fetch)';
				events.push({ url, loaded: false, reason });
				continue;
			}
			const source: MetadataSchemaResolveEvent['source'] =
				mapped.kind === 'mapped'
					? 'url-mapping'
					: isBundledCalmSchemaId(url)
						? 'bundled'
						: undefined;
			events.push({
				url,
				loaded: true,
				source,
				...(mapped.kind === 'mapped' ? { path: mapped.path } : {}),
			});
			documents.set(url, doc);
			const id = (doc as { $id?: unknown }).$id;
			if (typeof id === 'string' && id !== url) documents.set(id, doc);
			for (const nested of collectCanonicalUrls(doc)) {
				const id = documentIdOf(nested);
				if (id && !seen.has(id)) queue.push(id);
			}
		} catch (err) {
			events.push({
				url,
				loaded: false,
				reason: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return { events, mappingWarnings: warnings, documents };
}

export function logMetadataSchemaResolution(options: {
	elementId: string;
	nodeType?: string;
	formFieldCount: number;
	schemaFieldSource?: string;
	seedUrls: string[];
	mappingPath?: string;
	result: MetadataSchemaResolveResult;
}): void {
	const {
		elementId,
		nodeType,
		formFieldCount,
		schemaFieldSource,
		seedUrls,
		mappingPath,
		result,
	} = options;
	console.info(
		METADATA_SCHEMA_LOG,
		`resolving for ${nodeType ?? 'element'} (${elementId})`,
		mappingPath ? `urlMapping.path=${mappingPath}` : 'urlMapping.path=(unset)'
	);
	if (seedUrls.length === 0) {
		console.warn(
			METADATA_SCHEMA_LOG,
			'not loaded: document has no $schema and pack has no schemaUrl'
		);
	}
	for (const warning of result.mappingWarnings) {
		console.warn(METADATA_SCHEMA_LOG, 'mapping warning:', warning);
	}
	for (const event of result.events) {
		if (event.loaded) {
			const where = event.source === 'url-mapping' && event.path
				? `url-mapping → ${event.path}`
				: event.source ?? 'loaded';
			console.info(METADATA_SCHEMA_LOG, 'loaded', event.url, `(${where})`);
		} else {
			console.warn(METADATA_SCHEMA_LOG, 'not loaded', event.url, `(${event.reason ?? 'unknown'})`);
		}
	}
	if (formFieldCount > 0) {
		console.info(
			METADATA_SCHEMA_LOG,
			`bound ${formFieldCount} form fields`,
			schemaFieldSource ? `from ${schemaFieldSource}` : 'from pack schema'
		);
		return;
	}
	console.warn(
		METADATA_SCHEMA_LOG,
		'no schema form fields for this element; extra metadata shown as simple fields'
	);
}
