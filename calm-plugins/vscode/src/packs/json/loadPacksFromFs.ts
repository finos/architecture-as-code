// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PackDefinition } from '../types.js';
import { duplicateTypeIdWarnings, parsePackJson } from './parsePack.js';

export interface PackLoadWarning {
	file: string;
	message: string;
}

export interface PackLoadResult {
	packs: PackDefinition[];
	warnings: PackLoadWarning[];
}

function collectExtensionJsonFiles(dir: string, acc: string[]): void {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			collectExtensionJsonFiles(full, acc);
			continue;
		}
		if (entry.isFile() && entry.name.toLowerCase().endsWith('.extension.json')) {
			acc.push(full);
		}
	}
}

/**
 * Read `*.extension.json` from each directory (recursive). Missing dirs are skipped.
 * Later directories overwrite the same pack `id`.
 */
export function loadPacksFromDirectories(dirs: string[]): PackLoadResult {
	const byId = new Map<string, PackDefinition>();
	const warnings: PackLoadWarning[] = [];

	for (const dir of dirs) {
		if (!dir.trim() || !existsSync(dir)) continue;
		const files: string[] = [];
		collectExtensionJsonFiles(dir, files);
		for (const file of files) {
			let parsedJson: unknown;
			try {
				parsedJson = JSON.parse(readFileSync(file, 'utf8'));
			} catch (e) {
				warnings.push({ file, message: (e as Error).message });
				continue;
			}
			const parsed = parsePackJson(parsedJson);
			if (!parsed.ok) {
				warnings.push({ file, message: parsed.errors.join('; ') });
				continue;
			}
			byId.set(parsed.pack.id, parsed.pack);
		}
	}

	const packs = [...byId.values()];
	for (const message of duplicateTypeIdWarnings(packs)) {
		warnings.push({ file: '', message });
	}
	return { packs, warnings };
}

/** Default scan roots: VSIX fallback, then workspace `extensions/`, extra folders. */
export function orderedPackDirectories(options: {
	fallbackDir?: string;
	workspaceFolders: string[];
	externalAssetsPath?: string;
	extraFolders: string[];
}): string[] {
	const dirs: string[] = [];
	if (options.fallbackDir) dirs.push(options.fallbackDir);
	for (const root of options.workspaceFolders) {
		dirs.push(join(root, 'extensions'));
	}
	const external = options.externalAssetsPath?.trim();
	if (external) {
		dirs.push(join(external, 'extensions'));
	}
	for (const extra of options.extraFolders) {
		const trimmed = extra.trim();
		if (!trimmed) continue;
		dirs.push(trimmed);
	}
	return dirs;
}
