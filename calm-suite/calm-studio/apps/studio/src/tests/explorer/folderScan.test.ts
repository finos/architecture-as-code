// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect } from 'vitest';
import { updateFileInTree } from '$lib/explorer/folderScan';
import type { ExplorerDirectoryEntry, ExplorerFileEntry, ExplorerTreeEntry } from '$lib/explorer/types';

function makeFile(relativePath: string, overrides: Partial<ExplorerFileEntry> = {}): ExplorerFileEntry {
	return {
		kind: 'file',
		name: relativePath.split('/').pop() ?? relativePath,
		relativePath,
		handle: {} as FileSystemFileHandle,
		isCalm: false,
		nodesLoaded: false,
		...overrides,
	};
}

function makeDir(
	name: string,
	relativePath: string,
	children: ExplorerTreeEntry[]
): ExplorerDirectoryEntry {
	return { kind: 'directory', name, relativePath, children };
}

describe('updateFileInTree', () => {
	const tree: ExplorerTreeEntry[] = [
		makeDir('arch', 'arch', [
			makeFile('arch/a.json'),
			makeFile('arch/b.json', { isCalm: true, nodesLoaded: true, nodes: [] }),
		]),
		makeFile('root.json'),
	];

	test('replaces file at root level', () => {
		const updated = makeFile('root.json', { isCalm: true, nodesLoaded: true, nodes: [] });
		const result = updateFileInTree(tree, 'root.json', updated);
		const file = result.find((e) => e.kind === 'file' && e.relativePath === 'root.json') as ExplorerFileEntry;
		expect(file.isCalm).toBe(true);
		expect(file.nodesLoaded).toBe(true);
	});

	test('replaces nested file by relative path', () => {
		const updated = makeFile('arch/a.json', {
			isCalm: true,
			nodesLoaded: true,
			nodes: [{ uniqueId: 'n1', name: 'Node', nodeType: 'service', description: '' }],
		});
		const result = updateFileInTree(tree, 'arch/a.json', updated);
		const archDir = result.find((e) => e.kind === 'directory' && e.relativePath === 'arch') as ExplorerDirectoryEntry;
		const file = archDir.children.find((c) => c.relativePath === 'arch/a.json') as ExplorerFileEntry;
		expect(file.nodes).toHaveLength(1);
		expect(file.nodes![0].uniqueId).toBe('n1');
	});

	test('does not modify unrelated files', () => {
		const updated = makeFile('arch/a.json', { isCalm: true, nodesLoaded: true, nodes: [] });
		const result = updateFileInTree(tree, 'arch/a.json', updated);
		const archDir = result.find((e) => e.kind === 'directory' && e.relativePath === 'arch') as ExplorerDirectoryEntry;
		const other = archDir.children.find((c) => c.relativePath === 'arch/b.json') as ExplorerFileEntry;
		expect(other.isCalm).toBe(true);
		expect(other.nodesLoaded).toBe(true);
	});

	test('returns unchanged tree when path not found', () => {
		const updated = makeFile('missing.json');
		const result = updateFileInTree(tree, 'missing.json', updated);
		expect(result).toEqual(tree);
	});
});
