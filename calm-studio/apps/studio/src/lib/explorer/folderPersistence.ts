// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

const DB_NAME = 'calm-studio-explorer';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const ROOT_KEY = 'project-root';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
	});
}

export function isDirectoryPickerSupported(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function saveRootDirectoryHandle(
	handle: FileSystemDirectoryHandle
): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put(handle, ROOT_KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function loadRootDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
	const db = await openDb();
	const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const req = tx.objectStore(STORE_NAME).get(ROOT_KEY);
		req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
		req.onerror = () => reject(req.error);
	});
	db.close();
	return handle ?? null;
}

export async function ensureReadPermission(
	handle: FileSystemDirectoryHandle
): Promise<boolean> {
	const opts = { mode: 'read' as const };
	const current = await handle.queryPermission(opts);
	if (current === 'granted') return true;
	if (current === 'denied') return false;
	const requested = await handle.requestPermission(opts);
	return requested === 'granted';
}

/** Prefer readwrite for project file create / extract (R24 / R27). Falls back to read. */
export async function ensureReadWritePermission(
	handle: FileSystemDirectoryHandle
): Promise<boolean> {
	const opts = { mode: 'readwrite' as const };
	const current = await handle.queryPermission(opts);
	if (current === 'granted') return true;
	if (current === 'prompt') {
		const requested = await handle.requestPermission(opts);
		if (requested === 'granted') return true;
	}
	return ensureReadPermission(handle);
}
