// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmArchitecture } from '@calmstudio/calm-core';
import { getPackForNodeType } from '@calmstudio/extensions';

/** Base CALM 1.2 meta-schema URL. */
export const CALM_12_BASE_SCHEMA = 'https://calm.finos.org/release/1.2/meta/calm.json';

function schemaValues(model: CalmArchitecture): string[] {
	const raw = model['$schema'];
	if (!raw) return [];
	return Array.isArray(raw) ? raw : [raw];
}

/** Returns true when the document already declares a schema envelope. */
export function hasDocumentSchema(model: CalmArchitecture): boolean {
	return schemaValues(model).length > 0;
}

/**
 * Build `$schema` value for the first palette element.
 * Includes base CALM 1.2 schema and optional extension pack schemaUrl.
 */
export function buildSchemaForNodeType(calmType: string): string | string[] {
	const schemas = [CALM_12_BASE_SCHEMA];
	const pack = getPackForNodeType(calmType);
	if (pack?.schemaUrl && !schemas.includes(pack.schemaUrl)) {
		schemas.push(pack.schemaUrl);
	}
	return schemas.length === 1 ? schemas[0]! : schemas;
}

/**
 * Apply schema envelope when the document gains its first node and has no schema yet.
 */
export function ensureSchemaOnFirstElement(
	model: CalmArchitecture,
	calmType?: string
): CalmArchitecture {
	if (hasDocumentSchema(model)) return model;
	if (model.nodes.length === 0) return model;

	const schema = buildSchemaForNodeType(calmType ?? model.nodes[0]?.['node-type'] ?? 'system');
	return { ...model, '$schema': schema } as CalmArchitecture & {
		'$schema': string | string[];
	};
}

/** Preserve envelope fields when syncing nodes/relationships from canvas. */
export function mergeArchitectureBody(
	envelope: CalmArchitecture,
	body: Pick<CalmArchitecture, 'nodes' | 'relationships'>
): CalmArchitecture {
	const next: CalmArchitecture = {
		...envelope,
		nodes: body.nodes,
		relationships: body.relationships,
	};
	if (envelope['$schema'] !== undefined) {
		next['$schema'] = envelope['$schema'];
	}
	return next;
}
