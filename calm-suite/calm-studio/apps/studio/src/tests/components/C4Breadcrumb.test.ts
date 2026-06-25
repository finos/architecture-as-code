// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import C4Breadcrumb from '$lib/c4/C4Breadcrumb.svelte';

describe('C4Breadcrumb', () => {
	it('renders the root label (doc trail) and the current location', () => {
		const utils = render(C4Breadcrumb, {
			props: { level: 'container', rootLabel: 'Multi-Agent System', drillStack: [{ nodeId: 'a', label: 'Agent Layer' }] },
		});
		expect(utils.getByText('Multi-Agent System')).toBeTruthy();
		expect(utils.getByText('Agent Layer')).toBeTruthy();
	});

	it('clicking the root crumb navigates to index 0', async () => {
		const onnavigate = vi.fn();
		const utils = render(C4Breadcrumb, {
			props: {
				level: 'component',
				rootLabel: 'Root',
				drillStack: [{ nodeId: 'a', label: 'A' }, { nodeId: 'b', label: 'B' }],
				onnavigate,
			},
		});
		await fireEvent.click(utils.getByRole('button', { name: 'Root' }));
		expect(onnavigate).toHaveBeenCalledWith(0);
	});

	it('shows the edit action when oneditdocument is provided and calls it', async () => {
		const oneditdocument = vi.fn();
		const utils = render(C4Breadcrumb, {
			props: { level: 'container', drillStack: [{ nodeId: 'a', label: 'A' }], oneditdocument },
		});
		await fireEvent.click(utils.getByRole('button', { name: /edit this layer/i }));
		expect(oneditdocument).toHaveBeenCalledOnce();
	});

	it('omits the edit action when oneditdocument is not provided', () => {
		const utils = render(C4Breadcrumb, { props: { level: 'context', rootLabel: 'Root' } });
		expect(utils.queryByRole('button', { name: /edit this layer/i })).toBeNull();
	});
});
