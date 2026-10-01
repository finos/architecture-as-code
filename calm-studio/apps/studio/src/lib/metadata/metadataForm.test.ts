// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	readMetadataPath,
	writeMetadataPath,
	readMetadataValue,
	writeMetadataValue,
	readMetadataArray,
	formatJsonPretty,
	previewNestedMetadata,
	getMetadataFieldsForRelationship,
	groupMetadataFields,
} from './metadataForm';

describe('metadataForm paths', () => {
	it('reads nested archimate fields', () => {
		const metadata = {
			owner: 'team-a',
			archimate: { layer: 'Application', viewpoint: 'ApplicationCooperation' },
		};
		expect(readMetadataPath(metadata, ['archimate', 'layer'])).toBe('Application');
	});

	it('writes nested archimate fields immutably', () => {
		const original = {
			owner: 'TBD',
			archimate: {
				layer: 'Business',
				element: 'archimate:businessActor',
				viewpoint: 'SystemContext',
			},
		};
		const next = writeMetadataPath(original, ['archimate', 'viewpoint'], 'ApplicationCooperation');
		expect(next.archimate).toEqual({
			layer: 'Business',
			element: 'archimate:businessActor',
			viewpoint: 'ApplicationCooperation',
		});
		expect(original.archimate).toEqual({
			layer: 'Business',
			element: 'archimate:businessActor',
			viewpoint: 'SystemContext',
		});
	});

	it('cloneJson / writeMetadataValue work on proxy-like plain objects', () => {
		const proxyLike = { archimate: { relationship: 'Serving' } };
		const next = writeMetadataValue(proxyLike, ['archimate', 'relationship'], 'Flow');
		expect(next).toEqual({ archimate: { relationship: 'Flow' } });
		expect(proxyLike.archimate.relationship).toBe('Serving');
	});
});
describe('getMetadataFieldsForRelationship', () => {
	it('returns archimate relationship field when either endpoint is archimate', () => {
		const fields = getMetadataFieldsForRelationship('service', 'archimate:applicationComponent');
		expect(fields).toHaveLength(2);
		expect(fields![0]!.key).toBe('relationship');
		expect(fields![1]!.key).toBe('calm-core-variant');
	});

	it('returns null for core-only relationships', () => {
		expect(getMetadataFieldsForRelationship('service', 'database')).toBeNull();
	});
});

describe('groupMetadataFields', () => {
	it('keeps top-level fields inline and groups nested paths for the dialog', () => {
		const grouped = groupMetadataFields([
			{ key: 'owner', label: 'Owner', required: true, kind: 'string', path: ['owner'] },
			{
				key: 'layer',
				label: 'Layer',
				required: true,
				kind: 'enum',
				enumValues: ['Application'],
				path: ['archimate', 'layer'],
			},
			{
				key: 'viewpoint',
				label: 'Viewpoint',
				required: false,
				kind: 'enum',
				enumValues: ['SystemContext'],
				path: ['archimate', 'viewpoint'],
			},
		]);
		expect(grouped.top).toHaveLength(1);
		expect(grouped.top[0]?.key).toBe('owner');
		expect(grouped.nested).toHaveLength(1);
		expect(grouped.nested[0]?.key).toBe('archimate');
		expect(grouped.nested[0]?.fields.map((f) => f.key)).toEqual(['layer', 'viewpoint']);
	});

	it('keeps top-level array fields inline (R86)', () => {
		const grouped = groupMetadataFields([
			{
				key: 'tags',
				label: 'Tags',
				required: false,
				kind: 'array',
				path: ['tags'],
				itemKind: 'string',
			},
		]);
		expect(grouped.top).toHaveLength(1);
		expect(grouped.top[0]?.kind).toBe('array');
		expect(grouped.nested).toHaveLength(0);
	});
});

describe('array metadata (R86)', () => {
	it('reads and writes array values without stringifying the whole array', () => {
		const original = { tags: ['a', 'b'] };
		expect(readMetadataArray(original, ['tags'])).toEqual(['a', 'b']);
		expect(readMetadataValue(original, ['tags'])).toEqual(['a', 'b']);

		const next = writeMetadataValue(original, ['tags'], ['a', 'b', 'c']);
		expect(next.tags).toEqual(['a', 'b', 'c']);
		expect(Array.isArray(next.tags)).toBe(true);
		expect(original.tags).toEqual(['a', 'b']);
	});

	it('supports add/remove of primitive items via writeMetadataValue', () => {
		let meta: Record<string, unknown> = { tags: ['x'] };
		meta = writeMetadataValue(meta, ['tags'], [...(meta.tags as string[]), 'y']);
		expect(meta.tags).toEqual(['x', 'y']);
		meta = writeMetadataValue(
			meta,
			['tags'],
			(meta.tags as string[]).filter((_, i) => i !== 0)
		);
		expect(meta.tags).toEqual(['y']);
	});

	it('edits object array items as objects, not a single string', () => {
		const original = {
			endpoints: [{ method: 'GET', path: '/a' }],
		};
		const next = writeMetadataValue(original, ['endpoints'], [
			{ method: 'GET', path: '/a' },
			{ method: 'POST', path: '/b' },
		]);
		expect(next.endpoints).toEqual([
			{ method: 'GET', path: '/a' },
			{ method: 'POST', path: '/b' },
		]);
		expect(typeof next.endpoints).toBe('object');
		expect(Array.isArray(next.endpoints)).toBe(true);
	});

	it('treats missing path as empty array for the editor chrome', () => {
		expect(readMetadataArray({}, ['tags'])).toEqual([]);
		expect(readMetadataArray({ tags: 'not-an-array' }, ['tags'])).toEqual([]);
	});
});

describe('pretty nested JSON (R86)', () => {
	it('pretty-prints nested objects as multi-line JSON', () => {
		const pretty = formatJsonPretty({ layer: 'Application', element: 'service' });
		expect(pretty).toContain('\n');
		expect(pretty).toContain('  "layer"');
		expect(pretty).toContain('Application');
	});

	it('previewNestedMetadata uses pretty formatting', () => {
		const preview = previewNestedMetadata(
			{ archimate: { layer: 'Business', viewpoint: 'SystemContext' } },
			'archimate'
		);
		expect(preview).toContain('\n');
		expect(preview).toContain('"layer": "Business"');
	});

	it('pretty-prints arrays the same way as nested objects', () => {
		const pretty = formatJsonPretty([{ id: 1 }, { id: 2 }]);
		expect(pretty).toContain('\n');
		expect(pretty.startsWith('[')).toBe(true);
	});
});
