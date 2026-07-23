// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/** Minimal File System Access API types for Chrome/Safari folder browsing. */

interface FileSystemHandlePermissionDescriptor {
	mode?: 'read' | 'readwrite';
}

interface FileSystemDirectoryHandle {
	entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
	queryPermission(
		descriptor?: FileSystemHandlePermissionDescriptor
	): Promise<PermissionState>;
	requestPermission(
		descriptor?: FileSystemHandlePermissionDescriptor
	): Promise<PermissionState>;
}

interface Window {
	showDirectoryPicker?(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
}
