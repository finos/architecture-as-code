// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * isTauri.ts — Desktop mode detection.
 *
 * Returns true when running inside a Tauri webview. The presence of
 * `window.__TAURI_INTERNALS__` is the official Tauri 2 detection sentinel.
 *
 * Use this guard before calling any @tauri-apps/* APIs to ensure the web
 * browser build continues to work without Tauri installed.
 */
export function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
