// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	loadFromRef,
	loadFromPaste,
	getCachedCatalog,
	clearCatalogCache,
} from '$lib/stores/gemaraCatalogs';

// A pasted catalog body (metadata + controls; only metadata is read).
const body = {
	metadata: { id: 'mara-controls', version: '0.3.0', title: 'MARA Controls' },
	controls: [{ id: 'MARA-VS-007', title: 'Vector store tenant isolation' }],
};

// The hub catalog DETAIL response loadFromRef now consumes.
const detail = {
	namespace: 'finos',
	catalog_id: 'mara-controls',
	title: 'MARA Controls',
	type: 'ControlCatalog',
	latest_version: '0.3.0',
	latest_manifest_digest: 'sha256:xyz',
	releases: [{ version: '0.3.0', manifest_digest: 'sha256:xyz', pushed_at: '2026-01-01' }],
};

const coords = { namespace: 'finos', catalogId: 'mara-controls', version: '0.3.0' };

beforeEach(() => clearCatalogCache());
afterEach(() => vi.unstubAllGlobals());

describe('gemaraCatalogs store', () => {
	it('loadFromRef resolves title/digest/hub-url from the detail endpoint and caches', async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify(detail), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const loaded = await loadFromRef(coords);
		expect(loaded.title).toBe('MARA Controls');
		expect(loaded.ref.manifestDigest).toBe('sha256:xyz');
		expect(loaded.ref.hubUrl).toContain('/v1/catalogs/finos/mara-controls/versions/0.3.0');

		// Second call is served from cache (no second fetch).
		await loadFromRef(coords);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(getCachedCatalog(coords)).toBeDefined();
	});

	it('loadFromRef errors when the version was never published', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ ...detail, releases: [{ version: '9.9.9' }] }), { status: 200 })),
		);
		await expect(loadFromRef(coords)).rejects.toThrow(/No version "0.3.0"/);
	});

	it('loadFromPaste derives the ref from metadata and adds no namespace', () => {
		const loaded = loadFromPaste(JSON.stringify(body));
		expect(loaded.ref.namespace).toBeUndefined();
		expect(loaded.ref).toMatchObject({ catalogId: 'mara-controls', version: '0.3.0' });
		expect(loaded.title).toBe('MARA Controls');
	});

	it('loadFromPaste parses YAML (the grcli unpack format)', () => {
		const yaml = [
			'metadata:',
			'  id: mara-controls',
			'  version: 0.3.0',
			'controls:',
			'  - id: MARA-VS-007',
			'    title: Vector store tenant isolation',
		].join('\n');
		const loaded = loadFromPaste(yaml);
		expect(loaded.ref.catalogId).toBe('mara-controls');
		expect(loaded.ref.namespace).toBeUndefined();
	});

	it('loadFromPaste honours coordinate hints', () => {
		const loaded = loadFromPaste(JSON.stringify(body), { namespace: 'acme' });
		expect(loaded.ref.namespace).toBe('acme');
	});

	it('loadFromRef surfaces hub errors', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ error: 'store_error', detail: 'boom' }), { status: 500 })),
		);
		await expect(loadFromRef({ namespace: 'x', catalogId: 'y', version: '1' })).rejects.toMatchObject({
			status: 500,
		});
	});
});
