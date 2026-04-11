// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * fileSystemTauri.ts — Tauri-specific file open/save using native OS dialogs.
 *
 * Replaces the browser File System Access API (fileSystem.ts) in desktop mode.
 * File handles are plain path strings in Tauri (vs FileSystemFileHandle objects
 * in browser FSA). All functions are guarded by isTauri() in the routing layer.
 *
 * Requires: @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs (Tauri 2)
 * Permissions: dialog:default, fs:allow-read-text-file, fs:allow-write-text-file
 */

import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { OpenFileResult } from './fileSystem';

/**
 * Open a .calm.json or .json file via the native OS file picker.
 * Returns result with handle typed as the path string (for Tauri).
 *
 * Throws if the user cancels the dialog.
 */
export async function openFileTauri(): Promise<OpenFileResult & { handle: string }> {
	const path = await open({
		multiple: false,
		filters: [{ name: 'CALM JSON', extensions: ['json'] }],
	});

	if (!path || typeof path !== 'string') {
		throw new Error('No file selected');
	}

	const content = await readTextFile(path);
	const name = path.split(/[\\/]/).pop() ?? path;

	return { content, name, handle: path };
}

/**
 * Save content in-place to a known file path.
 * Used when the user has already opened/saved a file and the path is known.
 *
 * Returns the same path (for consistency with FSA handle return pattern).
 */
export async function saveFileTauri(content: string, path: string): Promise<string> {
	await writeTextFile(path, content);
	return path;
}

/**
 * Save content to a new file via the native OS save dialog.
 * Returns the chosen path, or null if the user cancels.
 */
export async function saveFileAsTauri(
	content: string,
	suggestedName: string,
): Promise<string | null> {
	const path = await save({
		defaultPath: suggestedName,
		filters: [{ name: 'CALM JSON', extensions: ['json'] }],
	});

	if (!path) return null;

	await writeTextFile(path, content);
	return path;
}
