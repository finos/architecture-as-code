// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DecoratorSection from '$lib/properties/DecoratorSection.svelte';
import { applyFromJson, getModel, resetModel } from '$lib/stores/calmModel.svelte';
import type { CalmArchitecture } from '@calmstudio/calm-core';

const arch: CalmArchitecture = {
	nodes: [{ 'unique-id': 'svc', 'node-type': 'service', name: 'Svc', description: 'x' }],
	relationships: [],
};

function renderSection(onmutate = vi.fn()) {
	const u = render(DecoratorSection, { props: { elementId: 'svc', onmutate } });
	return { ...u, onmutate };
}

const expand = (u: { getByRole: (r: string, o: object) => HTMLElement }) =>
	fireEvent.click(u.getByRole('button', { name: /custom/i, expanded: false }));

beforeEach(() => resetModel());

describe('DecoratorSection', () => {
	it('adds a free-form decorator scoped to the element', async () => {
		applyFromJson(arch);
		const u = renderSection();
		await expand(u);
		await fireEvent.click(u.getByRole('button', { name: /add decorator/i }));
		await fireEvent.input(u.getByLabelText(/decorator type/i), { target: { value: 'threat-model' } });
		await fireEvent.input(u.getByLabelText(/decorator data/i), { target: { value: '{"severity":"high"}' } });
		await fireEvent.click(u.getByRole('button', { name: 'Add' }));

		const decs = getModel().decorators ?? [];
		expect(decs).toHaveLength(1);
		expect(decs[0]).toMatchObject({
			type: 'threat-model',
			'applies-to': ['svc'],
			data: { severity: 'high' },
		});
		expect(u.onmutate).toHaveBeenCalled();
	});

	it('rejects invalid JSON data', async () => {
		applyFromJson(arch);
		const u = renderSection();
		await expand(u);
		await fireEvent.click(u.getByRole('button', { name: /add decorator/i }));
		await fireEvent.input(u.getByLabelText(/decorator type/i), { target: { value: 't' } });
		await fireEvent.input(u.getByLabelText(/decorator data/i), { target: { value: '{bad' } });
		await fireEvent.click(u.getByRole('button', { name: 'Add' }));

		expect(u.getByRole('alert')).toBeTruthy();
		expect(getModel().decorators).toBeUndefined();
	});

	it('ignores gemara-link decorators (those live in their own sections)', async () => {
		applyFromJson({
			...arch,
			decorators: [
				{ 'unique-id': 'gemara:finos/x@1', type: 'gemara-link', target: ['a.json'], 'applies-to': ['svc'], data: { kind: 'catalog' } },
			],
		});
		const u = renderSection();
		await expand(u);
		expect(u.getByText(/no custom decorators/i)).toBeTruthy();
	});
});
