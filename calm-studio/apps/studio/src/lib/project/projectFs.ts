// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Project-relative FS helpers for *.calmrj and extracted diagrams (R24 / R27).
 */

export async function ensureWritePermission(
	handle: FileSystemDirectoryHandle
): Promise<boolean> {
	const opts = { mode: 'readwrite' as const };
	const current = await handle.queryPermission(opts);
	if (current === 'granted') return true;
	if (current === 'denied') return false;
	const requested = await handle.requestPermission(opts);
	return requested === 'granted';
}

/** Walk/create nested directories under root. */
export async function getOrCreateDirectory(
	root: FileSystemDirectoryHandle,
	relativeDir: string
): Promise<FileSystemDirectoryHandle> {
	const parts = relativeDir
		.split('/')
		.map((p) => p.trim())
		.filter((p) => p && p !== '.' && p !== '..');
	let current = root;
	for (const part of parts) {
		current = await current.getDirectoryHandle(part, { create: true });
	}
	return current;
}

async function resolveDirectory(
	root: FileSystemDirectoryHandle,
	relativeDir: string,
	create: boolean
): Promise<FileSystemDirectoryHandle> {
	const parts = relativeDir
		.split('/')
		.map((p) => p.trim())
		.filter((p) => p && p !== '.' && p !== '..');
	let current = root;
	for (const part of parts) {
		current = await current.getDirectoryHandle(part, create ? { create: true } : undefined);
	}
	return current;
}

export async function readProjectRelativeText(
	root: FileSystemDirectoryHandle,
	relativePath: string
): Promise<string> {
	const { dir, name } = splitRelativePath(relativePath);
	const directory = dir ? await resolveDirectory(root, dir, false) : root;
	const fileHandle = await directory.getFileHandle(name);
	const file = await fileHandle.getFile();
	return file.text();
}

export async function writeProjectRelativeFile(
	root: FileSystemDirectoryHandle,
	relativePath: string,
	content: string
): Promise<FileSystemFileHandle> {
	const { dir, name } = splitRelativePath(relativePath);
	const directory = dir ? await getOrCreateDirectory(root, dir) : root;
	const fileHandle = await directory.getFileHandle(name, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(content);
	await writable.close();
	return fileHandle;
}

export async function projectRelativeFileExists(
	root: FileSystemDirectoryHandle,
	relativePath: string
): Promise<boolean> {
	try {
		await readProjectRelativeText(root, relativePath);
		return true;
	} catch {
		return false;
	}
}

export function splitRelativePath(relativePath: string): { dir: string; name: string } {
	const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
	const idx = normalized.lastIndexOf('/');
	if (idx < 0) return { dir: '', name: normalized };
	return { dir: normalized.slice(0, idx), name: normalized.slice(idx + 1) };
}

const CALMPRJ_EXT = /\.calmrj$/i;

export async function findRootCalmrjFiles(
	root: FileSystemDirectoryHandle
): Promise<string[]> {
	const names: string[] = [];
	for await (const [name, handle] of root.entries()) {
		if (handle.kind === 'file' && CALMPRJ_EXT.test(name)) {
			names.push(name);
		}
	}
	return names;
}
