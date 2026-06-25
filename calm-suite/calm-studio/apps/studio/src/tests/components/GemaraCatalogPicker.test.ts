// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import GemaraCatalogPicker from '$lib/properties/GemaraCatalogPicker.svelte';

const body = {
	metadata: { id: 'mara-controls', version: '0.3.0', title: 'MARA Controls' },
	controls: [{ id: 'MARA-VS-007', title: 'Vector store tenant isolation' }],
};

function renderPicker(
	overrides: Partial<{ onbind: () => void; oncancel: () => void; artifact: 'guidance' | 'requirements' }> = {},
) {
	const onbind = overrides.onbind ?? vi.fn();
	const oncancel = overrides.oncancel ?? vi.fn();
	const utils = render(GemaraCatalogPicker, {
		props: { elementId: 'vector-store', artifact: overrides.artifact ?? 'requirements', onbind, oncancel },
	});
	return { ...utils, onbind, oncancel };
}

async function pasteAndParse(utils: ReturnType<typeof renderPicker>) {
	await fireEvent.click(utils.getByRole('tab', { name: 'Paste' }));
	await fireEvent.input(utils.getByLabelText(/catalog source/i), {
		target: { value: JSON.stringify(body) },
	});
	await fireEvent.click(utils.getByRole('button', { name: 'Parse' }));
}

describe('GemaraCatalogPicker', () => {
	it('cancels via the close button', async () => {
		const oncancel = vi.fn();
		const utils = renderPicker({ oncancel });
		await fireEvent.click(utils.getByRole('button', { name: /close/i }));
		expect(oncancel).toHaveBeenCalledOnce();
	});

	it('shows the artifact-specific heading', () => {
		expect(renderPicker({ artifact: 'guidance' }).getByText('Attach Guidance')).toBeTruthy();
		expect(renderPicker({ artifact: 'requirements' }).getByText('Attach Requirements')).toBeTruthy();
	});

	it('parses a pasted catalog and attaches the whole catalog (no namespace prefix)', async () => {
		const onbind = vi.fn();
		const utils = renderPicker({ onbind });
		await pasteAndParse(utils);

		expect(utils.getByText('MARA Controls')).toBeTruthy();
		await fireEvent.click(utils.getByRole('button', { name: 'Attach' }));

		expect(onbind).toHaveBeenCalledOnce();
		const decorators = onbind.mock.calls[0]![0];
		expect(decorators).toHaveLength(1);
		expect(decorators[0]).toMatchObject({
			type: 'gemara-link',
			'applies-to': ['vector-store'],
			'unique-id': 'gemara:mara-controls@0.3.0',
			data: { artifact: 'requirements', kind: 'catalog', verified: false },
		});
	});

	it('tags the attachment with the guidance artifact', async () => {
		const onbind = vi.fn();
		const utils = renderPicker({ onbind, artifact: 'guidance' });
		await pasteAndParse(utils);
		await fireEvent.click(utils.getByRole('button', { name: 'Attach' }));
		expect(onbind.mock.calls[0]![0][0].data.artifact).toBe('guidance');
	});

	it('accepts a pasted YAML catalog (the grcli unpack format)', async () => {
		const onbind = vi.fn();
		const utils = renderPicker({ onbind });
		const yaml = [
			'metadata:',
			'  id: mara-controls',
			'  version: 0.3.0',
			'  title: MARA Controls',
			'controls:',
			'  - id: MARA-VS-007',
			'    title: Vector store tenant isolation',
		].join('\n');
		await fireEvent.click(utils.getByRole('tab', { name: 'Paste' }));
		await fireEvent.input(utils.getByLabelText(/catalog source/i), { target: { value: yaml } });
		await fireEvent.click(utils.getByRole('button', { name: 'Parse' }));

		expect(utils.getByText('MARA Controls')).toBeTruthy();
		await fireEvent.click(utils.getByRole('button', { name: 'Attach' }));
		expect(onbind.mock.calls[0]![0][0]).toMatchObject({
			'unique-id': 'gemara:mara-controls@0.3.0',
		});
	});

	it('shows a parse error for input that is neither valid YAML nor JSON', async () => {
		const utils = renderPicker();
		await fireEvent.click(utils.getByRole('tab', { name: 'Paste' }));
		await fireEvent.input(utils.getByLabelText(/catalog source/i), { target: { value: '{not: valid: yaml' } });
		await fireEvent.click(utils.getByRole('button', { name: 'Parse' }));
		expect(utils.getByRole('alert')).toBeTruthy();
	});
});
