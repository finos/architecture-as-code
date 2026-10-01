// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmProjectConfig } from '$lib/project/types';
import { normalizeSlug } from '$lib/project/naming';

export function validateFolderName(name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed) return 'Name is required';
	if (trimmed === '.' || trimmed === '..') return 'Invalid folder name';
	if (/[\\/]/.test(trimmed)) return 'Folder name cannot contain path separators';
	return null;
}

export function validateFileName(name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed) return 'Name is required';
	if (trimmed === '.' || trimmed === '..') return 'Invalid file name';
	if (/[\\/]/.test(trimmed)) return 'File name cannot contain path separators';
	return null;
}

/** Append `.json` when the user omitted an extension (R72). */
export function normalizeNewFileName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return '';
	return /\.json$/i.test(trimmed) ? trimmed : `${trimmed}.json`;
}

export function joinProjectRelative(parentDir: string, name: string): string {
	return parentDir ? `${parentDir}/${name}` : name;
}

/**
 * Default new-folder name from naming.rootDirs / naming.patterns (R59).
 * If the template contains `{{name}}`, substitute `promptName` (or `new-folder`).
 */
export function defaultNewFolderName(
	config: CalmProjectConfig | null,
	promptName = 'new-folder'
): string {
	const slug = normalizeSlug(promptName);
	const rootDir = Object.values(config?.naming.rootDirs ?? {}).find((v) => v.trim());
	if (rootDir) {
		const first = rootDir.split('/')[0] ?? rootDir;
		return applyNameToken(first, slug);
	}
	const pattern = Object.values(config?.naming.patterns ?? {}).find((p) => p.dir.trim());
	if (pattern) {
		const first = pattern.dir.split('/')[0] ?? pattern.dir;
		return applyNameToken(first, slug);
	}
	return slug;
}

function applyNameToken(template: string, slug: string): string {
	if (!template.includes('{{')) return template.replace(/[\\/]/g, '-');
	return template
		.replaceAll('{{name}}', slug)
		.replaceAll('{{id}}', slug)
		.replaceAll('{{componentId}}', slug)
		.replaceAll('{{serviceId}}', slug)
		.replace(/[\\/]/g, '-');
}

export function selectedDirectoryPath(selectedPath: string | null | undefined): string {
	if (!selectedPath) return '';
	if (selectedPath.toLowerCase().endsWith('.json')) {
		const idx = selectedPath.lastIndexOf('/');
		return idx < 0 ? '' : selectedPath.slice(0, idx);
	}
	return selectedPath;
}
