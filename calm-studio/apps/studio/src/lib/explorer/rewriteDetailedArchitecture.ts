// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Rewrite relative `details.detailed-architecture` after a folder move (R60 / #61).
 */

export function isHttpHref(href: string): boolean {
	return /^https?:\/\//i.test(href.trim());
}

export function fileDir(relativePath: string): string {
	const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
	const idx = normalized.lastIndexOf('/');
	return idx < 0 ? '' : normalized.slice(0, idx);
}

export function joinProjectPath(dir: string, name: string): string {
	if (!dir) return name;
	if (!name) return dir;
	return `${dir.replace(/\/+$/, '')}/${name.replace(/^\/+/, '')}`;
}

export function posixRelative(fromDir: string, toPath: string): string {
	const fromParts = fromDir ? fromDir.split('/').filter(Boolean) : [];
	const toParts = toPath.split('/').filter(Boolean);
	let i = 0;
	while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
		i += 1;
	}
	const ups = fromParts.length - i;
	const down = toParts.slice(i);
	const parts = [...Array.from({ length: ups }, () => '..'), ...down];
	return parts.join('/') || '.';
}

export function mapMovedPath(path: string, sourcePrefix: string, destPrefix: string): string {
	if (path === sourcePrefix) return destPrefix;
	if (sourcePrefix && path.startsWith(`${sourcePrefix}/`)) {
		return `${destPrefix}${path.slice(sourcePrefix.length)}`;
	}
	return path;
}

export function isNestedUnder(parent: string, child: string): boolean {
	return child === parent || (parent.length > 0 && child.startsWith(`${parent}/`));
}

function normalizeRelative(fromFile: string, href: string): string | null {
	const trimmed = href.trim();
	if (!trimmed || isHttpHref(trimmed) || trimmed.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(trimmed)) {
		return null;
	}
	const joined = joinProjectPath(fileDir(fromFile), trimmed);
	const parts = joined.split('/').filter((p) => p && p !== '.');
	const result: string[] = [];
	for (const part of parts) {
		if (part === '..') {
			if (result.length === 0) return null;
			result.pop();
		} else {
			result.push(part);
		}
	}
	return result.join('/');
}

export function rewriteDetailedArchitectureHref(
	href: string,
	fromFileOld: string,
	fromFileNew: string,
	sourcePrefix: string,
	destPrefix: string
): string {
	const trimmed = href.trim();
	if (!trimmed || isHttpHref(trimmed)) return trimmed;
	const targetOld = normalizeRelative(fromFileOld, trimmed);
	if (!targetOld) return trimmed;
	const targetNew = mapMovedPath(targetOld, sourcePrefix, destPrefix);
	return posixRelative(fileDir(fromFileNew), targetNew);
}

function rewriteNodeDetails(
	node: Record<string, unknown>,
	fromFileOld: string,
	fromFileNew: string,
	sourcePrefix: string,
	destPrefix: string
): boolean {
	const details = node.details;
	if (!details || typeof details !== 'object' || Array.isArray(details)) return false;
	const rec = details as Record<string, unknown>;
	const href = rec['detailed-architecture'];
	if (typeof href !== 'string') return false;
	const next = rewriteDetailedArchitectureHref(
		href,
		fromFileOld,
		fromFileNew,
		sourcePrefix,
		destPrefix
	);
	if (next === href) return false;
	rec['detailed-architecture'] = next;
	return true;
}

export function rewriteArchitectureDocument(
	doc: unknown,
	fromFileOld: string,
	fromFileNew: string,
	sourcePrefix: string,
	destPrefix: string
): { next: unknown; changed: boolean } {
	if (!doc || typeof doc !== 'object') return { next: doc, changed: false };
	const clone = structuredClone(doc) as Record<string, unknown>;
	const nodes = clone.nodes;
	let changed = false;
	if (Array.isArray(nodes)) {
		for (const node of nodes) {
			if (node && typeof node === 'object') {
				if (
					rewriteNodeDetails(
						node as Record<string, unknown>,
						fromFileOld,
						fromFileNew,
						sourcePrefix,
						destPrefix
					)
				) {
					changed = true;
				}
			}
		}
	}
	return { next: clone, changed };
}

export interface FolderMoveRewriteFile {
	oldPath: string;
	json: unknown;
}

export interface FolderMoveRewritePlan {
	oldPath: string;
	newPath: string;
	json: unknown;
	text: string;
	changed: boolean;
}

export function retargetOpenDocumentAfterMove(
	relativePath: string,
	json: unknown,
	mapping: Record<string, string>,
	sourcePrefix: string,
	destPrefix: string
): { relativePath: string; json: unknown; changed: boolean } {
	const newPath = mapping[relativePath] ?? relativePath;
	const { next, changed } = rewriteArchitectureDocument(
		json,
		relativePath,
		newPath,
		sourcePrefix,
		destPrefix
	);
	return { relativePath: newPath, json: next, changed: changed || newPath !== relativePath };
}

export function planFolderMoveRewrites(
	files: FolderMoveRewriteFile[],
	sourcePrefix: string,
	destPrefix: string
): FolderMoveRewritePlan[] {
	return files.map((file) => {
		const newPath = mapMovedPath(file.oldPath, sourcePrefix, destPrefix);
		const { next, changed } = rewriteArchitectureDocument(
			file.json,
			file.oldPath,
			newPath,
			sourcePrefix,
			destPrefix
		);
		return {
			oldPath: file.oldPath,
			newPath,
			json: next,
			text: JSON.stringify(next, null, 2) + '\n',
			changed: changed || newPath !== file.oldPath,
		};
	});
}
