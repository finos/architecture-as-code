// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import PropertiesPanel from '$lib/properties/PropertiesPanel.svelte';
import { resetModel, upsertDecorator } from '$lib/stores/calmModel.svelte';
import { buildGemaraDecorator, GEMARA_ARCHITECTURE_SCOPE } from '@calmstudio/calm-core';

const ccc = { namespace: 'finos', catalogId: 'ccc-marefarch-controls', version: '0.1.0' };

beforeEach(() => resetModel());

describe('PropertiesPanel architecture surface', () => {
	it('shows the Architecture panel with the document decorators surface', () => {
		const utils = render(PropertiesPanel, {
			props: { selectedNode: null, selectedEdge: null, onmutate: vi.fn() },
		});
		expect(utils.getByText('Architecture')).toBeTruthy();

		// The single architecture-level decorator surface is DocumentDecorators
		// (custom decorators), with its add affordance...
		expect(utils.getByRole('button', { name: /add decorator/i })).toBeTruthy();
		// ...and Gemara guidance/requirements are not inline (moved to the Governance flow).
		expect(utils.queryByRole('button', { name: /requirements/i })).toBeNull();
		expect(utils.queryByRole('button', { name: /guidance/i })).toBeNull();
	});

	it('counts only custom decorators (not Gemara bindings) in the Decorators badge', () => {
		// A Gemara requirements binding is managed in the Governance flow — not counted here.
		upsertDecorator(
			buildGemaraDecorator({ kind: 'catalog', catalogRef: ccc, appliesTo: [GEMARA_ARCHITECTURE_SCOPE] }),
		);
		// A custom (non-Gemara) decorator IS counted.
		upsertDecorator({
			'unique-id': 'custom-note',
			type: 'note',
			target: [],
			'applies-to': [GEMARA_ARCHITECTURE_SCOPE],
			data: { note: 'x' },
		});
		const utils = render(PropertiesPanel, {
			props: { selectedNode: null, selectedEdge: null, onmutate: vi.fn() },
		});
		// Badge counts the 1 custom decorator, not the Gemara binding.
		expect(utils.getByText('1')).toBeTruthy();
	});
});
