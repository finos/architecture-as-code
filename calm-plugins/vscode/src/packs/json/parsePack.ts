// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type {
	NodeTypeEntry,
	PackColor,
	PackDefinition,
	RelationshipTypeEntry,
} from '../types.js';

export const PACK_SCHEMA_ID = 'https://calm.finos.org/schemas/calm-extension-pack.schema.json';

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$/;
const COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const CALM_VARIANTS = new Set([
	'connects',
	'composed-of',
	'deployed-in',
	'interacts',
	'options',
]);

export type ParsePackResult =
	| { ok: true; pack: PackDefinition }
	| { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseColor(value: unknown, path: string, errors: string[]): PackColor | undefined {
	if (!isRecord(value)) {
		errors.push(`${path} must be an object`);
		return undefined;
	}
	const bg = value['bg'];
	const border = value['border'];
	const stroke = value['stroke'];
	if (typeof bg !== 'string' || !COLOR_PATTERN.test(bg)) {
		errors.push(`${path}.bg must be a hex color`);
	}
	if (typeof border !== 'string' || !COLOR_PATTERN.test(border)) {
		errors.push(`${path}.border must be a hex color`);
	}
	if (typeof stroke !== 'string' || !COLOR_PATTERN.test(stroke)) {
		errors.push(`${path}.stroke must be a hex color`);
	}
	if (errors.some((e) => e.startsWith(path))) return undefined;
	const color: PackColor = {
		bg: bg as string,
		border: border as string,
		stroke: stroke as string,
	};
	if (typeof value['badge'] === 'string') {
		color.badge = value['badge'];
	}
	return color;
}

function parseIcon(value: unknown, path: string, errors: string[]): string | undefined {
	if (typeof value === 'string') {
		if (!value.trim()) {
			errors.push(`${path} must be a non-empty SVG string`);
			return undefined;
		}
		return value;
	}
	if (isRecord(value) && typeof value['href'] === 'string' && value['href'].trim()) {
		return value['href'];
	}
	errors.push(`${path} must be an inline SVG string or { href }`);
	return undefined;
}

function parseNode(
	value: unknown,
	path: string,
	errors: string[]
): NodeTypeEntry | undefined {
	if (!isRecord(value)) {
		errors.push(`${path} must be an object`);
		return undefined;
	}
	const typeId = value['typeId'];
	const label = value['label'];
	if (typeof typeId !== 'string' || !typeId.trim()) {
		errors.push(`${path}.typeId is required`);
	}
	if (typeof label !== 'string' || !label.trim()) {
		errors.push(`${path}.label is required`);
	}
	const icon = parseIcon(value['icon'], `${path}.icon`, errors);
	const color = parseColor(value['color'], `${path}.color`, errors);
	if (typeof typeId !== 'string' || typeof label !== 'string' || !icon || !color) {
		return undefined;
	}
	const node: NodeTypeEntry = { typeId, label, icon, color };
	if (typeof value['description'] === 'string') {
		node.description = value['description'];
	}
	if (value['isContainer'] === true) {
		node.isContainer = true;
	}
	if (value['rectangleLayout'] === true) {
		node.rectangleLayout = true;
	}
	if (Array.isArray(value['defaultChildren'])) {
		const children = value['defaultChildren'].filter(
			(c): c is string => typeof c === 'string' && c.trim().length > 0
		);
		if (children.length > 0) {
			node.defaultChildren = children;
		}
	}
	if (isRecord(value['defaults']) && isRecord(value['defaults']['metadata'])) {
		node.defaults = { metadata: value['defaults']['metadata'] };
	}
	return node;
}

function parseRelationship(
	value: unknown,
	path: string,
	errors: string[]
): RelationshipTypeEntry | undefined {
	if (!isRecord(value)) {
		errors.push(`${path} must be an object`);
		return undefined;
	}
	const typeId = value['typeId'];
	const label = value['label'];
	if (typeof typeId !== 'string' || !typeId.trim()) {
		errors.push(`${path}.typeId is required`);
	}
	if (typeof label !== 'string' || !label.trim()) {
		errors.push(`${path}.label is required`);
	}
	if (typeof typeId !== 'string' || typeof label !== 'string') {
		return undefined;
	}
	const rel: RelationshipTypeEntry = { typeId, label };
	if (typeof value['description'] === 'string') {
		rel.description = value['description'];
	}
	const variant = value['calmCoreVariant'];
	if (variant !== undefined) {
		if (typeof variant !== 'string' || !CALM_VARIANTS.has(variant)) {
			errors.push(`${path}.calmCoreVariant is not a CALM 1.2 relationship-type variant`);
		} else {
			rel.calmCoreVariant = variant as NonNullable<RelationshipTypeEntry['calmCoreVariant']>;
		}
	}
	return rel;
}

/**
 * Validate a pack JSON document and map it to the runtime PackDefinition.
 * `schemaUrl` is `standard.$id`. Invalid documents fail closed.
 */
export function parsePackJson(value: unknown): ParsePackResult {
	const errors: string[] = [];
	if (!isRecord(value)) {
		return { ok: false, errors: ['Pack document must be a JSON object'] };
	}
	if (value['$schema'] !== PACK_SCHEMA_ID) {
		errors.push(`$schema must be ${PACK_SCHEMA_ID}`);
	}
	const id = value['id'];
	const label = value['label'];
	const version = value['version'];
	if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
		errors.push('id must match ^[a-z][a-z0-9-]*$');
	}
	if (typeof label !== 'string' || !label.trim()) {
		errors.push('label is required');
	}
	if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
		errors.push('version must be semver (x.y.z)');
	}
	if (!isRecord(value['standard']) || typeof value['standard']['$id'] !== 'string') {
		errors.push('standard.$id is required');
	}
	const color = parseColor(value['color'], 'color', errors);
	if (!Array.isArray(value['nodes']) || value['nodes'].length < 1) {
		errors.push('nodes must be a non-empty array');
	}
	if (!Array.isArray(value['relationships']) || value['relationships'].length < 1) {
		errors.push('relationships must be a non-empty array');
	}

	const nodes: NodeTypeEntry[] = [];
	if (Array.isArray(value['nodes'])) {
		value['nodes'].forEach((node, i) => {
			const parsed = parseNode(node, `nodes[${i}]`, errors);
			if (parsed) nodes.push(parsed);
		});
	}

	const relationships: RelationshipTypeEntry[] = [];
	if (Array.isArray(value['relationships'])) {
		value['relationships'].forEach((rel, i) => {
			const parsed = parseRelationship(rel, `relationships[${i}]`, errors);
			if (parsed) relationships.push(parsed);
		});
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	const pack: PackDefinition = {
		id: id as string,
		label: label as string,
		version: version as string,
		color: color!,
		nodes,
		relationships,
		schemaUrl: (value['standard'] as Record<string, unknown>)['$id'] as string,
	};
	const href = (value['standard'] as Record<string, unknown>)['href'];
	if (typeof href === 'string' && href.trim()) {
		pack.standardHref = href;
	}
	if (
		isRecord(value['relationshipDefaults']) &&
		isRecord(value['relationshipDefaults']['metadata'])
	) {
		pack.relationshipDefaults = {
			metadata: value['relationshipDefaults']['metadata'],
		};
	}
	return { ok: true, pack };
}

/** Warn when the same typeId appears in two different pack ids. First mapping stays. */
export function duplicateTypeIdWarnings(packs: PackDefinition[]): string[] {
	const seen = new Map<string, string>();
	const warnings: string[] = [];
	for (const pack of packs) {
		for (const node of pack.nodes) {
			const owner = seen.get(node.typeId);
			if (owner && owner !== pack.id) {
				warnings.push(
					`Duplicate typeId "${node.typeId}" in packs "${owner}" and "${pack.id}"`
				);
			} else if (!owner) {
				seen.set(node.typeId, pack.id);
			}
		}
	}
	return warnings;
}
