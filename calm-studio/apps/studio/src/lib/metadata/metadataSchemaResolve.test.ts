// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	logMetadataSchemaResolution,
	METADATA_SCHEMA_LOG,
	resolveMetadataSchemas,
	seedMetadataSchemaUrls,
} from '$lib/metadata/metadataSchemaResolve';

vi.mock('@finos/calm-shared/generate', () => ({
	SchemaDirectory: class {
		async loadSchemas() {}
		async getSchema(id: string) {
			return getSchemaMock(id);
		}
	},
}));

const getSchemaMock = vi.fn();

const { createProjectCalmDocumentLoader } = vi.hoisted(() => ({
	createProjectCalmDocumentLoader: vi.fn(),
}));

vi.mock('$lib/templates/mappedCalmLoader', () => ({
	createProjectCalmDocumentLoader,
}));

vi.mock('$lib/templates/bundledCalmSchemas', () => ({
	isBundledCalmSchemaId: (id: string) => id.includes('calm.finos.org/release/1.2'),
}));

describe('seedMetadataSchemaUrls', () => {
	it('dedupes document $schema and pack schemaUrl', () => {
		expect(
			seedMetadataSchemaUrls({
				documentSchema: [
					'https://example.com/a.json',
					'https://example.com/a.json#/defs/x',
				],
				packSchemaUrl: 'https://example.com/pack.json',
			})
		).toEqual(['https://example.com/a.json', 'https://example.com/pack.json']);
	});

	it('returns empty when neither document nor pack has a schema URL', () => {
		expect(seedMetadataSchemaUrls({})).toEqual([]);
	});
});

describe('resolveMetadataSchemas', () => {
	beforeEach(() => {
		getSchemaMock.mockReset();
		createProjectCalmDocumentLoader.mockReset();
		createProjectCalmDocumentLoader.mockResolvedValue({
			loader: {},
			warnings: [],
			map: new Map([
				['https://schemas.difa.creditas.cz/calm/patterns/difa-architecture-base.json', 'standards/difa-architecture-base.json'],
			]),
		});
	});

	it('records loaded mapped schemas and follows $ref to missing URLs', async () => {
		getSchemaMock.mockImplementation(async (id: string) => {
			if (id === 'https://schemas.difa.creditas.cz/calm/patterns/difa-architecture-base.json') {
				return {
					$id: id,
					properties: {
						nodes: {
							items: {
								$ref: 'https://schemas.difa.creditas.cz/calm/standards/difa-standard.json#/$defs/node',
							},
						},
					},
				};
			}
			return undefined;
		});
		const { events } = await resolveMetadataSchemas([
			'https://schemas.difa.creditas.cz/calm/patterns/difa-architecture-base.json',
		]);
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					url: 'https://schemas.difa.creditas.cz/calm/patterns/difa-architecture-base.json',
					loaded: true,
					source: 'url-mapping',
					path: 'standards/difa-architecture-base.json',
				}),
				expect.objectContaining({
					url: 'https://schemas.difa.creditas.cz/calm/standards/difa-standard.json',
					loaded: false,
					reason: 'unmapped URL (no network fetch)',
				}),
			])
		);
	});

	it('does not fetch unmapped URLs', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		getSchemaMock.mockResolvedValue(undefined);
		const { events } = await resolveMetadataSchemas(['https://example.com/missing.json']);
		expect(events).toEqual([
			{
				url: 'https://example.com/missing.json',
				loaded: false,
				reason: 'unmapped URL (no network fetch)',
			},
		]);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
});

describe('logMetadataSchemaResolution', () => {
	it('logs loaded and not-loaded schema URLs', () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		logMetadataSchemaResolution({
			elementId: 'coa',
			nodeType: 'difa-arch:application-component',
			formFieldCount: 0,
			seedUrls: ['https://example.com/std.json'],
			mappingPath: 'url-mapping.json',
			result: {
				mappingWarnings: ['url-mapping file not found: url-mapping.json'],
				documents: new Map(),
				events: [
					{
						url: 'https://example.com/std.json',
						loaded: true,
						source: 'url-mapping',
						path: 'standards/std.json',
					},
					{
						url: 'https://example.com/other.json',
						loaded: false,
						reason: 'unmapped URL (no network fetch)',
					},
				],
			},
		});
		expect(info.mock.calls.some((c) => String(c[0]).includes(METADATA_SCHEMA_LOG) && String(c[1]).includes('loaded'))).toBe(
			true
		);
		expect(warn.mock.calls.some((c) => String(c[2]).includes('https://example.com/other.json'))).toBe(true);
		expect(
			warn.mock.calls.some((c) => String(c[1]).includes('no schema form fields'))
		).toBe(true);
		info.mockRestore();
		warn.mockRestore();
	});
});
