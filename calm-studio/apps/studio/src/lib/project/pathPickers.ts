// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Resolve File System Access handles to project-relative paths (R40).
 */

export function normalizeProjectRelativePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
}

/** Windows drive, Unix root, or file URL — not a project-relative folder. */
export function isAbsoluteFsPath(path: string): boolean {
	const normalized = path.trim().replace(/\\/g, '/');
	return (
		/^[a-zA-Z]:\//.test(normalized) ||
		normalized.startsWith('/') ||
		/^file:\/\//i.test(normalized)
	);
}

export function normalizeExtensionsDir(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+$/g, '').trim();
}

export function extensionsDirectoryHandleKey(dir: string): string {
	return `extensions-dir:${normalizeExtensionsDir(dir)}`;
}

async function walkFindDirectory(
	dir: FileSystemDirectoryHandle,
	target: FileSystemDirectoryHandle,
	prefix: string
): Promise<string | null> {
	if (await dir.isSameEntry(target)) return prefix;
	for await (const [name, handle] of dir.entries()) {
		if (handle.kind !== 'directory') continue;
		const rel = prefix ? `${prefix}/${name}` : name;
		const found = await walkFindDirectory(handle as FileSystemDirectoryHandle, target, rel);
		if (found !== null) return found;
	}
	return null;
}

async function walkFindFile(
	dir: FileSystemDirectoryHandle,
	target: FileSystemFileHandle,
	prefix: string
): Promise<string | null> {
	for await (const [name, handle] of dir.entries()) {
		if (handle.kind === 'directory') {
			const rel = prefix ? `${prefix}/${name}` : name;
			const found = await walkFindFile(handle as FileSystemDirectoryHandle, target, rel);
			if (found !== null) return found;
			continue;
		}
		if (handle.kind === 'file' && (await (handle as FileSystemFileHandle).isSameEntry(target))) {
			return prefix ? `${prefix}/${name}` : name;
		}
	}
	return null;
}

/** Relative path from project root, or null if the handle is outside the project. */
export async function relativePathOfDirectory(
	root: FileSystemDirectoryHandle,
	target: FileSystemDirectoryHandle
): Promise<string | null> {
	return walkFindDirectory(root, target, '');
}

export async function relativePathOfFile(
	root: FileSystemDirectoryHandle,
	target: FileSystemFileHandle
): Promise<string | null> {
	return walkFindFile(root, target, '');
}

export async function pickProjectDirectory(
	root: FileSystemDirectoryHandle | null
): Promise<{ path: string } | { error: string } | { cancelled: true }> {
	const result = await pickDirectoryMaybeOutside(root);
	if ('cancelled' in result || 'error' in result) return result;
	if (result.outside) return { error: 'Folder is outside the project' };
	return { path: result.path };
}

/** Directory picker that may grant a folder outside the open project (R44 extra packs). */
export async function pickDirectoryMaybeOutside(
	root: FileSystemDirectoryHandle | null
): Promise<
	| { path: string; handle: FileSystemDirectoryHandle; outside: boolean }
	| { error: string }
	| { cancelled: true }
> {
	if (!root) return { error: 'Open a project folder first' };
	if (typeof window.showDirectoryPicker !== 'function') {
		return { error: 'Directory picker is not available in this browser' };
	}
	try {
		const handle = await window.showDirectoryPicker();
		const rel = await relativePathOfDirectory(root, handle);
		if (rel !== null) {
			return { path: rel, handle, outside: false };
		}
		return { path: handle.name, handle, outside: true };
	} catch (e) {
		if ((e as Error).name === 'AbortError') return { cancelled: true };
		return { error: (e as Error).message };
	}
}

export async function pickProjectFile(
	root: FileSystemDirectoryHandle | null
): Promise<{ path: string } | { error: string } | { cancelled: true }> {
	if (!root) return { error: 'Open a project folder first' };
	const picker = (
		window as unknown as {
			showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
		}
	).showOpenFilePicker;
	if (typeof picker !== 'function') {
		return { error: 'File picker is not available in this browser' };
	}
	try {
		const [handle] = await picker({
			multiple: false,
			types: [
				{
					description: 'Ruleset',
					accept: {
						'application/json': ['.json'],
						'text/yaml': ['.yaml', '.yml'],
					},
				},
			],
		});
		if (!handle) return { cancelled: true };
		const rel = await relativePathOfFile(root, handle);
		if (rel === null) return { error: 'File is outside the project' };
		return { path: rel };
	} catch (e) {
		if ((e as Error).name === 'AbortError') return { cancelled: true };
		return { error: (e as Error).message };
	}
}
