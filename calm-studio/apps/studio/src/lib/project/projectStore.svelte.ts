// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmProjectConfig } from './types';
import { createDefaultProjectConfig, isCalmProjectConfig } from './defaults';
import { overlayProjectConfig } from './configOverlay';
import { loadUserDefaultsConfig } from './userDefaults';
import { normalizeHubUrl } from '$lib/hub/hubUrl';
import {
	ensureWritePermission,
	findRootCalmrjFiles,
	readProjectRelativeText,
	writeProjectRelativeFile,
} from './projectFs';
import { applyProjectTemplates } from '$lib/templates/projectTemplates';
import { applyProjectPatterns } from '$lib/templates/projectPatterns';
import { applyProjectPacks } from './projectPacks';
import { loadUrlMappingFromProject } from './urlMappingLoad';
import { resetToBundledPacks } from '@calmstudio/extensions';

let rootHandle = $state<FileSystemDirectoryHandle | null>(null);
let projectFileConfig = $state<CalmProjectConfig | null>(null);
let userConfig = $state<CalmProjectConfig | null>(null);
let config = $state<CalmProjectConfig | null>(null);
let configFileName = $state<string | null>(null);
let loadError = $state<string | null>(null);
let needsCreate = $state(false);
let templateWarnings = $state<string[]>([]);

async function refreshDerivedProjectAssets(
	handle: FileSystemDirectoryHandle | null,
	cfg: CalmProjectConfig | null
): Promise<void> {
	const templates = await applyProjectTemplates(handle, cfg);
	const patterns = await applyProjectPatterns(handle, cfg);
	const packs = await applyProjectPacks(handle, cfg);
	const mapping = await loadUrlMappingFromProject(handle, cfg?.urlMapping?.path);
	templateWarnings = [
		...templates.warnings,
		...patterns.warnings,
		...packs.warnings,
		...mapping.warnings,
	];
}

export function getProjectRootHandle(): FileSystemDirectoryHandle | null {
	return rootHandle;
}

function refreshMergedConfig(): void {
	if (!projectFileConfig) {
		config = userConfig;
		return;
	}
	config = overlayProjectConfig(userConfig, projectFileConfig);
}

export function getProjectConfig(): CalmProjectConfig | null {
	return config;
}

export function getProjectFileConfig(): CalmProjectConfig | null {
	return projectFileConfig;
}

export function getUserConfig(): CalmProjectConfig | null {
	return userConfig;
}

export async function applyUserConfig(next: CalmProjectConfig | null): Promise<void> {
	userConfig = next;
	refreshMergedConfig();
	if (rootHandle) {
		await refreshDerivedProjectAssets(rootHandle, config);
	}
}

export function getProjectConfigFileName(): string | null {
	return configFileName;
}

export function getProjectLoadError(): string | null {
	return loadError;
}

export function projectNeedsCreate(): boolean {
	return needsCreate;
}

export function getTemplateLoadWarnings(): string[] {
	return templateWarnings;
}

export function clearProject(): void {
	rootHandle = null;
	projectFileConfig = null;
	userConfig = null;
	config = null;
	configFileName = null;
	loadError = null;
	needsCreate = false;
	templateWarnings = [];
	resetToBundledPacks();
	void refreshDerivedProjectAssets(null, null);
}

function setProjectFile(next: CalmProjectConfig | null): void {
	projectFileConfig = next;
	refreshMergedConfig();
}

/**
 * After Open folder / restore — detect *.calmrj (R24 / #22).
 */
export async function loadProjectFromRoot(
	handle: FileSystemDirectoryHandle
): Promise<'loaded' | 'missing' | 'multiple' | 'invalid'> {
	rootHandle = handle;
	loadError = null;
	needsCreate = false;
	projectFileConfig = null;
	config = null;
	configFileName = null;
	templateWarnings = [];
	userConfig = await loadUserDefaultsConfig();

	const files = await findRootCalmrjFiles(handle);
	if (files.length === 0) {
		needsCreate = true;
		refreshMergedConfig();
		await refreshDerivedProjectAssets(handle, config);
		return 'missing';
	}
	if (files.length > 1) {
		loadError = `Multiple .calmrj files in project root (${files.join(', ')}). Keep only one.`;
		return 'multiple';
	}

	const name = files[0]!;
	try {
		const text = await readProjectRelativeText(handle, name);
		const parsed: unknown = JSON.parse(text);
		if (!isCalmProjectConfig(parsed)) {
			loadError = `Invalid project file: ${name}`;
			return 'invalid';
		}
		configFileName = name;
		needsCreate = false;
		setProjectFile(parsed);
		await refreshDerivedProjectAssets(handle, config);
		return 'loaded';
	} catch (e) {
		loadError = (e as Error).message;
		return 'invalid';
	}
}

export async function createProjectFile(
	handle: FileSystemDirectoryHandle,
	projectName: string,
	fileName = 'project.calmrj'
): Promise<CalmProjectConfig> {
	const ok = await ensureWritePermission(handle);
	if (!ok) {
		throw new Error('Write permission required to create project file');
	}
	const safeName = fileName.toLowerCase().endsWith('.calmrj')
		? fileName
		: `${fileName}.calmrj`;
	const next = createDefaultProjectConfig(projectName.trim() || 'project');
	await writeProjectRelativeFile(handle, safeName, JSON.stringify(next, null, 2) + '\n');
	rootHandle = handle;
	configFileName = safeName;
	needsCreate = false;
	loadError = null;
	setProjectFile(next);
	await refreshDerivedProjectAssets(handle, config);
	return next;
}

