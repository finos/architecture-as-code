// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Bundled copy of repo-root `extensions/packs/*.extension.json`.
 * Vite inlines these at build time (browser / vitest). File System Access
 * overlay happens in the Studio app after Open folder.
 */
const bundledModules = import.meta.glob(
	'../../../../../extensions/packs/*.extension.json',
	{ eager: true, import: 'default' }
);

export function loadBundledPackDocuments(): unknown[] {
	return Object.values(bundledModules);
}
