// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MouseModeToolbar from '$lib/canvas/MouseModeToolbar.svelte';

describe('MouseModeToolbar', () => {
	it('marks Select as pressed by default and can switch to Pan', async () => {
		const onchange = vi.fn();
		const { getByRole } = render(MouseModeToolbar, {
			props: { mode: 'select', onchange },
		});
		expect(getByRole('button', { name: 'Select' }).getAttribute('aria-pressed')).toBe('true');
		expect(getByRole('button', { name: 'Pan' }).getAttribute('aria-pressed')).toBe('false');
		await fireEvent.click(getByRole('button', { name: 'Pan' }));
		expect(onchange).toHaveBeenCalledWith('pan');
	});

	it('locks the toggle on Hub / read-only tabs', () => {
		const { getByRole } = render(MouseModeToolbar, {
			props: { mode: 'pan', locked: true, onchange: vi.fn() },
		});
		expect((getByRole('button', { name: 'Select' }) as HTMLButtonElement).disabled).toBe(true);
		expect((getByRole('button', { name: 'Pan' }) as HTMLButtonElement).disabled).toBe(true);
		expect(getByRole('button', { name: 'Pan' }).getAttribute('aria-pressed')).toBe('true');
	});
});
