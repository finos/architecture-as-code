// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';
import { listHubPatterns, resolveHubPatternDocument } from '$lib/hub/hubClient';
import { generateArchitectureFromPattern } from '$lib/templates/generateFromPattern';

const HUB = 'http://localhost:8080';
const PATTERN_VERSION_URL = `${HUB}/calm/namespaces/finos/patterns/api-gateway-pattern/versions/1.0.0`;
const NUMERIC_PATTERN_VERSION_URL = `${HUB}/api/calm/namespaces/finos/patterns/1/versions/1.0.0`;
const META = 'https://calm.finos.org/calm/schemas/2025-03/meta';

/** Hub seed shape: published 2025-03 $schema/$ref and prefixItems consts. */
const hubApiGatewayPattern = {
	$schema: `${META}/calm.json`,
	$id: PATTERN_VERSION_URL,
	title: 'API Gateway Pattern',
	type: 'object',
	properties: {
		nodes: {
			type: 'array',
			minItems: 2,
			prefixItems: [
				{
					$ref: `${META}/core.json#/defs/node`,
					properties: {
						'well-known-endpoint': { type: 'string' },
						description: {
							const: 'The API Gateway used to verify authorization and access to downstream system',
						},
						'node-type': { const: 'system' },
						name: { const: 'API Gateway' },
						'unique-id': { const: 'api-gateway' },
						interfaces: {
							type: 'array',
							minItems: 1,
							prefixItems: [
								{
									$ref: `${META}/interface.json#/defs/host-port-interface`,
									properties: {
										'unique-id': { const: 'api-gateway-ingress' },
									},
								},
							],
						},
					},
					required: ['well-known-endpoint', 'interfaces'],
				},
				{
					$ref: `${META}/core.json#/defs/node`,
					properties: {
						description: { const: 'The API Consumer making an authenticated and authorized request' },
						'node-type': { const: 'system' },
						name: { const: 'API Consumer' },
						'unique-id': { const: 'api-consumer' },
					},
				},
			],
		},
		relationships: {
			type: 'array',
			minItems: 1,
			prefixItems: [
				{
					$ref: `${META}/core.json#/defs/relationship`,
					properties: {
						'unique-id': { const: 'api-consumer-api-gateway' },
						description: { const: 'Issue calculation request' },
						'relationship-type': {
							const: {
								connects: {
									source: { node: 'api-consumer' },
									destination: { node: 'api-gateway', interfaces: ['api-gateway-ingress'] },
								},
							},
						},
						protocol: { const: 'HTTPS' },
					},
				},
			],
		},
	},
	required: ['nodes', 'relationships'],
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function isMetaHost(url: string): boolean {
	try {
		const host = new URL(url).hostname;
		return host === 'calm.finos.org' || host === 'json-schema.org';
	} catch {
		return false;
	}
}

function stubHubFetch(
	handler: (url: string) => unknown | undefined
): { fetchMock: ReturnType<typeof vi.fn>; urls: string[] } {
	const urls: string[] = [];
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		urls.push(url);
		if (isMetaHost(url)) {
			throw new Error(`Browser must not fetch CALM meta from ${url}`);
		}
		const body = handler(url);
		if (body !== undefined) return jsonResponse(body);
		return jsonResponse({ values: [] }, 404);
	});
	vi.stubGlobal('fetch', fetchMock);
	return { fetchMock, urls };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('generate architecture from a Hub template', () => {
	it('lists a catalog summary, fetches the versioned 2025-03 pattern, and instantiates nodes', async () => {
		const { urls } = stubHubFetch((url) => {
			if (url === `${HUB}/api/calm/namespaces/finos/patterns`) {
				return {
					values: [{ id: 1, name: 'API Gateway Pattern', customId: 'api-gateway-pattern' }],
				};
			}
			if (url === `${HUB}/calm/namespaces/finos/patterns`) return { values: [] };
			if (url === PATTERN_VERSION_URL) return hubApiGatewayPattern;
			return undefined;
		});

		const listed = await listHubPatterns(HUB, 'finos');
		expect(listed).toHaveLength(1);
		expect(listed[0]?.url).toBe(PATTERN_VERSION_URL);
		expect((listed[0]?.pattern as { properties?: unknown }).properties).toBeUndefined();

		const schema = await resolveHubPatternDocument(listed[0]!.pattern, listed[0]!.url);
		expect((schema as { title?: string }).title).toBe('API Gateway Pattern');

		const arch = await generateArchitectureFromPattern(schema);
		expect(arch.nodes.map((n) => n['unique-id'])).toEqual(['api-gateway', 'api-consumer']);
		expect(arch.nodes[0]?.name).toBe('API Gateway');
		expect(arch.nodes[0]?.['node-type']).toBe('system');
		expect(arch.nodes[0]?.['well-known-endpoint']).toBe('[[ WELL_KNOWN_ENDPOINT ]]');
		expect(arch.nodes[0]?.interfaces?.[0]?.['unique-id']).toBe('api-gateway-ingress');
		expect(arch.nodes[0]?.interfaces?.[0]?.host).toBe('[[ HOST ]]');
		expect(arch.nodes[0]?.interfaces?.[0]?.port).toBe(-1);
		expect(arch.relationships.map((r) => r['unique-id'])).toEqual(['api-consumer-api-gateway']);
		expect(arch.relationships[0]?.protocol).toBe('HTTPS');
		expect(arch.$schema).toBe(PATTERN_VERSION_URL);
		expect(urls.filter((u) => isMetaHost(u))).toEqual([]);
	});

	it('resolves a numeric Hub pattern id under /api then generates', async () => {
		const numericPattern = { ...hubApiGatewayPattern, $id: NUMERIC_PATTERN_VERSION_URL };
		stubHubFetch((url) => {
			if (url === `${HUB}/api/calm/namespaces/finos/patterns`) {
				return { values: [{ id: 1, name: 'API Gateway Pattern', version: '1.0.0' }] };
			}
			if (url === `${HUB}/calm/namespaces/finos/patterns`) return { values: [] };
			if (url === NUMERIC_PATTERN_VERSION_URL) return numericPattern;
			return undefined;
		});

		const listed = await listHubPatterns(HUB, 'finos');
		expect(listed[0]?.url).toBe(NUMERIC_PATTERN_VERSION_URL);

		const schema = await resolveHubPatternDocument(listed[0]!.pattern, listed[0]!.url);
		const arch = await generateArchitectureFromPattern(schema);
		expect(arch.nodes).toHaveLength(2);
		expect(arch.relationships).toHaveLength(1);
	});

	it('generates from an already-resolved Hub schema without a second document fetch', async () => {
		const { fetchMock } = stubHubFetch(() => undefined);
		const arch = await generateArchitectureFromPattern(hubApiGatewayPattern);
		expect(arch.nodes.map((n) => n['unique-id'])).toEqual(['api-gateway', 'api-consumer']);
		expect(arch.relationships).toHaveLength(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
