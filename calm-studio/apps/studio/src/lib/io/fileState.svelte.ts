// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * fileState.svelte.ts — File state store for dirty tracking and file identity.
 *
 * Uses Svelte 5 module-level $state runes (same pattern as history, clipboard,
 * theme stores). Tracks:
 *   - currentFileName: display name shown in title bar
 *   - fileHandle: FileSystemFileHandle | null
 *   - isDirty: whether the diagram has unsaved changes
 *
 * markDirty() is called on every canvas or model mutation.
 * markClean() is called after a successful save.
 * resetFileState() is called on Cmd+N (new diagram).
 */

// ─── Module-level state ───────────────────────────────────────────────────────

let currentFileName = $state<string | null>(null);
let fileHandle = $state<FileSystemFileHandle | null>(null);
let isDirty = $state(false);

// ─── Getters ──────────────────────────────────────────────────────────────────

/** Returns the current filename, or null if no file has been opened/saved. */
export function getFileName(): string | null {
	return currentFileName;
}

/** Returns the file handle, or null if unsaved. */
export function getFileHandle(): FileSystemFileHandle | null {
	return fileHandle;
}

/** Returns true if the diagram has unsaved changes. */
export function getIsDirty(): boolean {
	return isDirty;
}

// ─── Mutators ─────────────────────────────────────────────────────────────────

/** Mark the diagram as having unsaved changes. */
export function markDirty(): void {
	isDirty = true;
}

/**
 * Mark the diagram as clean (saved).
 * Optionally update the filename and/or file handle.
 *
 * @param name    New filename to display (undefined = no change)
 * @param handle  New handle (undefined = no change, null = clear handle)
 */
export function markClean(
	name?: string,
	handle?: FileSystemFileHandle | null,
): void {
	isDirty = false;
	if (name !== undefined) currentFileName = name;
	if (handle !== undefined) fileHandle = handle;
}

/**
 * Reset all file state to initial values.
 * Called when creating a new diagram (Cmd+N).
 */
export function resetFileState(): void {
	currentFileName = null;
	fileHandle = null;
	isDirty = false;
}
