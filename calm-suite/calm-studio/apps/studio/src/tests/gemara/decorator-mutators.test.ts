// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import {
	applyFromJson,
	applyFromCanvas,
	getModel,
	upsertDecorator,
	removeDecorator,
	removeDecoratorFromElement,
	decoratorsForElement,
	mergeDecorators,
	resetModel,
} from '$lib/stores/calmModel.svelte';
import { calmToFlow } from '$lib/stores/projection';
import {
	buildGemaraDecorator,
	GEMARA_ARCHITECTURE_SCOPE,
	type CalmArchitecture,
} from '@calmstudio/calm-core';

const ref = { namespace: 'finos', catalogId: 'mara-controls', version: '0.3.0' };
const control = { id: 'MARA-VS-007', title: 'Vector store tenant isolation' };

const archWithNode: CalmArchitecture = {
	nodes: [{ 'unique-id': 'vector-store', 'node-type': 'database', name: 'Vector Store', description: 'RAG store' }],
	relationships: [],
};

beforeEach(() => resetModel());

describe('decorator mutators', () => {
	it('upserts and then replaces a decorator by unique-id (idempotent)', () => {
		applyFromJson(archWithNode);
		upsertDecorator(buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['vector-store'] }));
		expect(getModel().decorators).toHaveLength(1);

		// Re-binding the same coordinate replaces, not duplicates.
		upsertDecorator(
			buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['vector-store', 'cache'] }),
		);
		expect(getModel().decorators).toHaveLength(1);
		expect(getModel().decorators![0]!['applies-to']).toEqual(['vector-store', 'cache']);
	});

	it('removeDecorator drops the entry and clears the key when empty', () => {
		applyFromJson(archWithNode);
		const d = buildGemaraDecorator({ kind: 'control', catalogRef: ref, control, appliesTo: ['vector-store'] });
		upsertDecorator(d);
		expect(getModel().decorators).toHaveLength(1);

		removeDecorator(d['unique-id']);
		expect(getModel().decorators).toBeUndefined();
	});

	it('decoratorsForElement filters by applies-to', () => {
		applyFromJson(archWithNode);
		upsertDecorator(buildGemaraDecorator({ kind: 'control', catalogRef: ref, control, appliesTo: ['vector-store'] }));
		upsertDecorator(
			buildGemaraDecorator({ kind: 'catalog', catalogRef: { ...ref, catalogId: 'ccc-objstor' }, appliesTo: ['object-store'] }),
		);
		expect(decoratorsForElement('vector-store')).toHaveLength(1);
		expect(decoratorsForElement('object-store')).toHaveLength(1);
		expect(decoratorsForElement('nope')).toHaveLength(0);
	});

	it('removeDecoratorFromElement unbinds one element and keeps the rest', () => {
		applyFromJson(archWithNode);
		// One decorator bound to two elements (a node and the whole architecture).
		upsertDecorator(
			buildGemaraDecorator({
				kind: 'catalog',
				catalogRef: ref,
				appliesTo: ['vector-store', GEMARA_ARCHITECTURE_SCOPE],
			}),
		);
		const id = 'gemara:finos/mara-controls@0.3.0';

		removeDecoratorFromElement(id, 'vector-store');
		expect(getModel().decorators).toHaveLength(1);
		expect(getModel().decorators![0]!['applies-to']).toEqual([GEMARA_ARCHITECTURE_SCOPE]);

		removeDecoratorFromElement(id, GEMARA_ARCHITECTURE_SCOPE);
		expect(getModel().decorators).toBeUndefined();
	});

	it('mergeDecorators folds a sidecar onto embedded decorators (union, incoming wins)', () => {
		applyFromJson(archWithNode);
		// Embedded (legacy) decorator already in the model.
		upsertDecorator(buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['vector-store'] }));

		// Sidecar carries the same id bound to another element + a brand-new decorator.
		mergeDecorators([
			buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: [GEMARA_ARCHITECTURE_SCOPE] }),
			buildGemaraDecorator({ kind: 'catalog', catalogRef: { ...ref, catalogId: 'ccc-objstor' }, appliesTo: ['object-store'] }),
		]);

		const decorators = getModel().decorators!;
		expect(decorators).toHaveLength(2);
		const same = decorators.find((d) => d['unique-id'] === 'gemara:finos/mara-controls@0.3.0')!;
		expect(same['applies-to'].sort()).toEqual([GEMARA_ARCHITECTURE_SCOPE, 'vector-store'].sort());
	});

	it('a bound gemara-link decorator survives a canvas round-trip', () => {
		applyFromJson(archWithNode);
		upsertDecorator(buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['vector-store'] }));

		const { nodes, edges } = calmToFlow(getModel());
		applyFromCanvas(nodes, edges);

		expect(
			getModel().decorators?.some((d) => d['unique-id'] === 'gemara:finos/mara-controls@0.3.0'),
		).toBe(true);
	});
});
