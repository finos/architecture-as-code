// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  listCatalogs,
  getCatalog,
  getCatalogVersion,
  catalogVersionUrl,
  HubError,
  DEFAULT_HUB_URL,
} from './hub.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hub client', () => {
  it('listCatalogs builds the /v1/catalogs URL with query params and an Accept header', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [], next_cursor: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listCatalogs({ kind: 'control-catalog', q: 'vector', limit: 5 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${DEFAULT_HUB_URL}/v1/catalogs?kind=control-catalog&q=vector&limit=5`);
    expect(init?.headers).toMatchObject({ Accept: 'application/json' });
  });

  it('respects a custom baseUrl', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ items: [], next_cursor: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listCatalogs({}, { baseUrl: 'http://localhost:8000/' });

    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:8000/v1/catalogs');
  });

  it('getCatalog returns the detail body and maps 404 to HubError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ namespace: 'finos', catalog_id: 'mara-controls' })));
    const detail = await getCatalog('finos', 'mara-controls');
    expect(detail.catalog_id).toBe('mara-controls');

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 404 })));
    await expect(getCatalog('finos', 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('getCatalogVersion returns body + manifest digest from the header', async () => {
    const body = { metadata: { id: 'mara-controls' }, controls: [{ id: 'C1' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(body, { headers: { 'X-Gemara-Manifest-Digest': 'sha256:abc' } }),
      ),
    );
    const res = await getCatalogVersion('finos', 'mara-controls', '0.3.0');
    expect(res.body).toEqual(body);
    expect(res.manifestDigest).toBe('sha256:abc');
  });

  it('getCatalogVersion maps 410 to a tombstoned HubError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 410 })));
    await expect(getCatalogVersion('finos', 'mara-controls', '0.0.1')).rejects.toMatchObject({
      status: 410,
      code: 'tombstoned',
    });
  });

  it('decodes the hub {error, detail} envelope on a 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'store_error', detail: 'list failed' }, { status: 500 })),
    );
    const err = await listCatalogs().catch((e) => e);
    expect(err).toBeInstanceOf(HubError);
    expect(err.code).toBe('store_error');
    expect(err.detail).toBe('list failed');
  });

  it('maps a fetch TimeoutError to a 504 HubError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('timed out', 'TimeoutError');
      }),
    );
    await expect(getCatalog('finos', 'mara-controls')).rejects.toMatchObject({
      status: 504,
      code: 'hub_timeout',
    });
  });

  it('catalogVersionUrl renders the durable citation URL', () => {
    expect(catalogVersionUrl('finos', 'mara-controls', '0.3.0')).toBe(
      `${DEFAULT_HUB_URL}/v1/catalogs/finos/mara-controls/versions/0.3.0`,
    );
  });
});
