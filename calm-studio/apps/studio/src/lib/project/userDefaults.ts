// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * User-home defaults file (R62). Browser: explicit picker + IndexedDB handle.
 */

import { isCalmProjectConfig } from './defaults';
import type { CalmProjectConfig } from './types';
import {
	ensureReadPermission,
	ensureReadWritePermission,
	loadNamedDirectoryHandle,
	saveNamedDirectoryHandle,
} from '$lib/explorer/folderPersistence';

export const USER_DEFAULTS_HANDLE_KEY = 'user-defaults-file';

type FilePickerWindow = Window & {
	showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
	showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
};

async function persistFileHandle(handle: FileSystemFileHandle): Promise<void> {
	await saveNamedDirectoryHandle(USER_DEFAULTS_HANDLE_KEY, handle as unknown as FileSystemDirectoryHandle);
}

async function loadPersistedFileHandle(): Promise<FileSystemFileHandle | null> {
	const handle = await loadNamedDirectoryHandle(USER_DEFAULTS_HANDLE_KEY);
	return (handle as unknown as FileSystemFileHandle | null) ?? null;
}

async function parseUserFile(handle: FileSystemFileHandle): Promise<CalmProjectConfig | null> {
	const granted = await ensureReadPermission(handle as unknown as FileSystemDirectoryHandle);
	if (!granted) return null;
	const text = await (await handle.getFile()).text();
	const parsed: unknown = JSON.parse(text);
	return isCalmProjectConfig(parsed) ? parsed : null;
}

export async function loadUserDefaultsConfig(): Promise<CalmProjectConfig | null> {
	try {
		const handle = await loadPersistedFileHandle();
		if (!handle) return null;
		return await parseUserFile(handle);
	} catch {
		return null;
	}
}

export async function pickUserDefaultsFile(): Promise<CalmProjectConfig | null> {
	const w = window as FilePickerWindow;
	if (typeof w.showOpenFilePicker !== 'function') {
		throw new Error('File picker is not available in this browser');
	}
	const [handle] = await w.showOpenFilePicker({
		multiple: false,
		types: [
			{
				description: 'CALM Studio config',
				accept: { 'application/json': ['.json', '.calmrj'] },
			},
		],
	});
	if (!handle) return null;
	await persistFileHandle(handle);
	const parsed = await parseUserFile(handle);
	if (!parsed) throw new Error('Selected file is not a valid .calmrj config');
	return parsed;
}

export async function saveUserDefaultsConfig(config: CalmProjectConfig): Promise<void> {
	const w = window as FilePickerWindow;
	let handle = await loadPersistedFileHandle();
	if (!handle) {
		if (typeof w.showSaveFilePicker !== 'function') {
			throw new Error('File picker is not available in this browser');
		}
		handle = await w.showSaveFilePicker({
			suggestedName: '.calmrj',
			types: [
				{
					description: 'CALM Studio config',
					accept: { 'application/json': ['.json', '.calmrj'] },
				},
			],
		});
		await persistFileHandle(handle);
	}
	const writableGranted = await ensureReadWritePermission(
		handle as unknown as FileSystemDirectoryHandle
	);
	if (!writableGranted) {
		throw new Error('Write permission required for user defaults');
	}
	const writable = await handle.createWritable();
	await writable.write(JSON.stringify(config, null, 2) + '\n');
	await writable.close();
}
