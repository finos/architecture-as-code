// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import DecoratorBadge from '$lib/canvas/nodes/DecoratorBadge.svelte';
import { applyFromJson, upsertDecorator, resetModel } from '$lib/stores/calmModel.svelte';
import { buildGemaraDecorator, type CalmArchitecture } from '@calmstudio/calm-core';

const ref = { namespace: 'finos', catalogId: 'mara-controls', version: '0.3.0' };
const arch: CalmArchitecture = {
	nodes: [{ 'unique-id': 'vector-store', 'node-type': 'database', name: 'Vector Store', description: 'x' }],
	relationships: [],
};

beforeEach(() => resetModel());

describe('DecoratorBadge', () => {
	it('renders nothing when the element has no decorators', () => {
		applyFromJson(arch);
		const { container } = render(DecoratorBadge, { props: { elementId: 'vector-store' } });
		expect(container.querySelector('.deco')).toBeNull();
	});

	it('renders a diamond and quickview rows for attached decorators', () => {
		applyFromJson(arch);
		upsertDecorator(buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['vector-store'] }));
		const utils = render(DecoratorBadge, { props: { elementId: 'vector-store' } });
		expect(utils.container.querySelector('.deco')).not.toBeNull();
		// Quickview lists the catalog.
		expect(utils.getByText('mara-controls')).toBeTruthy();
		expect(utils.getByText(/requirements ·/)).toBeTruthy();
	});

	it('shows a count when more than one decorator applies', () => {
		applyFromJson(arch);
		upsertDecorator(buildGemaraDecorator({ kind: 'catalog', catalogRef: ref, appliesTo: ['vector-store'] }));
		upsertDecorator(
			buildGemaraDecorator({ artifact: 'guidance', kind: 'catalog', catalogRef: { namespace: 'finos-aigf', catalogId: 'finos-air', version: '0.2.0' }, appliesTo: ['vector-store'] }),
		);
		const utils = render(DecoratorBadge, { props: { elementId: 'vector-store' } });
		expect(utils.container.querySelector('.count')?.textContent).toBe('2');
	});

	it('labels a custom (non-Gemara) decorator by its type', () => {
		applyFromJson({
			...arch,
			decorators: [
				{ 'unique-id': 'x', type: 'threat-model', target: ['a.json'], 'applies-to': ['vector-store'], data: { sev: 'high' } },
			],
		});
		const utils = render(DecoratorBadge, { props: { elementId: 'vector-store' } });
		expect(utils.getByText('threat-model')).toBeTruthy();
		expect(utils.getByText('custom decorator')).toBeTruthy();
	});
});
