// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Browser DocumentLoader for project url-mapping.json (R75).
 * Preloads mapped JSON; Hub instance URLs skip the map; no network fetch.
 */

import {
	DocumentLoadError,
	type DocumentLoader,
} from '@finos/calm-shared/document-loader-types';
import type { SchemaDirectory } from '@finos/calm-shared/generate';
import type { CalmDocumentType } from '@finos/calm-models/types';
import { isHubArchitectureUrl } from '$lib/hub/hubUrl';
import { loadUrlMappingFromProject } from '$lib/project/urlMappingLoad';
import { createBundledCalmDocumentLoader } from './bundledCalmSchemas';

export type UrlMappingSource = {
	root: FileSystemDirectoryHandle | null;
	mappingPath?: string;
	hubUrl?: string | null;
};

export class MappedCalmDocumentLoader implements DocumentLoader {
	constructor(
		private readonly documents: Map<string, object>,
		private readonly paths: Map<string, string>,
		private readonly hubBase: string | null
	) {}

	async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
		for (const [url, doc] of this.documents) {
			if (isHubArchitectureUrl(url, this.hubBase)) continue;
			schemaDirectory.storeDocument(url, 'schema', doc);
			const id = (doc as { $id?: unknown }).$id;
			if (typeof id === 'string' && id !== url) {
				schemaDirectory.storeDocument(id, 'schema', doc);
			}
		}
	}

	async loadMissingDocument(documentId: string, _type: CalmDocumentType): Promise<object> {
		if (isHubArchitectureUrl(documentId, this.hubBase)) {
			throw new DocumentLoadError({
				name: 'OPERATION_NOT_IMPLEMENTED',
				message: `Hub URL skipped by url-mapping: ${documentId}`,
			});
		}
		const doc = this.documents.get(documentId);
		if (doc) return doc;
		if (this.paths.has(documentId)) {
			throw new DocumentLoadError({
				name: 'UNKNOWN',
				message: `Mapped file missing for ${documentId}`,
				recoverable: false,
			});
		}
		throw new DocumentLoadError({
			name: 'OPERATION_NOT_IMPLEMENTED',
			message: `Not in url-mapping: ${documentId}`,
		});
	}

	resolvePath(reference: string): string | undefined {
		if (isHubArchitectureUrl(reference, this.hubBase)) return undefined;
		return this.paths.get(reference);
	}
}

export class CompositeCalmDocumentLoader implements DocumentLoader {
	constructor(private readonly loaders: DocumentLoader[]) {}

	async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
		for (const loader of this.loaders) {
			await loader.initialise(schemaDirectory);
		}
	}

	async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
		let last: unknown;
		for (const loader of this.loaders) {
			try {
				return await loader.loadMissingDocument(documentId, type);
			} catch (err) {
				if (err instanceof DocumentLoadError && !err.recoverable) throw err;
				last = err;
			}
		}
		if (last instanceof Error) throw last;
		throw new DocumentLoadError({
			name: 'OPERATION_NOT_IMPLEMENTED',
			message: `Schema not found: ${documentId}`,
		});
	}

	resolvePath(reference: string): string | undefined {
		for (const loader of this.loaders) {
			const path = loader.resolvePath(reference);
			if (path) return path;
		}
		return undefined;
	}
}

export async function createProjectCalmDocumentLoader(
	source?: UrlMappingSource
): Promise<{ loader: DocumentLoader; warnings: string[]; map: Map<string, string> }> {
	const bundled = createBundledCalmDocumentLoader();
	if (!source?.mappingPath?.trim()) {
		return { loader: bundled, warnings: [], map: new Map() };
	}
	const loaded = await loadUrlMappingFromProject(source.root, source.mappingPath);
	const mapped = new MappedCalmDocumentLoader(
		loaded.documents,
		loaded.map,
		source.hubUrl ?? null
	);
	return {
		loader: new CompositeCalmDocumentLoader([mapped, bundled]),
		warnings: loaded.warnings,
		map: loaded.map,
	};
}
