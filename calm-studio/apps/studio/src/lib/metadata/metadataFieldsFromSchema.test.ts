// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { metadataFieldsFromSchemas } from './metadataFieldsFromSchema';

const DIFA_STANDARD = {
	$id: 'https://schemas.difa.creditas.cz/calm/standards/difa-standard.json',
	$defs: {
		'difa-arch-layer': { type: 'string', enum: ['business', 'application'] },
		'difa-arch-element': {
			type: 'object',
			required: ['layer', 'element'],
			properties: {
				layer: { $ref: '#/$defs/difa-arch-layer' },
				element: { type: 'string' },
				viewpoint: { type: 'string', enum: ['system-context', 'application-cooperation'] },
			},
		},
		'difa-node-metadata': {
			type: 'object',
			required: ['owner', 'difa-arch'],
			properties: {
				owner: { type: 'string' },
				'difa-arch': { $ref: '#/$defs/difa-arch-element' },
				lifecycle: { type: 'string', enum: ['planned', 'active'] },
				'azure-devops': true,
				shortcut: { type: 'string' },
			},
		},
		'difa-relationship-metadata': {
			type: 'object',
			required: ['difa-arch'],
			properties: {
				'difa-arch': {
					type: 'object',
					required: ['relationship'],
					properties: {
						relationship: { type: 'string', enum: ['serving', 'flow'] },
						'calm-core-variant': {
							type: 'string',
							enum: ['connects', 'interacts'],
						},
					},
				},
			},
		},
	},
};

describe('metadataFieldsFromSchemas', () => {
	it('binds node metadata properties and nested overlay enums from a Standard', () => {
		const schemas = new Map<string, object>([
			[DIFA_STANDARD.$id, DIFA_STANDARD],
		]);
		const { fields, source } = metadataFieldsFromSchemas(schemas, 'node');
		expect(source).toContain('difa-node-metadata');
		expect(fields.find((f) => f.key === 'owner')).toMatchObject({
			required: true,
			kind: 'string',
			path: ['owner'],
		});
		expect(fields.find((f) => f.key === 'lifecycle')).toMatchObject({
			kind: 'enum',
			enumValues: ['planned', 'active'],
			path: ['lifecycle'],
		});
		expect(fields.find((f) => f.key === 'layer')).toMatchObject({
			kind: 'enum',
			enumValues: ['business', 'application'],
			path: ['difa-arch', 'layer'],
			required: true,
		});
		expect(fields.find((f) => f.key === 'azure-devops')).toBeUndefined();
		expect(fields.find((f) => f.key === 'shortcut')?.path).toEqual(['shortcut']);
	});

	it('binds relationship overlay fields', () => {
		const schemas = new Map<string, object>([[DIFA_STANDARD.$id, DIFA_STANDARD]]);
		const { fields } = metadataFieldsFromSchemas(schemas, 'relationship');
		expect(fields.find((f) => f.key === 'relationship')).toMatchObject({
			kind: 'enum',
			path: ['difa-arch', 'relationship'],
		});
		expect(fields.find((f) => f.key === 'calm-core-variant')?.path).toEqual([
			'difa-arch',
			'calm-core-variant',
		]);
	});

	it('returns no fields when loaded schemas have no metadata defs', () => {
		const schemas = new Map<string, object>([
			['https://json-schema.org/draft/2020-12/schema', { $id: 'https://json-schema.org/draft/2020-12/schema' }],
		]);
		expect(metadataFieldsFromSchemas(schemas, 'node').fields).toEqual([]);
	});

	it('detects array properties with string and object items (R86)', () => {
		const schema = {
			$id: 'https://example.com/with-arrays.json',
			$defs: {
				'example-node-metadata': {
					type: 'object',
					properties: {
						tags: {
							type: 'array',
							items: { type: 'string' },
						},
						contacts: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									name: { type: 'string' },
									role: { type: 'string', enum: ['owner', 'ops'] },
								},
							},
						},
						status: {
							type: 'array',
							items: { type: 'string', enum: ['planned', 'active'] },
						},
					},
				},
			},
		};
		const { fields } = metadataFieldsFromSchemas(
			new Map([[schema.$id, schema]]),
			'node'
		);
		expect(fields.find((f) => f.key === 'tags')).toMatchObject({
			kind: 'array',
			itemKind: 'string',
			path: ['tags'],
		});
		const contacts = fields.find((f) => f.key === 'contacts');
		expect(contacts).toMatchObject({
			kind: 'array',
			itemKind: 'object',
			path: ['contacts'],
		});
		expect(contacts?.itemFields?.map((f) => f.key)).toEqual(['name', 'role']);
		expect(fields.find((f) => f.key === 'status')).toMatchObject({
			kind: 'array',
			itemKind: 'enum',
			itemEnumValues: ['planned', 'active'],
		});
	});
});
