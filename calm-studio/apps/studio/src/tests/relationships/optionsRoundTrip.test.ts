// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import type { CalmArchitecture, CalmRelationship } from '@calmstudio/calm-core';
import { registerPack, unregisterPack } from '@calmstudio/extensions';
import { calmToFlow, flowToCalm } from '$lib/stores/projection';
import { applyFromCanvas, applyFromJson, getModel, resetModel } from '$lib/stores/calmModel.svelte';
import { dasharrayFor, resolveAppearance } from '$lib/relationships/relationshipAppearance';
import { isUndrawableRelationship } from '$lib/relationships/optionsRelationship';
import {
	appearanceDefaultsForEdge,
	metadataForRelationshipChoice,
	metadataWithTypeDefaults,
	relationshipTypeForChoice,
	storedRelationshipTypeKey,
} from '$lib/relationships/relationshipTypeChoice';

const nodes = [
	{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: '' },
	{ 'unique-id': 'b', 'node-type': 'service', name: 'B', description: '' },
	{ 'unique-id': 'c', 'node-type': 'service', name: 'C', description: '' },
];

describe('options-shaped relationships', () => {
	test('keeps a custom key and draws an options edge', () => {
		const arch: CalmArchitecture = {
			nodes,
			relationships: [
				{
					'unique-id': 'custom-1',
					description: 'choice',
					'relationship-type': {
						'bank:choice': [
							{ description: 'choice', nodes: ['a', 'b'], relationships: [] },
						],
					},
				} as CalmRelationship,
			],
		};
		const flow = calmToFlow(arch);
		expect(flow.edges).toHaveLength(1);
		expect(flow.edges[0]?.id).toBe('custom-1');
		expect(flow.edges[0]?.type).toBe('options');
		const saved = flowToCalm(flow.nodes, flow.edges);
		const rel = saved.relationships[0];
		expect(rel?.['relationship-type']).toEqual({
			'bank:choice': [{ description: 'choice', nodes: ['a', 'b'], relationships: [] }],
		});
	});

	test('suffixes fan-out edge ids and keeps one relationship', () => {
		const arch: CalmArchitecture = {
			nodes,
			relationships: [
				{
					'unique-id': 'opt-1',
					'relationship-type': {
						options: [{ description: '', nodes: ['a', 'b', 'c'], relationships: [] }],
					},
				},
			],
		};
		const flow = calmToFlow(arch);
		const ids = flow.edges.map((edge) => edge.id).sort();
		expect(ids).toEqual(['opt-1__0', 'opt-1__1']);
		const saved = flowToCalm(flow.nodes, flow.edges);
		expect(saved.relationships).toHaveLength(1);
		expect(saved.relationships[0]?.['unique-id']).toBe('opt-1');
		expect(saved.relationships[0]?.['relationship-type']).toEqual({
			options: [{ description: '', nodes: ['a', 'b', 'c'], relationships: [] }],
		});
	});

	test('does not draw a custom connects-shaped key and keeps it after canvas sync', () => {
		const custom = {
			'unique-id': 'kept',
			'relationship-type': {
				'bank:link': { source: { node: 'a' }, destination: { node: 'b' } },
			},
		} as CalmRelationship;
		expect(isUndrawableRelationship(custom['relationship-type'], new Set(['a', 'b']))).toBe(true);
		const arch: CalmArchitecture = {
			nodes: nodes.slice(0, 2),
			relationships: [
				custom,
				{
					'unique-id': 'live',
					'relationship-type': {
						connects: { source: { node: 'a' }, destination: { node: 'b' } },
					},
				},
			],
		};
		resetModel();
		applyFromJson(arch);
		const flow = calmToFlow(arch);
		expect(flow.edges.map((edge) => edge.id)).toEqual(['live']);
		applyFromCanvas(flow.nodes, flow.edges);
		const ids = getModel().relationships.map((rel) => rel['unique-id']).sort();
		expect(ids).toEqual(['kept', 'live']);
		const kept = getModel().relationships.find((rel) => rel['unique-id'] === 'kept');
		expect(kept?.['relationship-type']).toEqual(custom['relationship-type']);
	});

	test('does not restore a deleted connects edge', () => {
		const arch: CalmArchitecture = {
			nodes,
			relationships: [
				{
					'unique-id': 'gone',
					'relationship-type': {
						connects: { source: { node: 'a' }, destination: { node: 'b' } },
					},
				},
				{
					'unique-id': 'stay',
					'relationship-type': {
						connects: { source: { node: 'b' }, destination: { node: 'c' } },
					},
				},
			],
		};
		resetModel();
		applyFromJson(arch);
		const flow = calmToFlow(arch);
		const stay = flow.edges.filter((edge) => edge.id === 'stay');
		applyFromCanvas(flow.nodes, stay);
		expect(getModel().relationships.map((rel) => rel['unique-id'])).toEqual(['stay']);
	});
});

