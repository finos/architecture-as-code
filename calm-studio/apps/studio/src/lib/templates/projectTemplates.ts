// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Load CALM templates from a project folder listed in `.calmrj` (R33).
 */

import { scanDirectoryTree } from '$lib/explorer/folderScan';
import { isPathUnderSearchRoots, listJsonFiles } from '$lib/neighbors/findNeighbors';
import type { CalmProjectConfig } from '$lib/project/types';
import {
	parseCalmTemplate,
	registerTemplate,
	resetToBundledTemplates,
} from './registry';

export interface ProjectTemplateLoadResult {
	loaded: number;
	warnings: string[];
}

/**
 * Restore bundled templates, then merge project JSON from `templates.dir`.
 * Same `_template.id` overwrites a bundled entry. Invalid files are skipped.
 */
export async function applyProjectTemplates(
	root: FileSystemDirectoryHandle | null,
	config: CalmProjectConfig | null
): Promise<ProjectTemplateLoadResult> {
	resetToBundledTemplates();
	const dir = config?.templates?.dir?.trim();
	if (!root || !dir) {
		return { loaded: 0, warnings: [] };
	}

	const warnings: string[] = [];
	let loaded = 0;

	try {
		const tree = await scanDirectoryTree(root);
		const files = listJsonFiles(tree).filter((f) =>
			isPathUnderSearchRoots(f.relativePath, [dir])
		);

		for (const file of files) {
			try {
				const text = await (await file.handle.getFile()).text();
				let parsed: unknown;
				try {
					parsed = JSON.parse(text);
				} catch {
					warnings.push(`Skipped ${file.relativePath}: invalid JSON`);
					continue;
				}
				const template = parseCalmTemplate(parsed);
				if (!template) {
					warnings.push(
						`Skipped ${file.relativePath}: not a template (need _template.id, name, category)`
					);
					continue;
				}
				registerTemplate(template);
				loaded += 1;
			} catch {
				warnings.push(`Skipped ${file.relativePath}: unreadable`);
			}
		}
	} catch {
		warnings.push(`Template folder "${dir}" could not be scanned`);
	}

	return { loaded, warnings };
}
