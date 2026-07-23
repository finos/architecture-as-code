// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmProjectConfig } from './types';
import { createDefaultProjectConfig, isCalmProjectConfig } from './defaults';
import {
	ensureWritePermission,
	findRootCalmrjFiles,
	readProjectRelativeText,
	writeProjectRelativeFile,
} from './projectFs';

let rootHandle = $state<FileSystemDirectoryHandle | null>(null);
let config = $state<CalmProjectConfig | null>(null);
let configFileName = $state<string | null>(null);
let loadError = $state<string | null>(null);
let needsCreate = $state(false);

export function getProjectRootHandle(): FileSystemDirectoryHandle | null {
	return rootHandle;
}

export function getProjectConfig(): CalmProjectConfig | null {
	return config;
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

export function clearProject(): void {
	rootHandle = null;
	config = null;
	configFileName = null;
	loadError = null;
	needsCreate = false;
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
	config = null;
	configFileName = null;

	const files = await findRootCalmrjFiles(handle);
	if (files.length === 0) {
		needsCreate = true;
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
		config = parsed;
		configFileName = name;
		needsCreate = false;
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
	config = next;
	configFileName = safeName;
	needsCreate = false;
	loadError = null;
	return next;
}

export async function saveProjectConfig(
	next: CalmProjectConfig = config ?? createDefaultProjectConfig()
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
	config = next;
}

export function setRulesetEnabled(path: string, enabled: boolean): void {
	if (!config) return;
	const existing = config.validation.rulesets.some((r) => r.path === path);
	const rulesets = existing
		? config.validation.rulesets.map((r) =>
				r.path === path ? { ...r, enabled } : r
			)
		: [...config.validation.rulesets, { path, enabled }];
	config = {
		...config,
		validation: { rulesets },
	};
}
