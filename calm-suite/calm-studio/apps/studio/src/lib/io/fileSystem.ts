// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * fileSystem.ts — Unified file I/O with Tauri and browser File System Access API.
 *
 * Routing strategy:
 * - Desktop (Tauri): routes to fileSystemTauri.ts using native OS dialogs
 * - Browser (Chrome/Edge): uses File System Access API (showOpenFilePicker, etc.)
 * - Browser fallback (Firefox/Safari): uses hidden <input type="file"> or Blob download
 *
 * All picker calls must be inside user-gesture handlers (RESEARCH Pitfall 5).
 */

import { isTauri } from '$lib/desktop/isTauri';
import { openFileTauri, saveFileTauri, saveFileAsTauri } from './fileSystemTauri';

export interface OpenFileResult {
	content: string;
	name: string;
	handle: FileSystemFileHandle | string | null;
}

/**
 * Open a file.
 * - Desktop: native OS file picker via Tauri dialog plugin
 * - Browser (Chrome/Edge): showOpenFilePicker
 * - Fallback: hidden <input type="file"> element
 *
 * Must be called directly from a user gesture handler.
 */
export async function openFile(): Promise<OpenFileResult> {
	if (isTauri()) {
		return openFileTauri();
	}

	if (typeof (window as unknown as Record<string, unknown>)['showOpenFilePicker'] === 'function') {
		const [handle] = await (window as unknown as { showOpenFilePicker: (opts?: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
			types: [
				{
					description: 'CALM JSON',
					accept: { 'application/json': ['.json', '.calm.json'] },
				},
			],
		});
		const file = await handle.getFile();
		const content = await file.text();
		return { content, name: file.name, handle };
	}

	// Fallback: hidden <input type="file">
	return new Promise((resolve) => {
		const input = document.createElement('input') as HTMLInputElement;
		input.type = 'file';
		input.accept = '.json,.calm.json';

		input.onchange = () => {
			const file = input.files![0];
			const reader = new FileReader();
			reader.onload = (event) => {
				const content = (event.target as FileReader).result as string;
				resolve({ content, name: file.name, handle: null });
			};
			reader.readAsText(file);
		};

		input.click();
	});
}

/**
 * Save content to a file.
 * - Desktop: write in-place to known path via Tauri fs plugin, or prompt for new path
 * - Browser (handle provided): write in-place via createWritable()
 * - Browser (no handle, Chrome/Edge): prompt via showSaveFilePicker
 * - Fallback: trigger Blob download (Firefox/Safari)
 *
 * Returns the file handle (FSA) or path string (Tauri), or null if Blob download used.
 * Must be called directly from a user gesture handler.
 */
export async function saveFile(
	content: string,
	handle: FileSystemFileHandle | string | null,
	filename: string,
): Promise<FileSystemFileHandle | string | null> {
	if (isTauri()) {
		if (typeof handle === 'string') {
			// In-place save: write to known path
			return saveFileTauri(content, handle);
		}
		// No path known yet — prompt for save location
		return saveFileAsTauri(content, filename);
	}

	// Browser: in-place save via FSA handle
	if (handle && typeof handle !== 'string') {
		const writable = await handle.createWritable();
		await writable.write(content);
		await writable.close();
		return handle;
	}

	if (typeof (window as unknown as Record<string, unknown>)['showSaveFilePicker'] === 'function') {
		const newHandle = await (window as unknown as { showSaveFilePicker: (opts?: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
			suggestedName: filename,
			types: [
				{
					description: 'CALM JSON',
					accept: { 'application/json': ['.json', '.calm.json'] },
				},
			],
		});
		const writable = await newHandle.createWritable();
		await writable.write(content);
		await writable.close();
		return newHandle;
	}

	// Fallback: Blob download
	_blobDownload(content, filename);
	return null;
}

/**
 * Save As — always prompts the user to choose a new location.
 * - Desktop: native save dialog via Tauri dialog plugin
 * - Browser (Chrome/Edge): showSaveFilePicker
 * - Fallback: Blob download
 *
 * Returns the new file handle (FSA) or path string (Tauri), or null.
 * Must be called directly from a user gesture handler.
 */
export async function saveFileAs(
	content: string,
	filename: string,
): Promise<FileSystemFileHandle | string | null> {
	if (isTauri()) {
		return saveFileAsTauri(content, filename);
	}

	if (typeof (window as unknown as Record<string, unknown>)['showSaveFilePicker'] === 'function') {
		const handle = await (window as unknown as { showSaveFilePicker: (opts?: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
			suggestedName: filename,
			types: [
				{
					description: 'CALM JSON',
					accept: { 'application/json': ['.json', '.calm.json'] },
				},
			],
		});
		const writable = await handle.createWritable();
		await writable.write(content);
		await writable.close();
		return handle;
	}

	// Fallback: Blob download
	_blobDownload(content, filename);
	return null;
}

/**
 * Download a data URL (e.g., SVG or PNG) by triggering an anchor click.
 * No URL.createObjectURL needed — data URLs are self-contained.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
	const a = document.createElement('a');
	a.href = dataUrl;
	a.download = filename;
	a.click();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _blobDownload(content: string, filename: string): void {
	const blob = new Blob([content], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
