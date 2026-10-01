// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { readProjectRelativeText } from './projectFs';
import { parseUrlMappingJson } from './urlMapping';

export type LoadedUrlMapping = {
	map: Map<string, string>;
	documents: Map<string, object>;
	warnings: string[];
};

function emptyMapping(warnings: string[] = []): LoadedUrlMapping {
	return { map: new Map(), documents: new Map(), warnings };
}

/**
 * Load a project `url-mapping.json` and pre-parse mapped documents (R75).
 * Missing / invalid files yield an empty map plus warnings; callers continue.
 */
export async function loadUrlMappingFromProject(
	root: FileSystemDirectoryHandle | null,
	mappingPath: string | undefined
): Promise<LoadedUrlMapping> {
	const path = mappingPath?.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
	if (!path) return emptyMapping();
	if (!root) {
		return emptyMapping([`url-mapping file not loaded (no project folder): ${path}`]);
	}

	let text: string;
	try {
		text = await readProjectRelativeText(root, path);
	} catch {
		return emptyMapping([`url-mapping file not found: ${path}`]);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return emptyMapping([`Invalid JSON in url-mapping file: ${path}`]);
	}

	const { map, warnings } = parseUrlMappingJson(parsed, path);
	const documents = new Map<string, object>();
	for (const [url, relative] of map) {
		try {
			const body = await readProjectRelativeText(root, relative);
			const doc: unknown = JSON.parse(body);
			if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
				warnings.push(`Mapped file is not a JSON object: ${relative} (${url})`);
				continue;
			}
			documents.set(url, doc);
		} catch {
			warnings.push(`Mapped file not found or invalid JSON: ${relative} (${url})`);
		}
	}
	return { map, documents, warnings };
}
