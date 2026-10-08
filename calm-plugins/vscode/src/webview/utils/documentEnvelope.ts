// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { getPackForNodeType } from '../../packs/registry.js';
import type { CalmArchitecture } from '../transforms/calm-editor-transformer';

/** Base CALM 1.2 meta-schema URL. */
export const CALM_12_BASE_SCHEMA = 'https://calm.finos.org/release/1.2/meta/calm.json';

function schemaValues(model: CalmArchitecture): string[] {
	const raw = (model as Record<string, unknown>)['$schema'];
	if (!raw) return [];
	return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [String(raw)];
}

export function hasDocumentSchema(model: CalmArchitecture): boolean {
	return schemaValues(model).length > 0;
}

export function buildSchemaForNodeType(calmType: string): string | string[] {
	const schemas = [CALM_12_BASE_SCHEMA];
	const pack = getPackForNodeType(calmType);
	if (pack?.schemaUrl && !schemas.includes(pack.schemaUrl)) {
		schemas.push(pack.schemaUrl);
	}
	return schemas.length === 1 ? schemas[0]! : schemas;
}

export function ensureSchemaOnFirstElement(
	model: CalmArchitecture,
	calmType?: string
): CalmArchitecture {
	if (hasDocumentSchema(model)) return model;
	if (!model.nodes || model.nodes.length === 0) return model;

	const firstType =
		calmType ??
		(typeof model.nodes[0]?.['node-type'] === 'string'
			? (model.nodes[0]['node-type'] as string)
			: 'system');
	const schema = buildSchemaForNodeType(firstType);
	return { ...model, $schema: schema } as CalmArchitecture;
}
