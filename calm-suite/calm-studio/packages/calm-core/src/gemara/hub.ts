// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Minimal read-only client for the grc.store hub HTTP API (the JSON `/v1`
 * surface the hub exposes over its OCI/zot backend). Adapted from the
 * grc.store-frontend `src/lib/hub.ts`, trimmed to the catalog reads Studio
 * needs: list, detail, and version body.
 *
 * Reads are anonymous (no token) — public catalogs require none. There is NO
 * signature/provenance verification here: the hub converts the catalog's YAML
 * layer to JSON for us, but cosign verification requires native tooling that
 * cannot run in a browser. Callers must treat retrieved catalogs as
 * `verified: false` (see decorator.ts).
 */

export const DEFAULT_HUB_URL = 'https://hub.grc.store';

/** Default per-request timeout. The hub can hang (alive but not responding)
 * during rolling restarts; fail fast rather than block the UI. */
const HUB_DEFAULT_TIMEOUT_MS = 10_000;

/** Typed hub failure mirroring the hub's `{ error, detail }` envelope. */
export class HubError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly detail: string | undefined;
  readonly requestId: string | undefined;

  constructor(
    status: number,
    code: string | undefined,
    detail: string | undefined,
    message: string,
    requestId?: string,
  ) {
    super(message);
    this.name = 'HubError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.requestId = requestId;
  }
}

export interface CatalogListItem {
  namespace: string;
  catalog_id: string;
  type: string;
  category: string;
  latest_version: string;
  latest_manifest_digest: string;
  title?: string;
  summary?: string;
  author_name?: string;
  license?: string;
  last_pushed_at: string;
}

export interface CatalogListResponse {
  items: CatalogListItem[];
  next_cursor: string | null;
}

export interface CatalogRelease {
  version: string;
  manifest_digest: string;
  pushed_at: string;
  tombstoned_at?: string;
}

export interface CatalogDetail {
  namespace: string;
  catalog_id: string;
  type: string;
  category: string;
  title?: string;
  summary?: string;
  author_name?: string;
  license?: string;
  latest_version: string;
  latest_manifest_digest: string;
  releases: CatalogRelease[];
}

export interface CatalogVersionBody {
  /** The catalog artifact body as JSON (hub converts its YAML layer). */
  body: unknown;
  /** OCI manifest digest from the `X-Gemara-Manifest-Digest` header. */
  manifestDigest: string;
}

export interface HubClientOptions {
  /** Base hub URL; defaults to the public hub. */
  baseUrl?: string;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

export interface ListCatalogsOptions {
  /** Catalog kind filter (e.g. control catalogs); passed through verbatim. */
  kind?: string;
  namespace?: string;
  q?: string;
  limit?: number;
  after?: string;
}

function normalizeBase(opts: HubClientOptions | undefined): string {
  return (opts?.baseUrl ?? DEFAULT_HUB_URL).replace(/\/$/, '');
}

async function decodeError(res: Response): Promise<HubError> {
  let code: string | undefined;
  let detail: string | undefined;
  try {
    const body = (await res.json()) as { error?: string; detail?: string };
    code = body.error;
    detail = body.detail;
  } catch {
    // Body wasn't JSON; leave code/detail undefined.
  }
  const requestId = res.headers.get('X-Request-ID') ?? undefined;
  const msg = code && detail ? `${code}: ${detail}` : `HTTP ${res.status}`;
  return new HubError(res.status, code, detail, msg, requestId);
}

async function hubFetch(
  url: string,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new HubError(504, 'hub_timeout', `timed out after ${timeoutMs}ms`, 'hub timeout');
    }
    throw e;
  }
}

/** List catalogs (optionally filtered by kind/namespace/search). */
export async function listCatalogs(
  opts: ListCatalogsOptions = {},
  client?: HubClientOptions,
): Promise<CatalogListResponse> {
  const base = normalizeBase(client);
  const params = new URLSearchParams();
  if (opts.kind) params.set('kind', opts.kind);
  if (opts.namespace) params.set('namespace', opts.namespace);
  if (opts.q) params.set('q', opts.q);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.after) params.set('after', opts.after);
  const qs = params.toString();
  const res = await hubFetch(
    `${base}/v1/catalogs${qs ? `?${qs}` : ''}`,
    client?.timeoutMs ?? HUB_DEFAULT_TIMEOUT_MS,
  );
  if (!res.ok) throw await decodeError(res);
  return (await res.json()) as CatalogListResponse;
}

/** Get a catalog's metadata + release list. */
export async function getCatalog(
  namespace: string,
  catalogId: string,
  client?: HubClientOptions,
): Promise<CatalogDetail> {
  const base = normalizeBase(client);
  const url = `${base}/v1/catalogs/${encodeURIComponent(namespace)}/${encodeURIComponent(catalogId)}`;
  const res = await hubFetch(url, client?.timeoutMs ?? HUB_DEFAULT_TIMEOUT_MS);
  if (res.status === 404) throw new HubError(404, 'not_found', 'no such catalog', 'not found');
  if (!res.ok) throw await decodeError(res);
  return (await res.json()) as CatalogDetail;
}

/**
 * Get a catalog version's artifact body (JSON) plus its manifest digest. The
 * body is the Gemara catalog itself — pass it to parseControlCatalog.
 */
export async function getCatalogVersion(
  namespace: string,
  catalogId: string,
  version: string,
  client?: HubClientOptions,
): Promise<CatalogVersionBody> {
  const base = normalizeBase(client);
  const url =
    `${base}/v1/catalogs/${encodeURIComponent(namespace)}/${encodeURIComponent(catalogId)}` +
    `/versions/${encodeURIComponent(version)}`;
  const res = await hubFetch(url, client?.timeoutMs ?? HUB_DEFAULT_TIMEOUT_MS);
  if (res.status === 404) throw new HubError(404, 'not_found', 'no such version', 'not found');
  if (res.status === 410) throw new HubError(410, 'tombstoned', 'this version is yanked', 'tombstoned');
  if (!res.ok) throw await decodeError(res);
  const body = await res.json();
  const manifestDigest = res.headers.get('X-Gemara-Manifest-Digest') ?? '';
  return { body, manifestDigest };
}

/**
 * Resolve the canonical hub read URL for a catalog version — used as the
 * durable citation persisted in a `gemara-link` decorator.
 */
export function catalogVersionUrl(
  namespace: string,
  catalogId: string,
  version: string,
  client?: HubClientOptions,
): string {
  const base = normalizeBase(client);
  return (
    `${base}/v1/catalogs/${encodeURIComponent(namespace)}/${encodeURIComponent(catalogId)}` +
    `/versions/${encodeURIComponent(version)}`
  );
}
