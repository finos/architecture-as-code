// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test, beforeEach } from 'vitest';
import { initAllPacks } from '@calmstudio/extensions';
import {
	CALM_12_BASE_SCHEMA,
	buildSchemaForNodeType,
	ensureSchemaOnFirstElement,
	hasDocumentSchema,
} from '$lib/stores/documentEnvelope';
import type { CalmArchitecture } from '@calmstudio/calm-core';

describe('documentEnvelope', () => {
	beforeEach(() => {
		initAllPacks();
	});

	test('hasDocumentSchema is false for empty model', () => {
		const arch: CalmArchitecture = { nodes: [], relationships: [] };
		expect(hasDocumentSchema(arch)).toBe(false);
	});

	test('ensureSchemaOnFirstElement adds base CALM 1.2 schema', () => {
		const arch: CalmArchitecture = {
			nodes: [
				{
					'unique-id': 'n1',
					'node-type': 'system',
					name: 'Sys',
					description: 'd',
				},
			],
			relationships: [],
		};
		const next = ensureSchemaOnFirstElement(arch, 'system');
		expect(next['$schema']).toBe(CALM_12_BASE_SCHEMA);
	});

	test('buildSchemaForNodeType includes extension schemaUrl for pack types', () => {
		const schema = buildSchemaForNodeType('ai:llm');
		expect(schema).toContain(CALM_12_BASE_SCHEMA);
		expect(schema).toContain('https://calm.finos.org/release/1.2/meta/ai.json');
	});
});
