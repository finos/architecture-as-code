import { describe, expect, it, beforeEach } from 'vitest';
import { initAllPacks } from '../../packs/index.js';
import { resetRegistry } from '../../packs/registry.js';
import {
	CALM_12_BASE_SCHEMA,
	buildSchemaForNodeType,
	ensureSchemaOnFirstElement,
	hasDocumentSchema,
} from './documentEnvelope.js';
import type { CalmArchitecture } from '../transforms/calm-editor-transformer';

describe('documentEnvelope', () => {
	beforeEach(() => {
		resetRegistry();
		initAllPacks();
	});

	it('hasDocumentSchema is false for empty model', () => {
		const arch: CalmArchitecture = { nodes: [], relationships: [] };
		expect(hasDocumentSchema(arch)).toBe(false);
	});

	it('core types write only the CALM 1.2 meta-schema', () => {
		const arch: CalmArchitecture = {
			nodes: [{ 'unique-id': 'n1', 'node-type': 'system', name: 'Sys', description: 'd' }],
			relationships: [],
		};
		const next = ensureSchemaOnFirstElement(arch, 'system');
		expect(next['$schema']).toBe(CALM_12_BASE_SCHEMA);
	});

	it('AI pack adds proposed Standard $id', () => {
		const schema = buildSchemaForNodeType('ai:llm');
		expect(schema).toContain(CALM_12_BASE_SCHEMA);
		expect(schema).toContain('https://calm.finos.org/extensions/ai/ai.standard.json');
	});
});
