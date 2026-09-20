// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { ExplorerFileEntry } from '$lib/explorer/types';
import {
	isNestedUnder,
	planFolderMoveRewrites,
	type FolderMoveRewritePlan,
} from '$lib/explorer/rewriteDetailedArchitecture';
import {
	copyDirectoryContents,
	directoryExists,
	getExistingDirectory,
	getOrCreateDirectory,
	removeProjectRelativeDirectory,
	splitRelativePath,
	writeProjectRelativeFile,
} from '$lib/project/projectFs';

export class FolderMoveAbortedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FolderMoveAbortedError';
	}
}

async function readAndParseJson(file: ExplorerFileEntry): Promise<{ oldPath: string; json: unknown }> {
	const text = await (await file.handle.getFile()).text();
	try {
		return { oldPath: file.relativePath, json: JSON.parse(text) as unknown };
	} catch {
		throw new FolderMoveAbortedError(`Invalid JSON: ${file.relativePath}`);
	}
}

export async function moveProjectFolder(options: {
	root: FileSystemDirectoryHandle;
	sourcePrefix: string;
	destPrefix: string;
	files: ExplorerFileEntry[];
	overwrite?: boolean;
}): Promise<{ mapping: Record<string, string>; rewritten: FolderMoveRewritePlan[] }> {
	const { root, sourcePrefix, destPrefix, files, overwrite = false } = options;
	if (!sourcePrefix || !destPrefix) {
		throw new FolderMoveAbortedError('Source and destination are required');
	}
	if (sourcePrefix === destPrefix) {
		throw new FolderMoveAbortedError('Destination is the same as the source');
	}
	if (isNestedUnder(sourcePrefix, destPrefix) && destPrefix !== sourcePrefix) {
		throw new FolderMoveAbortedError('Cannot move a folder into itself');
	}
	if (await directoryExists(root, destPrefix)) {
		if (!overwrite) {
			throw new FolderMoveAbortedError(`Destination already exists: ${destPrefix}`);
		}
		await removeProjectRelativeDirectory(root, destPrefix);
	}

	const parsed = await Promise.all(files.map(readAndParseJson));
	const rewritten = planFolderMoveRewrites(parsed, sourcePrefix, destPrefix);
	const mapping: Record<string, string> = {};
	for (const plan of rewritten) {
		if (plan.newPath !== plan.oldPath) mapping[plan.oldPath] = plan.newPath;
	}

	const sourceDir = await getExistingDirectory(root, sourcePrefix);
	const destDir = await getOrCreateDirectory(root, destPrefix);
	await copyDirectoryContents(sourceDir, destDir);

	for (const plan of rewritten) {
		if (plan.changed) {
			await writeProjectRelativeFile(root, plan.newPath, plan.text);
		}
	}

	await removeProjectRelativeDirectory(root, sourcePrefix);
	return { mapping, rewritten };
}

export async function createProjectFolder(
	root: FileSystemDirectoryHandle,
	parentDir: string,
	name: string
): Promise<string> {
	const relative = parentDir ? `${parentDir}/${name}` : name;
	if (await directoryExists(root, relative)) {
		throw new FolderMoveAbortedError(`Folder already exists: ${relative}`);
	}
	await getOrCreateDirectory(root, relative);
	return relative;
}

export function joinMoveDestination(parentDir: string, folderName: string): string {
	const { name } = splitRelativePath(folderName.includes('/') ? folderName : `x/${folderName}`);
	return parentDir ? `${parentDir}/${name}` : name;
}
