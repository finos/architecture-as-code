// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ExplorerContextMenu from '$lib/explorer/ExplorerContextMenu.svelte';

describe('ExplorerContextMenu', () => {
	it('lists New folder and New file, and hides Move on a file row', () => {
		const { getByRole, queryByRole } = render(ExplorerContextMenu, {
			props: {
				x: 12,
				y: 20,
				showMove: false,
				onnewfolder: vi.fn(),
				onnewfile: vi.fn(),
				onmove: vi.fn(),
			},
		});
		expect(getByRole('menuitem', { name: /new folder/i })).toBeTruthy();
		expect(getByRole('menuitem', { name: /new file/i })).toBeTruthy();
		expect(queryByRole('menuitem', { name: /^move/i })).toBeNull();
	});

	it('shows Move on a folder row and fires the New file action', async () => {
		const onnewfile = vi.fn();
		const { getByRole } = render(ExplorerContextMenu, {
			props: {
				x: 0,
				y: 0,
				showMove: true,
				onnewfolder: vi.fn(),
				onnewfile,
				onmove: vi.fn(),
			},
		});
		expect(getByRole('menuitem', { name: /^move/i })).toBeTruthy();
		await fireEvent.click(getByRole('menuitem', { name: /new file/i }));
		expect(onnewfile).toHaveBeenCalledOnce();
	});
});
