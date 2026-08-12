// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmProjectConfig, NamingResolveContext, NamingResolveResult } from './types';
import { createDefaultProjectConfig } from './defaults';
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
 * Prefer patterns from the project `.calmrj`. Fall back to bundled defaults
 * only when the node-type is missing from project config (R26 / #20).
 */
function pickPattern(
	nodeType: string,
	config: CalmProjectConfig
): { dir: string; file: string } | undefined {
	const project = config.naming.patterns[nodeType];
	if (project) return project;
	return createDefaultProjectConfig().naming.patterns[nodeType];
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
 * Infer owning application-component slug from the current diagram path
 * (e.g. `components/prk/prk.appcomp.json` → `prk`).
 */
export function inferComponentIdFromPath(currentDiagramRelativePath?: string | null): string | undefined {
	if (!currentDiagramRelativePath) return undefined;
	const { dir, name } = splitRelativePath(currentDiagramRelativePath);
	const appcomp = name.match(/^(.+)\.appcomp\.json$/i);
	if (appcomp?.[1]) return normalizeSlug(appcomp[1]);
	const parts = dir.split('/').filter(Boolean);
	if (parts.length > 0) return normalizeSlug(parts[parts.length - 1]!);
	return undefined;
}

/**
 * Resolve default folder + filename for Extract (R26).
 *
 * - Single-segment `dir` (e.g. `appserv.{{name}}`): one subfolder under the
 *   current diagram directory (bundled profile style).
 * - Multi-segment `dir` (e.g. `components/{{componentId}}/appservices`): path
 *   is relative to the project root — as written in `.calmrj`.
 *
 * Templates use the element **name** (slugified), not unique-id.
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
	const inferredComponent = inferComponentIdFromPath(currentDiagramRelativePath);
	const componentId = normalizeSlug(ctx.componentId ?? inferredComponent ?? name);
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
	const isProjectRootRelative = pattern.dir.includes('/');

	let folder: string;
	if (isProjectRootRelative) {
		// Honour full path from `.calmrj` (e.g. components/prk/appservices)
		folder = resolvedDir;
	} else {
		// Bundled style: one subfolder under the current diagram
		const subdir = resolvedDir;
		const parentDir = currentDiagramRelativePath
			? splitRelativePath(currentDiagramRelativePath).dir
			: '';
		folder = parentDir ? (subdir ? `${parentDir}/${subdir}` : parentDir) : subdir;
	}

	const fileName = collapseDuplicateSlugInFileName(
		applyTemplate(pattern.file, resolvedCtx),
		name
	);
	const relativePath = folder ? `${folder}/${fileName}` : fileName;
	return { folder, fileName, relativePath, mapped: true };
}
