// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DuplicateNodeDialog from '$lib/canvas/DuplicateNodeDialog.svelte';

describe('Ctrl+duplicate freeze', () => {
	it('keeps the dialog responsive after typing (no focus/select loop)', async () => {
		const onconfirm = vi.fn();
		const oncancel = vi.fn();
		const { getByRole, container } = render(DuplicateNodeDialog, {
			props: { defaultName: 'API (copy)', onconfirm, oncancel },
		});
		const input = container.querySelector('input[type="text"]') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'API copy 2' } });
		await fireEvent.input(input, { target: { value: 'API copy 3' } });
		expect(input.value).toBe('API copy 3');
		expect(getByRole('dialog')).toBeTruthy();
		await fireEvent.click(getByRole('button', { name: 'OK' }));
		expect(onconfirm).toHaveBeenCalledWith({
			name: 'API copy 3',
			duplicateRelationships: false,
		});
	});

	it('does not let Ctrl+A bubble out of the dialog', async () => {
		const onconfirm = vi.fn();
		const outer = vi.fn();
		window.addEventListener('keydown', outer);
		render(DuplicateNodeDialog, {
			props: { defaultName: 'Node', onconfirm, oncancel: vi.fn() },
		});
		await fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
		window.removeEventListener('keydown', outer);
		expect(onconfirm).not.toHaveBeenCalled();
	});
});
