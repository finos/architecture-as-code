// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	architectureToPatternSchema,
	patternSchemaToArchitecture,
} from '$lib/templates/patternSchemaGraph';
import { calmToFlow } from '$lib/stores/projection';

const pattern = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://example.com/patterns/sample',
	title: 'Sample',
	type: 'object',
	properties: {
		nodes: {
			type: 'array',
			prefixItems: [
				{
					type: 'object',
					properties: {
						'unique-id': { const: 'svc' },
						'node-type': { const: 'service' },
						name: { const: 'API' },
						description: { const: '' },
					},
				},
			],
		},
		relationships: {
			type: 'array',
			prefixItems: [
				{
					type: 'object',
					properties: {
						'unique-id': { const: 'rel' },
						source: { const: 'svc' },
						destination: { const: 'svc' },
					},
				},
			],
		},
	},
};

describe('pattern graph', () => {
	it('projects pattern schema nodes onto a canvas architecture', () => {
		const arch = patternSchemaToArchitecture(pattern);
		expect(arch.nodes).toHaveLength(1);
		expect(arch.nodes[0]?.['unique-id']).toBe('svc');
	});

	it('projects source/destination const slots onto a connects relationship', () => {
		const arch = patternSchemaToArchitecture(pattern);
		expect(arch.relationships).toHaveLength(1);
		expect(arch.relationships[0]?.['unique-id']).toBe('rel');
		expect(arch.relationships[0]?.['relationship-type']).toEqual({
			connects: { source: { node: 'svc' }, destination: { node: 'svc' } },
		});
	});

	it('unwraps Hub-style relationship-type const so connects edges can render', () => {
		const hubPattern = {
			type: 'object',
			properties: {
				nodes: {
					prefixItems: [
						{
							properties: {
								'unique-id': { const: 'api-consumer' },
								'node-type': { const: 'system' },
								name: { const: 'API Consumer' },
							},
						},
						{
							properties: {
								'unique-id': { const: 'api-gateway' },
								'node-type': { const: 'system' },
								name: { const: 'API Gateway' },
							},
						},
					],
				},
				relationships: {
					prefixItems: [
						{
							properties: {
								'unique-id': { const: 'api-consumer-api-gateway' },
								description: { const: 'Issue calculation request' },
								protocol: { const: 'HTTPS' },
								'relationship-type': {
									const: {
										connects: {
											source: { node: 'api-consumer' },
											destination: {
												node: 'api-gateway',
												interfaces: ['api-gateway-ingress'],
											},
										},
									},
								},
							},
						},
					],
				},
			},
		};
		const arch = patternSchemaToArchitecture(hubPattern);
		expect(arch.relationships).toHaveLength(1);
		expect(arch.relationships[0]?.description).toBe('Issue calculation request');
		expect(arch.relationships[0]?.protocol).toBe('HTTPS');
		expect(arch.relationships[0]?.['relationship-type']).toEqual({
			connects: {
				source: { node: 'api-consumer' },
				destination: { node: 'api-gateway', interfaces: ['api-gateway-ingress'] },
			},
		});
		const flow = calmToFlow(arch);
		expect(flow.edges.filter((e) => !e.hidden)).toHaveLength(1);
		expect(flow.edges[0]?.source).toBe('api-consumer');
		expect(flow.edges[0]?.target).toBe('api-gateway');
	});

	it('round-trips architecture back to a CLI pattern schema', () => {
		const arch = patternSchemaToArchitecture(pattern);
		const saved = architectureToPatternSchema(arch, pattern) as {
			properties: { nodes: { prefixItems: unknown[] } };
		};
		expect(saved.properties.nodes.prefixItems).toHaveLength(1);
		const again = patternSchemaToArchitecture(saved);
		expect(again.nodes[0]?.name).toBe('API');
		expect(again.relationships[0]?.['relationship-type']).toEqual({
			connects: { source: { node: 'svc' }, destination: { node: 'svc' } },
		});
	});
});
