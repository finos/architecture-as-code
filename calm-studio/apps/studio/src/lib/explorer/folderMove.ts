// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import type { ExplorerFileEntry } from '$lib/explorer/types';
import {
	isNestedUnder,
	planFolderMoveRewrites,
	type FolderMoveRewriteFile,
	type FolderMoveRewritePlan,
} from '$lib/explorer/rewriteDetailedArchitecture';
import {
	copyDirectoryContents,
	directoryExists,
	getExistingDirectory,
	getOrCreateDirectory,
	projectRelativeFileExists,
	removeProjectRelativeDirectory,
	removeProjectRelativeFile,
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

/** Skip files that are not valid JSON. A bad file must not block the move. */
async function readParseableFiles(files: ExplorerFileEntry[]): Promise<FolderMoveRewriteFile[]> {
	const parsed: FolderMoveRewriteFile[] = [];
	for (const file of files) {
		try {
			parsed.push(await readAndParseJson(file));
		} catch (e) {
			if (!(e instanceof FolderMoveAbortedError)) throw e;
		}
	}
	return parsed;
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

	const parsed = await readParseableFiles(files);
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

/** Move one file. Abort when the destination name exists. Do not prompt to overwrite (R77). */
export async function moveProjectFile(options: {
	root: FileSystemDirectoryHandle;
	sourcePath: string;
	destPath: string;
	files: ExplorerFileEntry[];
}): Promise<{ mapping: Record<string, string>; rewritten: FolderMoveRewritePlan[] }> {
	const { root, sourcePath, destPath, files } = options;
	if (!sourcePath || !destPath) {
		throw new FolderMoveAbortedError('Source and destination are required');
	}
	if (sourcePath === destPath) {
		throw new FolderMoveAbortedError('Destination is the same as the source');
	}
	if (await projectRelativeFileExists(root, destPath)) {
		throw new FolderMoveAbortedError(`Destination already exists: ${destPath}`);
	}

	const parsed = await readParseableFiles(files);
	const source = files.find((file) => file.relativePath === sourcePath);
	if (!source) {
		throw new FolderMoveAbortedError(`Cannot read ${sourcePath}`);
	}
	const sourceParsed = parsed.some((file) => file.oldPath === sourcePath);
	const rewritten = planFolderMoveRewrites(parsed, sourcePath, destPath);
	const mapping: Record<string, string> = {};
	for (const plan of rewritten) {
		if (plan.newPath !== plan.oldPath) mapping[plan.oldPath] = plan.newPath;
	}

	for (const plan of rewritten) {
		if (plan.newPath === plan.oldPath && !plan.changed) continue;
		await writeProjectRelativeFile(root, plan.newPath, plan.text);
	}
	if (!sourceParsed) {
		const text = await (await source.handle.getFile()).text();
		await writeProjectRelativeFile(root, destPath, text);
		mapping[sourcePath] = destPath;
	}
	await removeProjectRelativeFile(root, sourcePath);
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
