// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Resolve `details.detailed-architecture` href relative to the current file
 * and classify whether the target lies inside the explorer project root.
 */

export type ReferenceResolveResult =
	| { kind: 'in-project'; relativePath: string }
	| { kind: 'outside-project'; path: string; href: string }
	| { kind: 'external'; url: string };

/** Normalize a POSIX-style path, returning '..' if it escapes above the root. */
export function normalizeProjectRelative(path: string): string {
	const parts = path.split('/').filter((p) => p && p !== '.');
	const result: string[] = [];
	for (const part of parts) {
		if (part === '..') {
			if (result.length === 0) return '..';
			result.pop();
		} else {
			result.push(part);
		}
	}
	return result.join('/');
}

function joinPath(dir: string, href: string): string {
	if (!dir) return href;
	return `${dir}/${href}`;
}

function isExternalHref(href: string): boolean {
	if (/^https?:\/\//i.test(href)) return true;
	if (/^[a-zA-Z]:[\\/]/.test(href)) return true;
	if (href.startsWith('/')) return true;
	return false;
}

/**
 * Resolve a detailed-architecture reference.
 *
 * @param currentFileRelativePath Path of the active file relative to project root.
 * @param href Value of `details.detailed-architecture`.
 */
export function resolveDetailedArchitecture(
	currentFileRelativePath: string | null,
	href: string
): ReferenceResolveResult {
	const trimmed = href.trim();
	if (!trimmed) {
		return { kind: 'outside-project', path: '', href: trimmed };
	}

	if (isExternalHref(trimmed)) {
		return { kind: 'external', url: trimmed };
	}

	let resolved: string;
	if (currentFileRelativePath) {
		const dir = currentFileRelativePath.includes('/')
			? currentFileRelativePath.slice(0, currentFileRelativePath.lastIndexOf('/'))
			: '';
		resolved = normalizeProjectRelative(joinPath(dir, trimmed));
	} else {
		resolved = normalizeProjectRelative(trimmed);
	}

	if (resolved === '..' || resolved.startsWith('../')) {
		return { kind: 'outside-project', path: resolved, href: trimmed };
	}

	return { kind: 'in-project', relativePath: resolved };
}
