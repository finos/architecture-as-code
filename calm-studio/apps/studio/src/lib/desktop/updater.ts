// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * updater.ts — Auto-update check on app launch.
 *
 * Silently checks for a new version on startup. If an update is available,
 * prompts the user with a confirm() dialog. If accepted, downloads, installs,
 * and relaunches the app.
 *
 * The entire function is wrapped in try/catch — update failures must never
 * crash or block the app. Errors are logged to console.
 */

import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Check for app updates and optionally install them.
 * Call fire-and-forget from onMount — never await in startup path.
 */
export async function checkForUpdates(): Promise<void> {
	try {
		const update = await check();
		if (!update) return;

		const confirmed = window.confirm(
			`CalmStudio ${update.version} is available.\n\nDownload and install now?`
		);
		if (!confirmed) return;

		await update.downloadAndInstall();
		await relaunch();
	} catch (e) {
		// Update failures are non-critical — log and continue
		console.warn('[Updater] Update check failed:', e);
	}
}
