// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * recentFiles.ts — Recent files list backed by @tauri-apps/plugin-store.
 *
 * Persists the last 10 opened file paths to the OS-native app data directory
 * (survives app reinstall, unlike localStorage).
 *
 * Key in store: 'recentFiles' (array of absolute path strings).
 */

import { load } from '@tauri-apps/plugin-store';

const STORE_FILE = 'settings.json';
const STORE_KEY = 'recentFiles';
const RECENT_MAX = 10;

/**
 * Add a file path to the front of the recent files list.
 * Deduplicates (removes existing occurrence before prepending) and caps at 10.
 * Returns the updated list.
 */
export async function addRecentFile(path: string): Promise<string[]> {
	const store = await load(STORE_FILE, { autoSave: true, defaults: { [STORE_KEY]: [] } });
	const current: string[] = (await store.get<string[]>(STORE_KEY)) ?? [];
	const updated = [path, ...current.filter((p) => p !== path)].slice(0, RECENT_MAX);
	await store.set(STORE_KEY, updated);
	return updated;
}

/**
 * Get the current recent files list (may be empty).
 */
export async function getRecentFiles(): Promise<string[]> {
	const store = await load(STORE_FILE, { autoSave: true, defaults: { [STORE_KEY]: [] } });
	return (await store.get<string[]>(STORE_KEY)) ?? [];
}

/**
 * Clear all recent files from the list.
 */
export async function clearRecentFiles(): Promise<void> {
	const store = await load(STORE_FILE, { autoSave: true, defaults: { [STORE_KEY]: [] } });
	await store.set(STORE_KEY, []);
}
