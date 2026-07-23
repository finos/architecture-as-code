// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmProjectConfig, NamingResolveContext, NamingResolveResult } from './types';
import { CENGINEERING_ARCHIMATE_PROFILE, createDefaultProjectConfig } from './defaults';
import { splitRelativePath } from './projectFs';

function applyTemplate(template: string, ctx: NamingResolveContext): string {
	const name = ctx.name;
	return template
		.replaceAll('{{name}}', name)
		.replaceAll('{{id}}', name) // legacy alias — prefer {{name}}
		.replaceAll('{{componentId}}', ctx.componentId ?? name)
		.replaceAll('{{serviceId}}', ctx.serviceId ?? name);
}

/** Slugify display name for folder/file segments (kebab-case). */
export function normalizeSlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'unnamed';
}

/**
 * Legacy .calmrj patterns used repo-root paths with `/` and
 * `{{componentId}}.{{id}}` filenames (duplicating the slug). Prefer bundled
 * stereotype.subdir patterns for the cengineering-archimate profile.
 */
function isLegacyAbsolutePattern(dir: string, file: string): boolean {
	if (dir.includes('/')) return true;
	// e.g. {{componentId}}.{{id}}.appserv.json → duplicated slug after resolve
	if (/\{\{\s*componentId\s*\}\}\s*\.\s*\{\{\s*(id|name)\s*\}\}/i.test(file)) return true;
	if (/\{\{\s*(id|name)\s*\}\}\s*\.\s*\{\{\s*(id|name)\s*\}\}/i.test(file)) return true;
	return false;
}

function pickPattern(
	nodeType: string,
	config: CalmProjectConfig
): { dir: string; file: string } | undefined {
	const bundled = createDefaultProjectConfig().naming.patterns;
	const project = config.naming.patterns[nodeType];
	const fallback = bundled[nodeType];

	if (config.naming.profile === CENGINEERING_ARCHIMATE_PROFILE) {
		if (!project) return fallback;
		if (fallback && isLegacyAbsolutePattern(project.dir, project.file)) {
			return fallback;
		}
		return project;
	}

	return project ?? fallback;
}

/** Collapse `slug.slug.rest` → `slug.rest` (legacy componentId+id templates). */
export function collapseDuplicateSlugInFileName(fileName: string, slug: string): string {
	if (!slug) return fileName;
	const prefix = `${slug}.${slug}.`;
	if (fileName.startsWith(prefix)) {
		return `${slug}.${fileName.slice(prefix.length)}`;
	}
	return fileName;
}

/**
 * Resolve default folder + filename for Extract (R26).
 *
 * Folder = directory of the current diagram + **one** subfolder from the pattern
 * (e.g. `appserv.test-service`). Templates use the element **name** (slugified), not unique-id.
 * Unmapped types return empty paths with a warning — Extract is not blocked.
 */
export function resolveExtractPath(
	nodeType: string,
	ctx: NamingResolveContext,
	config: CalmProjectConfig | null,
	currentDiagramRelativePath?: string | null
): NamingResolveResult {
	const effective = config ?? createDefaultProjectConfig();
	const pattern = pickPattern(nodeType, effective);

	const name = normalizeSlug(ctx.name || ctx.id || 'unnamed');
	const componentId = normalizeSlug(ctx.componentId ?? name);
	const serviceId = normalizeSlug(ctx.serviceId ?? name);
	const resolvedCtx: NamingResolveContext = { name, id: name, componentId, serviceId };

	if (!pattern) {
		return {
			folder: '',
			fileName: '',
			relativePath: '',
			mapped: false,
			warning: `No naming pattern for node-type "${nodeType}". Enter folder and file manually.`,
		};
	}

	const resolvedDir = applyTemplate(pattern.dir, resolvedCtx).replace(/^\/+|\/+$/g, '');
	const segments = resolvedDir.split('/').filter(Boolean);
	// One subfolder under the current diagram — use the leaf segment
	// (legacy templates had application-components/.../appserv.x).
	const subdir = segments.length > 0 ? segments[segments.length - 1]! : '';

	const parentDir = currentDiagramRelativePath
		? splitRelativePath(currentDiagramRelativePath).dir
		: '';
	const folder = parentDir ? (subdir ? `${parentDir}/${subdir}` : parentDir) : subdir;
	const fileName = collapseDuplicateSlugInFileName(
		applyTemplate(pattern.file, resolvedCtx),
		name
	);
	const relativePath = folder ? `${folder}/${fileName}` : fileName;
	return { folder, fileName, relativePath, mapped: true };
}
