// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * titleBar.ts — Native window title management for Tauri desktop.
 *
 * Updates the OS window title to reflect the current file and dirty state:
 *   "CalmStudio \u2014 filename.calm.json"        (clean)
 *   "CalmStudio \u2014 filename.calm.json \u2022"  (dirty, bullet indicator)
 *   "CalmStudio \u2014 Untitled"                   (no file open)
 *
 * Called from a $effect in +page.svelte that watches getFileName() and getIsDirty().
 * Only called when isTauri() is true — no-op guard is the caller's responsibility.
 */

import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Update the native OS window title to reflect current file and dirty state.
 * @param filename - Current filename, or null if no file is open
 * @param isDirty  - Whether the diagram has unsaved changes
 */
export async function updateWindowTitle(filename: string | null, isDirty: boolean): Promise<void> {
	const base = filename ?? 'Untitled';
	const dirty = isDirty ? ' \u2022' : '';
	await getCurrentWindow().setTitle(`CalmStudio \u2014 ${base}${dirty}`);
}
