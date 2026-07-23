// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * dragDrop.ts — File drag-and-drop handler for Tauri desktop.
 *
 * Registers a listener on the current Tauri webview for drag-drop events.
 * When a .json or .calm.json file is dropped, calls the provided callback
 * with the file path.
 *
 * Includes a 50ms debounce to guard against the Tauri 2.8.4 event duplication
 * bug where drop events may fire twice (see RESEARCH Open Question #3).
 *
 * Returns an unlisten function for cleanup in onMount teardown.
 */

import { getCurrentWebview } from '@tauri-apps/api/webview';

/**
 * Register a drag-and-drop listener on the current Tauri webview.
 *
 * @param onFile - Called with the absolute path of the dropped file.
 * @returns Unlisten function — call from onMount cleanup.
 */
export function registerFileDrop(onFile: (path: string) => void): () => void {
	let unlisten: (() => void) | null = null;
	let lastPath: string | null = null;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	getCurrentWebview()
		.onDragDropEvent((event) => {
			if (event.payload.type !== 'drop') return;

			const paths = event.payload.paths;
			const calmPath = paths.find(
				(p) => p.endsWith('.calm.json') || p.endsWith('.json')
			);
			if (!calmPath) return;

			// 50ms debounce: discard duplicate events for the same path within the window
			if (calmPath === lastPath && debounceTimer !== null) return;

			lastPath = calmPath;
			if (debounceTimer !== null) clearTimeout(debounceTimer);

			debounceTimer = setTimeout(() => {
				lastPath = null;
				debounceTimer = null;
			}, 50);

			onFile(calmPath);
		})
		.then((fn) => {
			unlisten = fn;
		})
		.catch((e) => {
			console.warn('[DragDrop] Failed to register drag-drop handler:', e);
		});

	return () => {
		unlisten?.();
		if (debounceTimer !== null) clearTimeout(debounceTimer);
	};
}
