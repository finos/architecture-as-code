// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DocumentDecorators from '$lib/decorators/DocumentDecorators.svelte';
import { applyFromJson, getModel, resetModel } from '$lib/stores/calmModel.svelte';
import type { CalmArchitecture, CalmDecorator } from '@calmstudio/calm-core';

const node = { 'unique-id': 'svc', 'node-type': 'service', name: 'Svc', description: 'x' };

const archWith = (decorators?: CalmDecorator[]): CalmArchitecture => ({
	nodes: [node],
	relationships: [],
	...(decorators ? { decorators } : {}),
});

beforeEach(() => resetModel());

describe('DocumentDecorators', () => {
	it('lists every decorator for the shown document with applies-to labels', () => {
		const arch = archWith([
			{ 'unique-id': 'd1', type: 'threat-model', target: ['a.json'], 'applies-to': ['svc'], data: { x: 1 } },
			{ 'unique-id': 'd2', type: 'cost', target: ['a.json'], 'applies-to': ['@architecture'], data: { y: 2 } },
		]);
		const u = render(DocumentDecorators, { props: { architecture: arch } });
		expect(u.getByText('threat-model')).toBeTruthy();
		expect(u.getByText('cost')).toBeTruthy();
		expect(u.getByText('Svc')).toBeTruthy(); // node name resolved for applies-to chip
		expect(u.getByText('Whole document')).toBeTruthy(); // @architecture sentinel label
	});

	it('shows an empty hint when the document has no custom decorators', () => {
		const u = render(DocumentDecorators, { props: { architecture: archWith() } });
		expect(u.getByText(/no custom decorators on this document/i)).toBeTruthy();
	});

	it('excludes gemara-link decorators (those are managed in the Governance section)', () => {
		const arch = archWith([
			{ 'unique-id': 'gemara:finos/ccc@1', type: 'gemara-link', target: ['a.json'], 'applies-to': ['@architecture'], data: { kind: 'catalog' } },
			{ 'unique-id': 'd1', type: 'threat-model', target: ['a.json'], 'applies-to': ['svc'], data: { x: 1 } },
		]);
		const u = render(DocumentDecorators, { props: { architecture: arch } });
		expect(u.getByText('threat-model')).toBeTruthy();
		expect(u.queryByText('gemara-link')).toBeNull();
		// count badge reflects only the non-gemara decorator
		expect(u.getByText('1')).toBeTruthy();
	});

	it('adds a decorator scoped to the whole document by default', async () => {
		applyFromJson(archWith());
		const onmutate = vi.fn();
		const u = render(DocumentDecorators, { props: { architecture: getModel(), onmutate } });
		await fireEvent.click(u.getByRole('button', { name: /add decorator/i }));
		await fireEvent.input(u.getByLabelText(/decorator type/i), { target: { value: 'threat-model' } });
		await fireEvent.input(u.getByLabelText(/decorator data/i), { target: { value: '{"sev":"high"}' } });
		await fireEvent.click(u.getByRole('button', { name: 'Add' }));

		const decs = getModel().decorators ?? [];
		expect(decs).toHaveLength(1);
		expect(decs[0]).toMatchObject({ type: 'threat-model', 'applies-to': ['@architecture'], data: { sev: 'high' } });
		expect(onmutate).toHaveBeenCalled();
	});

	it('binds applies-to to a chosen node', async () => {
		applyFromJson(archWith());
		const u = render(DocumentDecorators, { props: { architecture: getModel(), onmutate: vi.fn() } });
		await fireEvent.click(u.getByRole('button', { name: /add decorator/i }));
		await fireEvent.input(u.getByLabelText(/decorator type/i), { target: { value: 'note' } });
		// uncheck "Whole document", check the node
		await fireEvent.click(u.getByLabelText('Whole document'));
		await fireEvent.click(u.getByLabelText('Svc'));
		await fireEvent.click(u.getByRole('button', { name: 'Add' }));

		expect((getModel().decorators ?? [])[0]['applies-to']).toEqual(['svc']);
	});

	it('rejects invalid JSON data', async () => {
		applyFromJson(archWith());
		const u = render(DocumentDecorators, { props: { architecture: getModel(), onmutate: vi.fn() } });
		await fireEvent.click(u.getByRole('button', { name: /add decorator/i }));
		await fireEvent.input(u.getByLabelText(/decorator type/i), { target: { value: 't' } });
		await fireEvent.input(u.getByLabelText(/decorator data/i), { target: { value: '{bad' } });
		await fireEvent.click(u.getByRole('button', { name: 'Add' }));
		expect(u.getByRole('alert')).toBeTruthy();
		expect(getModel().decorators).toBeUndefined();
	});

	it('removes a decorator', async () => {
		const arch = archWith([
			{ 'unique-id': 'd1', type: 'threat-model', target: ['a.json'], 'applies-to': ['svc'], data: { x: 1 } },
		]);
		applyFromJson(arch);
		const onmutate = vi.fn();
		const u = render(DocumentDecorators, { props: { architecture: getModel(), onmutate } });
		await fireEvent.click(u.getByRole('button', { name: /remove decorator threat-model/i }));
		expect(getModel().decorators).toBeUndefined();
		expect(onmutate).toHaveBeenCalled();
	});

	it('is read-only in C4 view: no add or remove affordances', () => {
		const arch = archWith([
			{ 'unique-id': 'd1', type: 'threat-model', target: ['a.json'], 'applies-to': ['svc'], data: { x: 1 } },
		]);
		const u = render(DocumentDecorators, { props: { architecture: arch, readonly: true } });
		expect(u.getByText('threat-model')).toBeTruthy(); // still listed
		expect(u.queryByRole('button', { name: /add decorator/i })).toBeNull();
		expect(u.queryByRole('button', { name: /remove decorator/i })).toBeNull();
	});
});
