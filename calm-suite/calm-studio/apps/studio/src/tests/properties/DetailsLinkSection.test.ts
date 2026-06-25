// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DetailsLinkSection from '$lib/properties/DetailsLinkSection.svelte';
import { applyFromJson, getModel, resetModel } from '$lib/stores/calmModel.svelte';
import { registerC4Document, clearC4Documents } from '$lib/c4/c4Documents.svelte';
import type { Node } from '@xyflow/svelte';
import type { CalmArchitecture } from '@calmstudio/calm-core';

beforeEach(() => {
	resetModel();
	clearC4Documents();
});

const nodeFor = (details?: Record<string, string>): Node =>
	({ id: 'agent-layer', data: { calmId: 'agent-layer', label: 'Agent Layer', details } }) as unknown as Node;

const archWith = (details?: Record<string, string>): CalmArchitecture => ({
	nodes: [{ 'unique-id': 'agent-layer', 'node-type': 'system', name: 'Agent Layer', description: 'x', ...(details ? { details } : {}) }],
	relationships: [],
});

const detailsOf = (id: string) =>
	(getModel().nodes.find((n) => n['unique-id'] === id) as { details?: unknown }).details;

describe('DetailsLinkSection — authoring the C4 link', () => {
	it('writes details.detailed-architecture + required-pattern into the model', async () => {
		applyFromJson(archWith());
		const utils = render(DetailsLinkSection, { props: { node: nodeFor(), onmutate: vi.fn() } });
		await fireEvent.click(utils.getByRole('button', { name: /detailed architecture/i }));

		const da = utils.getByPlaceholderText(/detailed CALM document/i);
		await fireEvent.input(da, { target: { value: 'https://x/agent-layer.arch.json' } });
		await fireEvent.blur(da);
		expect(detailsOf('agent-layer')).toEqual({ 'detailed-architecture': 'https://x/agent-layer.arch.json' });

		const rp = utils.getByPlaceholderText(/pattern it must conform to/i);
		await fireEvent.input(rp, { target: { value: 'https://x/agent-layer.pattern.json' } });
		await fireEvent.blur(rp);
		expect(detailsOf('agent-layer')).toEqual({
			'detailed-architecture': 'https://x/agent-layer.arch.json',
			'required-pattern': 'https://x/agent-layer.pattern.json',
		});
	});

	it('removes details when the link is cleared', async () => {
		applyFromJson(archWith({ 'detailed-architecture': 'https://x/a.json' }));
		const utils = render(DetailsLinkSection, {
			props: { node: nodeFor({ 'detailed-architecture': 'https://x/a.json' }) },
		});
		// section auto-expands when the node is already linked
		const da = utils.getByPlaceholderText(/detailed CALM document/i);
		await fireEvent.input(da, { target: { value: '' } });
		await fireEvent.blur(da);
		expect(detailsOf('agent-layer')).toBeUndefined();
	});

	it('shows resolution feedback when the ref resolves to a registered document', async () => {
		const ref = 'https://x/agent-runtime.arch.json';
		registerC4Document(ref, {
			nodes: [{ 'unique-id': 'agent-runtime', 'node-type': 'service', name: 'Agent Runtime', description: 'x' }],
			relationships: [],
		});
		applyFromJson(archWith({ 'detailed-architecture': ref }));
		const utils = render(DetailsLinkSection, { props: { node: nodeFor({ 'detailed-architecture': ref }) } });
		expect(await utils.findByText(/Resolves → Agent Runtime/)).toBeTruthy();
	});

	it('shows "not loaded" when the ref does not resolve', async () => {
		applyFromJson(archWith({ 'detailed-architecture': 'https://x/missing.json' }));
		const utils = render(DetailsLinkSection, { props: { node: nodeFor({ 'detailed-architecture': 'https://x/missing.json' }) } });
		expect(await utils.findByText(/not loaded/i)).toBeTruthy();
	});

	it('offers a picker of session-registered docs and links the node when one is chosen', async () => {
		registerC4Document('agent-layer.arch.json', {
			nodes: [{ 'unique-id': 'agent-layer', 'node-type': 'system', name: 'Agent Layer', description: 'x' }],
			relationships: [],
		});
		applyFromJson(archWith());
		const utils = render(DetailsLinkSection, { props: { node: nodeFor(), onmutate: vi.fn() } });
		await fireEvent.click(utils.getByRole('button', { name: /detailed architecture/i }));

		const picker = utils.getByRole('combobox'); // the registered-doc <select>
		await fireEvent.change(picker, { target: { value: 'agent-layer.arch.json' } });
		expect(detailsOf('agent-layer')).toEqual({ 'detailed-architecture': 'agent-layer.arch.json' });
	});

	it('omits the picker when no documents are registered', async () => {
		applyFromJson(archWith());
		const utils = render(DetailsLinkSection, { props: { node: nodeFor() } });
		await fireEvent.click(utils.getByRole('button', { name: /detailed architecture/i }));
		expect(utils.queryByRole('combobox')).toBeNull();
	});
});
