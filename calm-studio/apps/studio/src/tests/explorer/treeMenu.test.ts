// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { treeMenuActions, treeMenuDirectory, treeMenuShowsMove } from '$lib/explorer/treeMenu';

describe('treeMenu', () => {
	it('shows New folder, New file, and Move on a directory row', () => {
		const target = { kind: 'directory' as const, path: 'org/components-int' };
		expect(treeMenuActions(target)).toEqual(['new-folder', 'new-file', 'move']);
		expect(treeMenuShowsMove(target)).toBe(true);
		expect(treeMenuDirectory(target)).toBe('org/components-int');
	});

	it('shows Move on a file row and uses the parent directory for new items', () => {
		const target = { kind: 'file' as const, path: 'org/c/coa.appcomp.json' };
		expect(treeMenuActions(target)).toEqual(['new-folder', 'new-file', 'move']);
		expect(treeMenuShowsMove(target)).toBe(true);
		expect(treeMenuDirectory(target)).toBe('org/c');
	});

	it('creates at project root for empty / root clicks', () => {
		const target = { kind: 'empty' as const };
		expect(treeMenuActions(target)).toEqual(['new-folder', 'new-file']);
		expect(treeMenuShowsMove(target)).toBe(false);
		expect(treeMenuDirectory(target)).toBe('');
	});
});
