// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentLoadError } from '@finos/calm-shared/document-loader-types';
import { createDefaultProjectConfig, isCalmProjectConfig } from '$lib/project/defaults';
import {
	lookupMappedUrl,
	parseUrlMappingJson,
	resolveMappingValue,
} from '$lib/project/urlMapping';
import { MappedCalmDocumentLoader } from '$lib/templates/mappedCalmLoader';

const { readProjectRelativeText } = vi.hoisted(() => ({
	readProjectRelativeText: vi.fn(),
}));

vi.mock('$lib/project/projectFs', () => ({
	readProjectRelativeText,
}));

describe('urlMapping.path resolve (R75)', () => {
	it('resolves values relative to the mapping file directory', () => {
		expect(resolveMappingValue('url-mapping.json', 'standards/difa-standard.json')).toBe(
			'standards/difa-standard.json'
		);
		expect(resolveMappingValue('overlay/url-mapping.json', '../standards/x.json')).toBe(
			'standards/x.json'
		);
		expect(resolveMappingValue('overlay/url-mapping.json', 'standards/x.json')).toBe(
			'overlay/standards/x.json'
		);
	});

	it('rejects values that escape the project root', () => {
		expect(resolveMappingValue('url-mapping.json', '../outside.json')).toBeNull();
	});

	it('parses CLI / CEngineering-App mapping shape', () => {
		const { map, warnings } = parseUrlMappingJson(
			{
				'https://schemas.difa.creditas.cz/calm/standards/difa-standard.json':
					'standards/difa-standard.json',
			},
			'url-mapping.json'
		);
		expect(warnings).toEqual([]);
		expect(map.get('https://schemas.difa.creditas.cz/calm/standards/difa-standard.json')).toBe(
			'standards/difa-standard.json'
		);
	});

	it('requires an exact URL key match', () => {
		const { map } = parseUrlMappingJson(
			{ 'https://example.com/std.json': 'std.json' },
			'url-mapping.json'
		);
		expect(lookupMappedUrl('https://example.com/std.json', map, null).kind).toBe('mapped');
		expect(lookupMappedUrl('https://example.com/std.json/', map, null).kind).toBe('unmapped');
	});

	it('skips Hub instance URLs even when a mapping key exists', () => {
		const url = 'http://localhost:8080/calm/namespaces/onebank/architectures/4/versions/1.0.1';
		const { map } = parseUrlMappingJson({ [url]: 'local.json' }, 'url-mapping.json');
		expect(lookupMappedUrl(url, map, 'http://localhost:8080')).toEqual({ kind: 'hub' });
		const loader = new MappedCalmDocumentLoader(
			new Map([[url, { $id: url }]]),
			map,
			'http://localhost:8080'
		);
		expect(loader.resolvePath(url)).toBeUndefined();
	});

	it('accepts optional urlMapping.path on .calmrj', () => {
		const cfg = createDefaultProjectConfig('onebank');
		expect(isCalmProjectConfig({ ...cfg, urlMapping: { path: 'url-mapping.json' } })).toBe(true);
		expect(isCalmProjectConfig({ ...cfg, urlMapping: { path: 1 } } as unknown)).toBe(false);
	});
});

describe('loadUrlMappingFromProject', () => {
	beforeEach(() => {
		readProjectRelativeText.mockReset();
	});

	it('returns an empty map when the mapping file is missing', async () => {
		readProjectRelativeText.mockRejectedValue(new Error('not found'));
		const { loadUrlMappingFromProject } = await import('$lib/project/urlMappingLoad');
		const loaded = await loadUrlMappingFromProject(
			{} as FileSystemDirectoryHandle,
			'url-mapping.json'
		);
		expect(loaded.map.size).toBe(0);
		expect(loaded.documents.size).toBe(0);
		expect(loaded.warnings).toEqual(['url-mapping file not found: url-mapping.json']);
	});

	it('preloads mapped JSON relative to the mapping file', async () => {
		readProjectRelativeText.mockImplementation(async (_root, path: string) => {
			if (path === 'overlay/url-mapping.json') {
				return JSON.stringify({
					'https://example.com/std.json': '../standards/std.json',
				});
			}
			if (path === 'standards/std.json') {
				return JSON.stringify({ $id: 'https://example.com/std.json', type: 'object' });
			}
			throw new Error(`unexpected path ${path}`);
		});
		const { loadUrlMappingFromProject } = await import('$lib/project/urlMappingLoad');
		const loaded = await loadUrlMappingFromProject(
			{} as FileSystemDirectoryHandle,
			'overlay/url-mapping.json'
		);
		expect(loaded.warnings).toEqual([]);
		expect(loaded.map.get('https://example.com/std.json')).toBe('standards/std.json');
		expect(loaded.documents.get('https://example.com/std.json')).toEqual({
			$id: 'https://example.com/std.json',
			type: 'object',
		});
	});
});

describe('MappedCalmDocumentLoader', () => {
	it('throws recoverable when the URL is not mapped', async () => {
		const loader = new MappedCalmDocumentLoader(new Map(), new Map(), null);
		await expect(loader.loadMissingDocument('https://example.com/missing.json', 'schema')).rejects.toMatchObject({
			name: 'OPERATION_NOT_IMPLEMENTED',
			recoverable: true,
		});
	});

	it('returns a mapped document without fetch', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const doc = { $id: 'https://example.com/std.json' };
		const loader = new MappedCalmDocumentLoader(
			new Map([['https://example.com/std.json', doc]]),
			new Map([['https://example.com/std.json', 'standards/std.json']]),
			null
		);
		await expect(loader.loadMissingDocument('https://example.com/std.json', 'schema')).resolves.toBe(doc);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});

	it('does not resolve Hub URLs from the map', async () => {
		const url = 'http://localhost:8080/calm/namespaces/onebank/architectures/1/versions/1.0.0';
		const loader = new MappedCalmDocumentLoader(
			new Map([[url, { $id: url }]]),
			new Map([[url, 'local.json']]),
			'http://localhost:8080'
		);
		await expect(loader.loadMissingDocument(url, 'schema')).rejects.toBeInstanceOf(DocumentLoadError);
		expect(loader.resolvePath(url)).toBeUndefined();
	});
});
