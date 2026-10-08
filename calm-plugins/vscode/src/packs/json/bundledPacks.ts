// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Bundled copy of repo-root `extensions/packs/*.extension.json` for the webview
 * until the extension host posts filesystem packs.
 */
const bundledModules = import.meta.glob(
	'../../../../../extensions/packs/*.extension.json',
	{ eager: true, import: 'default' }
);

export function loadBundledPackDocuments(): unknown[] {
	return Object.values(bundledModules);
}
