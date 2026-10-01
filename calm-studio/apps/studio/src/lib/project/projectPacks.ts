// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Overlay project pack JSON onto the bundled registry (R44).
 */

import {
	duplicateTypeIdWarnings,
	getAllPacks,
	registerPackDocuments,
	resetToBundledPacks,
	unregisterPack,
} from '@calmstudio/extensions';
import type { CalmProjectConfig } from '$lib/project/types';
import { readJsonFilesUnderDir, type ProjectJsonScanResult } from '$lib/templates/projectJsonScan';
import {
	ensureReadPermission,
	loadNamedDirectoryHandle,
} from '$lib/explorer/folderPersistence';
import {
	extensionsDirectoryHandleKey,
	isAbsoluteFsPath,
	normalizeExtensionsDir,
} from '$lib/project/pathPickers';

export interface ProjectPackLoadResult {
	loaded: number;
	warnings: string[];
}

function isExtensionPackFile(relativePath: string): boolean {
	return relativePath.replace(/\\/g, '/').toLowerCase().endsWith('.extension.json');
}

function uniqueDirs(dirs: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const dir of dirs) {
		const normalized = normalizeExtensionsDir(dir);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		out.push(normalized);
	}
	return out;
}

/** Project `extensions/` first, then optional `.calmrj` `extensions.dir`. */
export function packScanDirs(extensionsDir: string | undefined): string[] {
	return uniqueDirs(['extensions', extensionsDir ?? '']);
}

function packFilesOf(scanned: ProjectJsonScanResult): ProjectJsonScanResult['files'] {
	return scanned.files.filter((file) => isExtensionPackFile(file.relativePath));
}

async function scanGrantedPackDir(
	handle: FileSystemDirectoryHandle
): Promise<ProjectJsonScanResult> {
	const granted = await ensureReadPermission(handle);
	if (!granted) {
		return { files: [], warnings: [] };
	}
	return readJsonFilesUnderDir(handle, '');
}

/**
 * Restore bundled packs, then merge `*.extension.json` from the project folder.
 * Same pack `id` overwrites. Invalid files are skipped with a warning.
 *
 * `extensions.dir` may be project-relative or an absolute path outside the open
 * folder. Outside folders need a previously granted File System Access handle
 * (Project settings → Browse).
 */
export async function applyProjectPacks(
	root: FileSystemDirectoryHandle | null,
	config: CalmProjectConfig | null,
	extraDirectories: ReadonlyMap<string, FileSystemDirectoryHandle> = new Map()
): Promise<ProjectPackLoadResult> {
	resetToBundledPacks();
	disableBundledPacks(config);
	if (!root) {
		return { loaded: 0, warnings: [] };
	}

	const warnings: string[] = [];
	let loaded = 0;

	for (const dir of packScanDirs(config?.extensions?.dir)) {
		try {
			let scanned: ProjectJsonScanResult = { files: [], warnings: [] };
			if (!isAbsoluteFsPath(dir)) {
				scanned = await readJsonFilesUnderDir(root, dir);
				warnings.push(...scanned.warnings);
			}

			let packFiles = packFilesOf(scanned);
			if (packFiles.length === 0) {
				const granted =
					extraDirectories.get(dir) ??
					(await loadNamedDirectoryHandle(extensionsDirectoryHandleKey(dir)));
				if (granted) {
					const extraScan = await scanGrantedPackDir(granted);
					warnings.push(...extraScan.warnings);
					packFiles = packFilesOf(extraScan);
				}
			}

			if (packFiles.length === 0) {
				if (dir !== 'extensions') {
					warnings.push(
						isAbsoluteFsPath(dir)
							? `Extension pack folder "${dir}" is outside the project. Use Browse in Project settings to grant access.`
							: `Extension pack folder "${dir}" could not be scanned or contains no *.extension.json`
					);
				}
				continue;
			}

			const result = registerPackDocuments(
				packFiles.map((file) => ({ source: file.relativePath, value: file.value }))
			);
			loaded += result.registered;
			warnings.push(...result.warnings);
		} catch {
			if (dir !== 'extensions') {
				warnings.push(`Extension pack folder "${dir}" could not be scanned`);
			}
		}
	}

	warnings.push(...duplicateTypeIdWarnings(getAllPacks()));
	return { loaded, warnings };
}

/** Hide bundled packs listed in `extensions.disabled` before loading extra dirs (R68). */
function disableBundledPacks(config: CalmProjectConfig | null): void {
	for (const id of config?.extensions?.disabled ?? []) {
		const trimmed = id.trim();
		if (trimmed) unregisterPack(trimmed);
	}
}
