// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CatalogAttachSection from '$lib/properties/CatalogAttachSection.svelte';
import { applyFromJson, upsertDecorator, getModel, resetModel } from '$lib/stores/calmModel.svelte';
import { buildGemaraDecorator, type CalmArchitecture } from '@calmstudio/calm-core';

const ref = { namespace: 'finos', catalogId: 'mara-controls', version: '0.3.0' };
const arch: CalmArchitecture = {
	nodes: [{ 'unique-id': 'vector-store', 'node-type': 'database', name: 'Vector Store', description: 'RAG store' }],
	relationships: [],
};

function renderRequirements() {
	return render(CatalogAttachSection, {
		props: { elementId: 'vector-store', artifact: 'requirements', label: 'Requirements', onmutate: vi.fn() },
	});
}

const expandToggle = (u: ReturnType<typeof renderRequirements>) =>
	fireEvent.click(u.getByRole('button', { name: /requirements/i, expanded: false }));

beforeEach(() => resetModel());

describe('CatalogAttachSection', () => {
	it('shows an empty hint when nothing is attached', async () => {
		applyFromJson(arch);
		const u = renderRequirements();
		await expandToggle(u);
		expect(u.getByText(/nothing attached/i)).toBeTruthy();
		expect(u.getByRole('button', { name: /attach requirements/i })).toBeTruthy();
	});

	it('renders a card for a requirements attachment (unverified badge hidden while verification is disabled)', async () => {
		applyFromJson(arch);
		upsertDecorator(buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['vector-store'] }));
		const u = renderRequirements();
		await expandToggle(u);
		expect(u.getByText('finos/mara-controls@0.3.0')).toBeTruthy();
		// Verification is disabled (SHOW_VERIFICATION_STATUS=false) — no unverified badge.
		expect(u.queryByText(/unverified/i)).toBeNull();
	});

	it('does not show a guidance attachment in the requirements section', async () => {
		applyFromJson(arch);
		upsertDecorator(
			buildGemaraDecorator({ artifact: 'guidance', kind: 'catalog', catalogRef: { namespace: 'finos-aigf', catalogId: 'finos-air', version: '0.2.0' }, appliesTo: ['vector-store'] }),
		);
		const u = renderRequirements();
		await expandToggle(u);
		expect(u.getByText(/nothing attached/i)).toBeTruthy();
	});

	it('removes an attachment and notifies via onmutate', async () => {
		applyFromJson(arch);
		const d = buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['vector-store'] });
		upsertDecorator(d);
		const onmutate = vi.fn();
		const u = render(CatalogAttachSection, {
			props: { elementId: 'vector-store', artifact: 'requirements', label: 'Requirements', onmutate },
		});
		await fireEvent.click(u.getByRole('button', { name: /requirements/i, expanded: false }));
		await fireEvent.click(u.getByRole('button', { name: /remove requirements/i }));
		expect(getModel().decorators).toBeUndefined();
		expect(onmutate).toHaveBeenCalled();
	});
});
