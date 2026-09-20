// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import {
	DocumentLoadError,
	type DocumentLoader,
} from '@finos/calm-shared/document-loader-types';
import type { SchemaDirectory } from '@finos/calm-shared/generate';
import type { CalmDocumentType } from '@finos/calm-models/types';

import core10 from '$calm-release/1.0/meta/core.json';
import calm10 from '$calm-release/1.0/meta/calm.json';
import iface10 from '$calm-release/1.0/meta/interface.json';
import control10 from '$calm-release/1.0/meta/control.json';
import core11 from '$calm-release/1.1/meta/core.json';
import calm11 from '$calm-release/1.1/meta/calm.json';
import iface11 from '$calm-release/1.1/meta/interface.json';
import control11 from '$calm-release/1.1/meta/control.json';
import core12 from '$calm-release/1.2/meta/core.json';
import calm12 from '$calm-release/1.2/meta/calm.json';
import iface12 from '$calm-release/1.2/meta/interface.json';
import control12 from '$calm-release/1.2/meta/control.json';
import draftCore from '$calm-draft/2025-03/meta/core.json';
import draftCalm from '$calm-draft/2025-03/meta/calm.json';
import draftIface from '$calm-draft/2025-03/meta/interface.json';
import draftControl from '$calm-draft/2025-03/meta/control.json';
import draftFlow from '$calm-draft/2025-03/meta/flow.json';

const PUBLISHED_2025_03 = 'https://calm.finos.org/calm/schemas/2025-03/meta/';
const DRAFT_2025_03 = 'https://calm.finos.org/draft/2025-03/meta/';

function schemaId(doc: object): string | undefined {
	const id = (doc as { $id?: unknown }).$id;
	return typeof id === 'string' ? id : undefined;
}

/** Hub seed patterns use /calm/schemas/2025-03; draft files use /draft/2025-03. */
export function schemaIdAliases(id: string): string[] {
	const ids = [id];
	if (id.startsWith(PUBLISHED_2025_03)) {
		ids.push(DRAFT_2025_03 + id.slice(PUBLISHED_2025_03.length));
	}
	if (id.startsWith(DRAFT_2025_03)) {
		ids.push(PUBLISHED_2025_03 + id.slice(DRAFT_2025_03.length));
	}
	return [...new Set(ids)];
}

function putSchema(map: Map<string, object>, doc: object): void {
	const id = schemaId(doc);
	if (!id) return;
	for (const key of schemaIdAliases(id)) {
		map.set(key, doc);
	}
}

export function bundledCalmSchemas(): Map<string, object> {
	const map = new Map<string, object>();
	for (const doc of [
		core10, calm10, iface10, control10,
		core11, calm11, iface11, control11,
		core12, calm12, iface12, control12,
		draftCore, draftCalm, draftIface, draftControl, draftFlow,
	] as object[]) {
		putSchema(map, doc);
	}
	return map;
}

function lookupBundled(schemas: Map<string, object>, documentId: string): object | undefined {
	for (const key of schemaIdAliases(documentId)) {
		const local = schemas.get(key);
		if (local) return local;
	}
	return undefined;
}

function isBrowserBlockedHost(documentId: string): boolean {
	try {
		const host = new URL(documentId).hostname;
		return host === 'calm.finos.org' || host === 'json-schema.org';
	} catch {
		return false;
	}
}

export class BundledCalmDocumentLoader implements DocumentLoader {
	constructor(private readonly schemas: Map<string, object> = bundledCalmSchemas()) {}

	async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
		for (const [id, doc] of this.schemas) {
			schemaDirectory.storeDocument(id, 'schema', doc);
		}
	}

	async loadMissingDocument(documentId: string, _type: CalmDocumentType): Promise<object> {
		const local = lookupBundled(this.schemas, documentId);
		if (local) return local;
		if (/^https?:\/\//.test(documentId) && !isBrowserBlockedHost(documentId)) {
			try {
				const res = await fetch(documentId);
				if (res.ok) return (await res.json()) as object;
			} catch {
				// Cross-origin Hub/schema fetch failed; fall through to a recoverable miss.
			}
		}
		throw new DocumentLoadError({
			name: 'OPERATION_NOT_IMPLEMENTED',
			message: `Schema not bundled: ${documentId}`,
		});
	}

	resolvePath(): string | undefined {
		return undefined;
	}
}

export function createBundledCalmDocumentLoader(): BundledCalmDocumentLoader {
	return new BundledCalmDocumentLoader();
}
