// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { CALM_12_BASE_SCHEMA } from '$lib/stores/documentEnvelope';
import {
	projectRelativeFileExists,
	writeProjectRelativeFile,
} from '$lib/project/projectFs';
import { joinProjectRelative, normalizeNewFileName, validateFileName } from '$lib/explorer/folderName';
import { FolderMoveAbortedError } from '$lib/explorer/folderMove';

/** Empty CALM architecture written by Files-tree New file (R72). */
export function emptyCalmArchitectureJson(): string {
	return (
		JSON.stringify(
			{
				$schema: CALM_12_BASE_SCHEMA,
				nodes: [],
				relationships: [],
			},
			null,
			2
		) + '\n'
	);
}

export async function createEmptyCalmFile(options: {
	root: FileSystemDirectoryHandle;
	parentDir: string;
	fileName: string;
	overwrite?: boolean;
}): Promise<{ relativePath: string; handle: FileSystemFileHandle; content: string }> {
	const nameErr = validateFileName(options.fileName);
	if (nameErr) throw new FolderMoveAbortedError(nameErr);
	const fileName = normalizeNewFileName(options.fileName);
	const relativePath = joinProjectRelative(options.parentDir, fileName);
	const exists = await projectRelativeFileExists(options.root, relativePath);
	if (exists && !options.overwrite) {
		throw new FolderMoveAbortedError(`File already exists: ${relativePath}`);
	}
	const content = emptyCalmArchitectureJson();
	const handle = await writeProjectRelativeFile(options.root, relativePath, content);
	return { relativePath, handle, content };
}
