// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
	confirmDiscardUnsavedChanges,
	getFileName,
	getFileRelativePath,
	hasUnsavedChanges,
	markClean,
	markDirty,
	resetFileState,
	setCleanSnapshot,
} from '$lib/io/fileState.svelte';

const EMPTY_JSON = JSON.stringify({ nodes: [], relationships: [] }, null, 2);

describe('hasUnsavedChanges', () => {
	beforeEach(() => {
		resetFileState();
	});

	test('returns false for empty model at baseline', () => {
		setCleanSnapshot(EMPTY_JSON);
		expect(hasUnsavedChanges(EMPTY_JSON)).toBe(false);
	});

	test('returns true when JSON differs from snapshot', () => {
		setCleanSnapshot(EMPTY_JSON);
		const modified = JSON.stringify({ nodes: [{ 'unique-id': 'n1' }], relationships: [] }, null, 2);
		expect(hasUnsavedChanges(modified)).toBe(true);
	});

	test('returns true when isDirty flag is set', () => {
		setCleanSnapshot(EMPTY_JSON);
		markDirty();
		expect(hasUnsavedChanges(EMPTY_JSON)).toBe(true);
	});

	test('setCleanSnapshot clears isDirty flag', () => {
		markDirty();
		setCleanSnapshot(EMPTY_JSON);
		expect(hasUnsavedChanges(EMPTY_JSON)).toBe(false);
	});

	test('detects changes without markDirty when content differs from snapshot', () => {
		setCleanSnapshot(EMPTY_JSON);
		const modified = JSON.stringify(
			{ nodes: [{ 'unique-id': 'n1', 'node-type': 'service', name: 'S', description: '' }], relationships: [] },
			null,
			2
		);
		expect(hasUnsavedChanges(modified)).toBe(true);
	});

	test('resetFileState establishes empty baseline', () => {
		markDirty();
		markClean('test.json', null, 'arch/test.json');
		resetFileState();
		expect(hasUnsavedChanges(EMPTY_JSON)).toBe(false);
		expect(getFileName()).toBeNull();
		expect(getFileRelativePath()).toBeNull();
	});
});

describe('setCleanSnapshot and markClean', () => {
	beforeEach(() => {
		resetFileState();
	});

	test('setCleanSnapshot after markClean keeps document clean for matching JSON', () => {
		const saved = JSON.stringify({ nodes: [], relationships: [] }, null, 2);
		markDirty();
		setCleanSnapshot(saved);
		markClean('saved.json', null, 'arch/saved.json');
		expect(hasUnsavedChanges(saved)).toBe(false);
		expect(getFileName()).toBe('saved.json');
		expect(getFileRelativePath()).toBe('arch/saved.json');
	});
});

describe('confirmDiscardUnsavedChanges', () => {
	beforeEach(() => {
		resetFileState();
		vi.restoreAllMocks();
	});

	test('returns true when document is clean', () => {
		expect(confirmDiscardUnsavedChanges()).toBe(true);
	});

	test('prompts when document is dirty', () => {
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		markDirty();
		expect(confirmDiscardUnsavedChanges()).toBe(false);
		expect(confirm).toHaveBeenCalledOnce();
	});

	test('returns true when user confirms discard', () => {
		vi.spyOn(window, 'confirm').mockReturnValue(true);
		markDirty();
		expect(confirmDiscardUnsavedChanges()).toBe(true);
	});

	test('does not prompt after markClean', () => {
		const confirm = vi.spyOn(window, 'confirm');
		markDirty();
		markClean();
		expect(confirmDiscardUnsavedChanges()).toBe(true);
		expect(confirm).not.toHaveBeenCalled();
	});
});
