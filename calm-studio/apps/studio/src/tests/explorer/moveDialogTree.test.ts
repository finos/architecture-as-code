// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from 'vitest';
import type { ExplorerTreeEntry } from '$lib/explorer/types';
import {
	PROJECT_ROOT_FIELD,
	buildMoveFolderTree,
	defaultExpandedMoveFolderPaths,
	fileMoveDestination,
	folderPathFromMoveField,
	listProjectFolders,
} from '$lib/explorer/moveDialogTarget';

const tree: ExplorerTreeEntry[] = [
	{
		kind: 'directory',
		name: 'org',
		relativePath: 'org',
		children: [
			{
				kind: 'directory',
				name: 'components',
				relativePath: 'org/components',
				children: [
					{
						kind: 'file',
						name: 'coa.json',
						relativePath: 'org/components/coa.json',
						handle: {} as FileSystemFileHandle,
						isCalm: true,
					},
				],
			},
		],
	},
	{
		kind: 'file',
		name: 'root.json',
		relativePath: 'root.json',
		handle: {} as FileSystemFileHandle,
		isCalm: true,
	},
];

describe('buildMoveFolderTree', () => {
	test('nests directories and skips files', () => {
		expect(buildMoveFolderTree(tree)).toEqual([
			{
				path: 'org',
				name: 'org',
				fieldValue: 'org',
				children: [
					{
						path: 'org/components',
						name: 'components',
						fieldValue: 'org/components',
						children: [],
					},
				],
			},
		]);
	});
});

describe('defaultExpandedMoveFolderPaths', () => {
	test('expands every top-level folder', () => {
		expect([...defaultExpandedMoveFolderPaths(tree)].sort()).toEqual(['org']);
	});
});

describe('listProjectFolders', () => {
	test('lists the project root and folders, not files', () => {
		expect(listProjectFolders(tree)).toEqual([
			{ path: '', name: PROJECT_ROOT_FIELD, depth: 0, fieldValue: PROJECT_ROOT_FIELD },
			{ path: 'org', name: 'org', depth: 1, fieldValue: 'org' },
			{ path: 'org/components', name: 'components', depth: 2, fieldValue: 'org/components' },
		]);
	});
});

describe('file move destination', () => {
	test('keeps a typed path when the folder field is empty', () => {
		expect(fileMoveDestination('org/components/coa.json', '')).toBe('org/components/coa.json');
	});

	test('a picked folder keeps the file name', () => {
		expect(fileMoveDestination('org/components/coa.json', 'other/place')).toBe(
			'other/place/coa.json'
		);
	});

	test('the project root keeps only the file name', () => {
		expect(fileMoveDestination('org/components/coa.json', PROJECT_ROOT_FIELD)).toBe('coa.json');
		expect(folderPathFromMoveField(PROJECT_ROOT_FIELD)).toBe('');
	});

	test('adds a missing json suffix', () => {
		expect(fileMoveDestination('notes', 'org')).toBe('org/notes.json');
	});
});
