// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * fileState.svelte.ts — File state store for dirty tracking and file identity.
 *
 * Uses Svelte 5 module-level $state runes (same pattern as history, clipboard,
 * theme stores). Tracks:
 *   - currentFileName: display name shown in title bar
 *   - fileHandle: FileSystemFileHandle (browser FSA) | string (Tauri path) | null
 *   - isDirty: whether the diagram has unsaved changes
 *
 * markDirty() is called on every canvas or model mutation.
 * markClean() is called after a successful save.
 * resetFileState() is called on Cmd+N (new diagram).
 *
 * The handle type is widened to support both browser FSA and Tauri desktop:
 * - Browser: FileSystemFileHandle (supports .createWritable(), .name)
 * - Desktop: string (file path, used by saveFileTauri/openFileTauri)
 */

// ─── Module-level state ───────────────────────────────────────────────────────

let currentFileName = $state<string | null>(null);
let fileHandle = $state<FileSystemFileHandle | string | null>(null);
let fileRelativePath = $state<string | null>(null);
let isDirty = $state(false);
/** JSON snapshot at last save/open — used for reliable dirty detection. */
let cleanSnapshot = $state<string | null>(null);

const EMPTY_MODEL_JSON = JSON.stringify({ nodes: [], relationships: [] }, null, 2);

// ─── Getters ──────────────────────────────────────────────────────────────────

/** Returns the current filename, or null if no file has been opened/saved. */
export function getFileName(): string | null {
	return currentFileName;
}

/**
 * Returns the file handle (FileSystemFileHandle in browser, string path in
 * Tauri desktop, null if unsaved).
 */
export function getFileHandle(): FileSystemFileHandle | string | null {
	return fileHandle;
}

/**
 * Returns the file path string if in Tauri desktop mode (handle is a string),
 * or null for browser FSA handles and unsaved files.
 */
export function getFilePath(): string | null {
	return typeof fileHandle === 'string' ? fileHandle : null;
}

/** Returns the path of the current file relative to the explorer project root. */
export function getFileRelativePath(): string | null {
	return fileRelativePath;
}

/** Returns true if the diagram has unsaved changes (flag or content differs from snapshot). */
export function getIsDirty(): boolean {
	return isDirty;
}

/**
 * Content-aware dirty check — compares current JSON to the last clean snapshot.
 * More reliable than the isDirty flag alone (e.g. canvas edits before markDirty).
 */
export function hasUnsavedChanges(currentJson: string): boolean {
	if (isDirty) return true;
	if (cleanSnapshot === null) {
		return currentJson.trim() !== EMPTY_MODEL_JSON;
	}
	return currentJson !== cleanSnapshot;
}

/** Store the current JSON as the clean baseline (after open/save/new). */
export function setCleanSnapshot(currentJson: string): void {
	cleanSnapshot = currentJson;
	isDirty = false;
}

// ─── Mutators ─────────────────────────────────────────────────────────────────

/** Mark the diagram as having unsaved changes. */
export function markDirty(): void {
	isDirty = true;
}

/**
 * If the diagram has unsaved changes, prompt the user to discard them.
 * @returns true when it is safe to proceed (clean or user confirmed discard).
 * @deprecated Prefer async prompt with UnsavedChangesDialog via hasUnsavedChanges + UI.
 */
export function confirmDiscardUnsavedChanges(
	message = 'You have unsaved changes. Continue without saving?'
): boolean {
	if (!isDirty) return true;
	return window.confirm(message);
}

/**
 * Mark the diagram as clean (saved).
 * Optionally update the filename and/or file handle.
 *
 * @param name    New filename to display (undefined = no change)
 * @param handle  New handle: FileSystemFileHandle (browser) or string path (Tauri)
 *                (undefined = no change, null = clear handle)
 */
export function markClean(
	name?: string,
	handle?: FileSystemFileHandle | string | null,
	relativePath?: string | null,
): void {
	isDirty = false;
	if (name !== undefined) currentFileName = name;
	if (handle !== undefined) fileHandle = handle;
	if (relativePath !== undefined) fileRelativePath = relativePath;
	// Note: caller should also call setCleanSnapshot(getModelJson()) after model is updated.
}

/**
 * Reset all file state to initial values.
 * Called when creating a new diagram (Cmd+N).
 */
export function resetFileState(): void {
	currentFileName = null;
	fileHandle = null;
	fileRelativePath = null;
	isDirty = false;
	cleanSnapshot = EMPTY_MODEL_JSON;
}
