// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Build metadata form fields from a loaded CALM Standard / Pattern JSON Schema (R17).
 */

import type { MetadataFieldDescriptor } from './metadataForm';

const RESERVED = new Set(['building-block-style', 'fidelity-style', '_layout']);
const MAX_DEPTH = 3;

export type MetadataSchemaKind = 'node' | 'relationship';

export type MetadataFieldsFromSchema = {
	fields: MetadataFieldDescriptor[];
	source?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pointerGet(doc: unknown, pointer: string): unknown {
	if (!pointer) return doc;
	const parts = pointer
		.replace(/^\//, '')
		.split('/')
		.filter(Boolean)
		.map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
	let current: unknown = doc;
	for (const part of parts) {
		if (!isRecord(current)) return undefined;
		current = current[part];
	}
	return current;
}

function defsOf(doc: object): Record<string, unknown> | undefined {
	const rec = doc as Record<string, unknown>;
	const defs = rec['$defs'] ?? rec['defs'];
	return isRecord(defs) ? defs : undefined;
}

function resolveRef(
	ref: string,
	rootDoc: object,
	schemas: Map<string, object>
): unknown {
	const [idPart, pointerPart] = ref.split('#');
	const pointer = pointerPart ?? '';
	if (!idPart) return pointerGet(rootDoc, pointer);
	const doc = schemas.get(idPart);
	if (!doc) return undefined;
	return pointer ? pointerGet(doc, pointer) : doc;
}

function unwrapSchema(
	raw: unknown,
	rootDoc: object,
	schemas: Map<string, object>,
	seen: Set<string>
): Record<string, unknown> | undefined {
	if (raw === true || raw === false || raw == null) return undefined;
	if (!isRecord(raw)) return undefined;
	const ref = raw['$ref'];
	if (typeof ref === 'string') {
		if (seen.has(ref)) return raw;
		seen.add(ref);
		const resolved = resolveRef(ref, rootDoc, schemas);
		const inner = unwrapSchema(resolved, rootDoc, schemas, seen);
		const { $ref: _omit, ...rest } = raw;
		return inner ? { ...inner, ...rest } : rest;
	}
	if (Array.isArray(raw['allOf'])) {
		const merged: Record<string, unknown> = { ...raw };
		const properties: Record<string, unknown> = isRecord(raw['properties'])
			? { ...raw['properties'] }
			: {};
		const required = new Set<string>(
			Array.isArray(raw['required']) ? raw['required'].filter((x): x is string => typeof x === 'string') : []
		);
		for (const part of raw['allOf']) {
			if (isRecord(part) && ('if' in part || 'then' in part || 'else' in part)) continue;
			const unwrapped = unwrapSchema(part, rootDoc, schemas, seen);
			if (!unwrapped) continue;
			if (isRecord(unwrapped['properties'])) {
				Object.assign(properties, unwrapped['properties']);
			}
			if (Array.isArray(unwrapped['required'])) {
				for (const key of unwrapped['required']) {
					if (typeof key === 'string') required.add(key);
				}
			}
		}
		merged['properties'] = properties;
		merged['required'] = [...required];
		return merged;
	}
	return raw;
}

function labelOf(key: string, schema: Record<string, unknown>): string {
	if (typeof schema['title'] === 'string' && schema['title'].trim()) return schema['title'];
	return key
		.replace(/[-_]/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/^./, (c) => c.toUpperCase());
}

function enumValuesOf(schema: Record<string, unknown>): string[] | undefined {
	if (!Array.isArray(schema['enum'])) return undefined;
	const values = schema['enum'].filter((v): v is string => typeof v === 'string');
	return values.length > 0 ? values : undefined;
}

function fieldsFromObjectSchema(
	schema: Record<string, unknown>,
	rootDoc: object,
	schemas: Map<string, object>,
	path: string[],
	depth: number
): MetadataFieldDescriptor[] {
	if (depth > MAX_DEPTH) return [];
	const properties = schema['properties'];
	if (!isRecord(properties)) return [];
	const required = new Set(
		Array.isArray(schema['required'])
			? schema['required'].filter((x): x is string => typeof x === 'string')
			: []
	);
	const fields: MetadataFieldDescriptor[] = [];
	for (const [key, rawProp] of Object.entries(properties)) {
		if (RESERVED.has(key)) continue;
		if (rawProp === true || rawProp === false) continue;
		const prop = unwrapSchema(rawProp, rootDoc, schemas, new Set());
		if (!prop) continue;
		const nextPath = [...path, key];
		const nestedProps = isRecord(prop['properties']) ? prop['properties'] : undefined;
		const isObject =
			prop['type'] === 'object' ||
			(Array.isArray(prop['type']) && prop['type'].includes('object')) ||
			!!nestedProps;
		if (isObject && nestedProps && depth < MAX_DEPTH) {
			fields.push(
				...fieldsFromObjectSchema(prop, rootDoc, schemas, nextPath, depth + 1)
			);
			continue;
		}
		const enums = enumValuesOf(prop);
		fields.push({
			key,
			label: labelOf(key, prop),
			required: required.has(key),
			kind: enums ? 'enum' : 'string',
			...(enums ? { enumValues: enums } : {}),
			path: nextPath,
			...(typeof prop['const'] === 'string' ? { readOnly: true } : {}),
		});
	}
	return fields;
}

function namedMetadataDef(
	defs: Record<string, unknown>,
	kind: MetadataSchemaKind
): { name: string; schema: unknown } | undefined {
	const suffix = kind === 'node' ? 'node-metadata' : 'relationship-metadata';
	const preferred =
		kind === 'node'
			? ['difa-node-metadata', 'archimate-node-metadata']
			: ['difa-relationship-metadata', 'archimate-relationship-metadata'];
	for (const name of preferred) {
		if (name in defs) return { name, schema: defs[name] };
	}
	for (const [name, schema] of Object.entries(defs)) {
		if (name.endsWith(suffix)) return { name, schema };
	}
	return undefined;
}

function metadataSchemaFromNodeOrRelationship(
	schema: unknown,
	rootDoc: object,
	schemas: Map<string, object>
): unknown {
	const unwrapped = unwrapSchema(schema, rootDoc, schemas, new Set());
	if (!unwrapped) return undefined;
	const properties = unwrapped['properties'];
	if (!isRecord(properties)) return undefined;
	return properties['metadata'];
}

/**
 * Derive form fields from loaded Standard / Pattern documents.
 * Pack hardcoded fields still win when the caller already has them (ArchiMate).
 */
export function metadataFieldsFromSchemas(
	schemas: Map<string, object>,
	kind: MetadataSchemaKind
): MetadataFieldsFromSchema {
	for (const [url, doc] of schemas) {
		const defs = defsOf(doc);
		if (!defs) continue;
		const named = namedMetadataDef(defs, kind);
		if (!named) continue;
		const unwrapped = unwrapSchema(named.schema, doc, schemas, new Set());
		if (!unwrapped) continue;
		const fields = fieldsFromObjectSchema(unwrapped, doc, schemas, [], 1);
		if (fields.length > 0) {
			return { fields, source: `${url}#/$defs/${named.name}` };
		}
	}

	const slot = kind === 'node' ? 'node' : 'relationship';
	for (const [url, doc] of schemas) {
		const defs = defsOf(doc);
		const fromDefs = defs?.[slot];
		const fromProps = metadataSchemaFromNodeOrRelationship(fromDefs ?? doc, doc, schemas);
		if (!fromProps) continue;
		const unwrapped = unwrapSchema(fromProps, doc, schemas, new Set());
		if (!unwrapped) continue;
		const fields = fieldsFromObjectSchema(unwrapped, doc, schemas, [], 1);
		if (fields.length > 0) {
			return { fields, source: `${url} ${slot}.metadata` };
		}
	}

	const itemsPath = kind === 'node' ? ['properties', 'nodes', 'items'] : ['properties', 'relationships', 'items'];
	for (const [url, doc] of schemas) {
		let current: unknown = doc;
		for (const part of itemsPath) {
			if (!isRecord(current)) {
				current = undefined;
				break;
			}
			current = current[part];
		}
		const item = unwrapSchema(current, doc, schemas, new Set());
		const meta = metadataSchemaFromNodeOrRelationship(item, doc, schemas);
		const unwrapped = unwrapSchema(meta, doc, schemas, new Set());
		if (!unwrapped) continue;
		const fields = fieldsFromObjectSchema(unwrapped, doc, schemas, [], 1);
		if (fields.length > 0) {
			return { fields, source: `${url} ${kind} items.metadata` };
		}
	}

	return { fields: [] };
}