export async function saveProjectConfig(
	next: CalmProjectConfig = projectFileConfig ?? createDefaultProjectConfig()
): Promise<void> {
	if (!rootHandle || !configFileName) {
		throw new Error('No project file open');
	}
	const ok = await ensureWritePermission(rootHandle);
	if (!ok) {
		throw new Error('Write permission required to save project file');
	}
	await writeProjectRelativeFile(
		rootHandle,
		configFileName,
		JSON.stringify(next, null, 2) + '\n'
	);
	setProjectFile(next);
	await refreshDerivedProjectAssets(rootHandle, config);
}

export function setRulesetEnabled(path: string, enabled: boolean): void {
	if (!projectFileConfig) return;
	const existing = projectFileConfig.validation.rulesets.some((r) => r.path === path);
	const rulesets = existing
		? projectFileConfig.validation.rulesets.map((r) =>
				r.path === path ? { ...r, enabled } : r
			)
		: [...projectFileConfig.validation.rulesets, { path, enabled }];
	setProjectFile({
		...projectFileConfig,
		validation: { rulesets },
	});
}

/** Normalize and set Find-neighbors search roots (project-relative folders). */
export function setNeighborSearchRoots(roots: string[]): void {
	if (!projectFileConfig) return;
	const searchRoots = [
		...new Set(
			roots
				.map((r) => r.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim())
				.filter(Boolean)
		),
	];
	setProjectFile({
		...projectFileConfig,
		neighbors: {
			...(projectFileConfig.neighbors ?? { searchRoots: [] }),
			searchRoots,
		},
	});
}

export function getNeighborSearchRoots(): string[] {
	return config?.neighbors?.searchRoots ?? [];
}

/** Set project-relative templates folder (R33). Empty string removes the key. */
export function setTemplatesDir(dir: string): void {
	if (!projectFileConfig) return;
	const trimmed = dir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
	if (!trimmed) {
		const { templates: _omit, ...rest } = projectFileConfig;
		setProjectFile(rest);
		return;
	}
	setProjectFile({
		...projectFileConfig,
		templates: { dir: trimmed },
	});
}

/** Set project-relative patterns folder (R41). Empty string removes the key. */
export function setPatternsDir(dir: string): void {
	if (!projectFileConfig) return;
	const trimmed = dir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
	if (!trimmed) {
		const { patterns: _omit, ...rest } = projectFileConfig;
		setProjectFile(rest);
		return;
	}
	setProjectFile({
		...projectFileConfig,
		patterns: { dir: trimmed },
	});
}

/** Set extra pack folder (R44). Empty string removes dir but keeps disabled. */
export function setExtensionsDir(dir: string): void {
	if (!projectFileConfig) return;
	const trimmed = dir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
	const disabled = projectFileConfig.extensions?.disabled;
	if (!trimmed) {
		if (disabled?.length) {
			setProjectFile({ ...projectFileConfig, extensions: { disabled } });
			return;
		}
		const { extensions: _omit, ...rest } = projectFileConfig;
		setProjectFile(rest);
		return;
	}
	setProjectFile({
		...projectFileConfig,
		extensions: { ...projectFileConfig.extensions, dir: trimmed },
	});
}

export function setExtensionsDisabled(ids: string[]): void {
	if (!projectFileConfig) return;
	const disabled = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
	const dir = projectFileConfig.extensions?.dir;
	if (!disabled.length && !dir) {
		const { extensions: _omit, ...rest } = projectFileConfig;
		setProjectFile(rest);
		return;
	}
	setProjectFile({
		...projectFileConfig,
		extensions: { ...projectFileConfig.extensions, ...(dir ? { dir } : {}), disabled },
	});
}

/** Set project-relative url-mapping.json path (R75). Empty string removes the key. */
export function setUrlMappingPath(path: string): void {
	if (!projectFileConfig) return;
	const trimmed = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
	if (!trimmed) {
		const { urlMapping: _omit, ...rest } = projectFileConfig;
		setProjectFile(rest);
		return;
	}
	setProjectFile({
		...projectFileConfig,
		urlMapping: { path: trimmed },
	});
}

/** Set CALM Hub URL (R53). Empty string removes the key. Origin only — no `/api`. */
export function setHubUrl(url: string): void {
	if (!projectFileConfig) return;
	const origin = normalizeHubUrl(url);
	if (!origin) {
		const { hub: _omit, ...rest } = projectFileConfig;
		setProjectFile(rest);
		return;
	}
	setProjectFile({
		...projectFileConfig,
		hub: { url: origin },
	});
}

export function setNamingConfig(naming: CalmProjectConfig['naming']): void {
	if (!projectFileConfig) return;
	setProjectFile({ ...projectFileConfig, naming });
}

export function setPatternsConfig(patterns: CalmProjectConfig['patterns'] | undefined): void {
	if (!projectFileConfig) return;
	if (!patterns || !patterns.dir.trim()) {
		const { patterns: _omit, ...rest } = projectFileConfig;
		setProjectFile(rest);
		return;
	}
	setProjectFile({ ...projectFileConfig, patterns: { ...patterns, dir: patterns.dir.trim() } });
}
