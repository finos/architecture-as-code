// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * fileOpen.ts — Handle file-open events from the OS (double-click, single-instance).
 *
 * Two mechanisms are wired here:
 *
 * 1. Single-instance event (Windows/Linux warm-start):
 *    When a second instance is launched with a file path as argv[1], the Rust
 *    single-instance plugin emits 'open-file' on the existing instance. We listen
 *    for that event using @tauri-apps/api/event listen().
 *
 * 2. Deep-link getCurrent() (macOS cold-start):
 *    On macOS, when the app is launched fresh from Finder (double-click on .calm.json),
 *    there is no existing instance for the single-instance plugin to forward to. Instead,
 *    the deep-link plugin captures the file URL. We call getCurrent() once at startup
 *    to check for a launch URL and extract the file path (see RESEARCH Pitfall 4).
 *
 * Returns an unlisten function that cleans up only the event listener
 * (getCurrent is a one-shot call, not a subscription).
 */

import { listen } from '@tauri-apps/api/event';
import { getCurrent } from '@tauri-apps/plugin-deep-link';

/**
 * Register file-open handlers for single-instance (Windows/Linux) and
 * deep-link (macOS cold-start).
 *
 * @param onFile - Called with the absolute path of the file to open.
 * @returns Unlisten function — call from onMount cleanup.
 */
export function registerFileOpenHandler(onFile: (path: string) => void): () => void {
	let unlisten: (() => void) | null = null;

	// 1. Single-instance event listener (Windows/Linux warm-start)
	listen<string>('open-file', (event) => {
		const path = event.payload;
		if (path && (path.endsWith('.calm.json') || path.endsWith('.json'))) {
			onFile(path);
		}
	})
		.then((fn) => {
			unlisten = fn;
		})
		.catch((e) => {
			console.warn('[FileOpen] Failed to register open-file event listener:', e);
		});

	// 2. macOS cold-start: check if app was launched with a file URL via deep-link
	// getCurrent() is async but one-shot — no cleanup needed.
	getCurrent()
		.then((urls) => {
			if (!urls || urls.length === 0) return;

			// Deep-link URLs for file associations come as 'file:///path/to/file.calm.json'
			const fileUrl = urls[0];
			let filePath: string;

			if (fileUrl.startsWith('file://')) {
				// Decode percent-encoding and strip the 'file://' scheme
				filePath = decodeURIComponent(fileUrl.replace(/^file:\/\//, ''));
			} else {
				// Some platforms may pass the raw path directly
				filePath = fileUrl;
			}

			if (filePath && (filePath.endsWith('.calm.json') || filePath.endsWith('.json'))) {
				onFile(filePath);
			}
		})
		.catch((e) => {
			// getCurrent() may throw if the deep-link plugin has no pending URL — that is normal
			console.debug('[FileOpen] getCurrent() returned no URL (expected on normal launch):', e);
		});

	return () => {
		unlisten?.();
	};
}
