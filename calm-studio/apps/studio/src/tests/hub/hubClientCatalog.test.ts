// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	catalogResourceId,
	hubArchitectureUrl,
	listHubArchitectures,
	listHubPatterns,
	resolveHubPatternDocument,
} from '$lib/hub/hubClient';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('hub catalog parsing', () => {
	it('prefers customId over numeric id', () => {
		expect(
			catalogResourceId({ customId: 'sample-architecture', id: 1, name: 'Architecture 1' })
		).toBe('sample-architecture');
		expect(catalogResourceId({ customId: 'api-gateway-pattern', numericId: 1 })).toBe(
			'api-gateway-pattern'
		);
		expect(catalogResourceId({ id: 4, name: 'mcp-api-pipeline' })).toBe('4');
	});

	it('lists architectures from /api even when /calm mapping list is empty', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('/api/calm/namespaces/ai-governance-v2/architectures')) {
					return jsonResponse({
						values: [{ id: 4, name: 'mcp-api-pipeline', versionCount: 1 }],
					});
				}
				if (url.includes('/calm/namespaces/ai-governance-v2/architectures')) {
					return jsonResponse({ values: [] });
				}
				return jsonResponse({ values: [] }, 404);
			})
		);

		const items = await listHubArchitectures('http://localhost:8080', 'ai-governance-v2');
		expect(items).toHaveLength(1);
		expect(items[0]?.name).toBe('mcp-api-pipeline');
		expect(items[0]?.url).toBe(
			hubArchitectureUrl('http://localhost:8080', 'ai-governance-v2', '4', '1.0.0')
		);
	});

	it('parses named mapping rows that have customId instead of id/name', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('/api/calm/namespaces/finos/patterns')) {
					return jsonResponse({ values: [] });
				}
				if (url.includes('/calm/namespaces/finos/patterns')) {
					return jsonResponse({
						values: [
							{
								customId: 'api-gateway-pattern',
								namespace: 'finos',
								numericId: 1,
								resourceType: 'PATTERN',
							},
						],
					});
				}
				return jsonResponse({ values: [] }, 404);
			})
		);

		const items = await listHubPatterns('http://localhost:8080', 'finos');
		expect(items).toHaveLength(1);
		expect(items[0]?.name).toBe('api-gateway-pattern');
		expect(items[0]?.url).toContain('/calm/namespaces/finos/patterns/api-gateway-pattern/versions/');
		expect(items[0]?.url).not.toContain('/api/');
	});

	it('attaches a document URL onto catalog pattern summaries', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('/api/calm/namespaces/finos/patterns') && !url.includes('/versions/')) {
					return jsonResponse({
						values: [{ id: 1, name: 'API Gateway Pattern', customId: 'api-gateway-pattern' }],
					});
				}
				if (url.includes('/calm/namespaces/finos/patterns') && !url.includes('/versions/')) {
					return jsonResponse({ values: [] });
				}
				return jsonResponse({ values: [] }, 404);
			})
		);

		const items = await listHubPatterns('http://localhost:8080', 'finos');
		expect(items[0]?.url).toContain('/calm/namespaces/finos/patterns/api-gateway-pattern/versions/');
		expect((items[0]?.pattern as { url?: string }).url).toBe(items[0]?.url);
	});

	it('fetches the versioned pattern schema before generate', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith('/patterns/api-gateway-pattern/versions/1.0.0')) {
					return jsonResponse({
						$id: 'p',
						properties: { nodes: { prefixItems: [] } },
					});
				}
				return jsonResponse({}, 404);
			})
		);

		const schema = await resolveHubPatternDocument(
			{ id: 1, name: 'API Gateway Pattern' },
			'http://localhost:8080/calm/namespaces/finos/patterns/api-gateway-pattern/versions/1.0.0'
		);
		expect((schema as { properties?: unknown }).properties).toBeTruthy();
	});
});
