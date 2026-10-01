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
/** Official JSON Schema 2020-12 meta-schemas — vendored so Studio does not fetch json-schema.org. */
import jsonSchema202012 from './json-schema-2020-12/schema.json';
import jsonSchema202012Core from './json-schema-2020-12/meta/core.json';
import jsonSchema202012Applicator from './json-schema-2020-12/meta/applicator.json';
import jsonSchema202012Unevaluated from './json-schema-2020-12/meta/unevaluated.json';
import jsonSchema202012Validation from './json-schema-2020-12/meta/validation.json';
import jsonSchema202012MetaData from './json-schema-2020-12/meta/meta-data.json';
import jsonSchema202012Format from './json-schema-2020-12/meta/format-annotation.json';
import jsonSchema202012Content from './json-schema-2020-12/meta/content.json';

const PUBLISHED_2025_03 = 'https://calm.finos.org/calm/schemas/2025-03/meta/';
const DRAFT_2025_03 = 'https://calm.finos.org/draft/2025-03/meta/';
const JSON_SCHEMA_ORG_HTTPS = 'https://json-schema.org/';
const JSON_SCHEMA_ORG_HTTP = 'http://json-schema.org/';

function schemaId(doc: object): string | undefined {
	const id = (doc as { $id?: unknown }).$id;
	return typeof id === 'string' ? id : undefined;
}

/** Hub seed patterns use /calm/schemas/2025-03; draft files use /draft/2025-03. */
export function schemaIdAliases(id: string): string[] {
	const ids = [id];
	const noHash = id.replace(/#$/, '');
	if (noHash !== id) ids.push(noHash);
	if (id.startsWith(PUBLISHED_2025_03)) {
		ids.push(DRAFT_2025_03 + id.slice(PUBLISHED_2025_03.length));
	}
	if (id.startsWith(DRAFT_2025_03)) {
		ids.push(PUBLISHED_2025_03 + id.slice(DRAFT_2025_03.length));
	}
	if (noHash.startsWith(JSON_SCHEMA_ORG_HTTPS)) {
		ids.push(JSON_SCHEMA_ORG_HTTP + noHash.slice(JSON_SCHEMA_ORG_HTTPS.length));
	}
	if (noHash.startsWith(JSON_SCHEMA_ORG_HTTP)) {
		ids.push(JSON_SCHEMA_ORG_HTTPS + noHash.slice(JSON_SCHEMA_ORG_HTTP.length));
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
		jsonSchema202012,
		jsonSchema202012Core,
		jsonSchema202012Applicator,
		jsonSchema202012Unevaluated,
		jsonSchema202012Validation,
		jsonSchema202012MetaData,
		jsonSchema202012Format,
		jsonSchema202012Content,
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

export function isBundledCalmSchemaId(documentId: string): boolean {
	return lookupBundled(bundledCalmSchemas(), documentId) !== undefined;
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
