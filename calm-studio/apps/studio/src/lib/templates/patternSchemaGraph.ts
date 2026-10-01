// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Project a CALM CLI pattern JSON Schema to a canvas architecture and back (R55–R56).
 */

import type { CalmArchitecture, CalmNode, CalmRelationship } from '@calmstudio/calm-core';

function constString(schema: unknown): string | undefined {
	const value = schemaConst(schema);
	return typeof value === 'string' ? value : undefined;
}

/** JSON Schema `const` payload, or undefined when the keyword is absent. */
function schemaConst(schema: unknown): unknown {
	if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return undefined;
	return (schema as Record<string, unknown>)['const'];
}

function prefixItems(schema: unknown): unknown[] {
	if (!schema || typeof schema !== 'object') return [];
	const rec = schema as Record<string, unknown>;
	return Array.isArray(rec['prefixItems']) ? rec['prefixItems'] : [];
}

function propertiesOf(schema: unknown): Record<string, unknown> {
	if (!schema || typeof schema !== 'object') return {};
	const rec = schema as Record<string, unknown>;
	const props = rec['properties'];
	if (!props || typeof props !== 'object') return {};
	return props as Record<string, unknown>;
}

/** Hub patterns put prefixItems on `properties.*` or under `allOf`. */
function patternPrefixItems(pattern: object, key: string): unknown[] {
	const direct = prefixItems(propertiesOf(pattern)[key]);
	if (direct.length > 0) return direct;
	const allOf = (pattern as { allOf?: unknown }).allOf;
	if (!Array.isArray(allOf)) return [];
	for (const part of allOf) {
		const items = prefixItems(propertiesOf(part)[key]);
		if (items.length > 0) return items;
	}
	return [];
}

function isRelationshipType(value: unknown): value is CalmRelationship['relationship-type'] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const rec = value as Record<string, unknown>;
	return (
		'connects' in rec ||
		'interacts' in rec ||
		'composed-of' in rec ||
		'deployed-in' in rec ||
		'options' in rec
	);
}

function relationshipTypeFromItem(
	itemProps: Record<string, unknown>
): CalmRelationship['relationship-type'] | undefined {
	const raw = itemProps['relationship-type'];
	const unwrapped = schemaConst(raw) ?? raw;
	if (isRelationshipType(unwrapped)) return unwrapped;
	const source =
		constString(propertiesOf(itemProps['source'])['node']) ?? constString(itemProps['source']);
	const dest =
		constString(propertiesOf(itemProps['destination'])['node']) ??
		constString(itemProps['destination']);
	if (source && dest) {
		return { connects: { source: { node: source }, destination: { node: dest } } };
	}
	return undefined;
}

export function patternSchemaToArchitecture(pattern: object): CalmArchitecture {
	const nodes: CalmNode[] = [];
	for (const item of patternPrefixItems(pattern, 'nodes')) {
		const itemProps = propertiesOf(item);
		const id = constString(itemProps['unique-id']);
		if (!id) continue;
		nodes.push({
			'unique-id': id,
			'node-type': constString(itemProps['node-type']) ?? 'system',
			name: constString(itemProps['name']) ?? id,
			description: constString(itemProps['description']) ?? '',
		});
	}

	const relationships: CalmRelationship[] = [];
	for (const item of patternPrefixItems(pattern, 'relationships')) {
		const itemProps = propertiesOf(item);
		const id = constString(itemProps['unique-id']);
		if (!id) continue;
		const relationshipType = relationshipTypeFromItem(itemProps);
		if (!relationshipType) continue;
		const rel: CalmRelationship = {
			'unique-id': id,
			'relationship-type': relationshipType,
		};
		const description = constString(itemProps['description']);
		if (description) rel.description = description;
		const protocol = constString(itemProps['protocol']);
		if (protocol) rel.protocol = protocol as NonNullable<CalmRelationship['protocol']>;
		relationships.push(rel);
	}

	const rec = pattern as Record<string, unknown>;
	const metadata =
		rec['metadata'] && typeof rec['metadata'] === 'object' && !Array.isArray(rec['metadata'])
			? (rec['metadata'] as Record<string, unknown>)
			: undefined;
	return (metadata ? { nodes, relationships, metadata } : { nodes, relationships }) as CalmArchitecture;
}

function constSchema(value: string): object {
	return { const: value };
}

function nodeToPrefixItem(node: CalmNode): object {
	return {
		type: 'object',
		properties: {
			'unique-id': constSchema(node['unique-id']),
			'node-type': constSchema(node['node-type']),
			name: constSchema(node.name),
			description: constSchema(node.description ?? ''),
		},
	};
}

function relationshipToPrefixItem(rel: CalmRelationship): object {
	const properties: Record<string, unknown> = {
		'unique-id': constSchema(rel['unique-id']),
		'relationship-type': { const: rel['relationship-type'] },
	};
	if (rel.description) properties['description'] = constSchema(rel.description);
	if (rel.protocol) properties['protocol'] = constSchema(rel.protocol);
	return { type: 'object', properties };
}

export function architectureToPatternSchema(arch: CalmArchitecture, base: object = {}): object {
	const rec = { ...(base as Record<string, unknown>) };
	const archMeta = (arch as { metadata?: unknown }).metadata;
	if (archMeta && typeof archMeta === 'object') rec['metadata'] = archMeta;
	const props = {
		...((rec['properties'] as Record<string, unknown> | undefined) ?? {}),
		nodes: {
			type: 'array',
			prefixItems: arch.nodes.map(nodeToPrefixItem),
			minItems: arch.nodes.length,
			maxItems: arch.nodes.length,
		},
		relationships: {
			type: 'array',
			prefixItems: arch.relationships.map(relationshipToPrefixItem),
			minItems: arch.relationships.length,
			maxItems: arch.relationships.length,
		},
	};
	return {
		...rec,
		$schema: rec['$schema'] ?? 'https://json-schema.org/draft/2020-12/schema',
		type: 'object',
		properties: props,
	};
}