describe('relationship appearance', () => {
	test('metadata wins over the type default', () => {
		const appearance = resolveAppearance(
			{ 'line-style': 'dotted', routing: 'straight' },
			{ 'line-style': 'dashed', routing: 'smoothstep', 'line-color': '#abc' },
		);
		expect(appearance.lineStyle).toBe('dotted');
		expect(appearance.routing).toBe('straight');
		expect(appearance.lineColor).toBe('#abc');
		expect(appearance.descriptionDisplay).toBe('tooltip');
		expect(dasharrayFor('dashed')).toBe('8 4');
		expect(dasharrayFor('dotted')).toBe('2 4');
		expect(dasharrayFor('solid')).toBeUndefined();
	});

	test('an ArchiMate type is stored in metadata and stays the combobox value', () => {
		const metadata = metadataForRelationshipChoice(undefined, 'archimate:Serving', 'interacts');
		expect(metadata).toEqual({
			archimate: { relationship: 'Serving', 'calm-core-variant': 'interacts' },
		});
		expect(
			storedRelationshipTypeKey({ interacts: { actor: 'a', nodes: ['b'] } }, metadata),
		).toBe('archimate:Serving');
		expect(
			metadataForRelationshipChoice(metadata, 'connects', 'connects')?.archimate,
		).toEqual({ 'calm-core-variant': 'connects' });
	});

	test('DIFA impact metadata supplies line color when the CALM key is connects', () => {
		registerPack({
			id: 'difa-arch',
			label: 'DIFA',
			version: '1.1.0',
			color: { bg: '#ffffff', border: '#000000', stroke: '#000000' },
			nodes: [],
			relationships: [
				{
					typeId: 'difa-arch:impacts-new',
					label: 'Impacts: New',
					calmCoreVariant: 'connects',
					'line-style': 'solid',
					'line-color': '#dc2626',
				},
				{
					typeId: 'difa-arch:impacts-remove',
					label: 'Impacts: Remove',
					calmCoreVariant: 'connects',
					'line-style': 'dashed',
					'line-color': '#dc2626',
				},
				{
					typeId: 'difa-arch:association',
					label: 'Association',
					calmCoreVariant: 'connects',
				},
			],
		});
		try {
			const created = resolveAppearance(
				undefined,
				appearanceDefaultsForEdge('connects', {
					'difa-arch': { relationship: 'impacts-new', 'calm-core-variant': 'connects' },
				}),
			);
			expect(created.lineStyle).toBe('solid');
			expect(created.lineColor).toBe('#dc2626');

			const removed = resolveAppearance(
				{ 'line-color': '#111111' },
				appearanceDefaultsForEdge('connects', {
					'difa-arch': { relationship: 'association', 'calm-core-variant': 'connects' },
					wp: { impact: 'impacts-remove' },
				}),
			);
			expect(removed.lineStyle).toBe('dashed');
			expect(removed.lineColor).toBe('#111111');

			const stored = metadataWithTypeDefaults(undefined, 'difa-arch:impacts-new');
			expect(stored).toBeUndefined();
		} finally {
			unregisterPack('difa-arch');
		}
	});

	test('extension visuals are not applied when the extension is not loaded', () => {
		const painted = resolveAppearance(
			undefined,
			appearanceDefaultsForEdge('connects', {
				'difa-arch': { relationship: 'impacts-remove', 'calm-core-variant': 'connects' },
			}),
		);
		expect(painted.lineColor).toBeUndefined();
		expect(painted.lineStyle).toBe('solid');
		expect(painted.routing).toBe('bezier');
		expect(painted.descriptionDisplay).toBe('tooltip');
	});

	test('an options pack type stores the custom key', () => {
		const chosen = relationshipTypeForChoice('bank:choice', 'a', 'b');
		expect(chosen.canvasVariant).toBe('options');
		expect(chosen.preserveType).toBe(true);
		expect(chosen.relationshipType).toEqual({
			'bank:choice': [{ description: '', nodes: ['a', 'b'], relationships: [] }],
		});
	});
});
