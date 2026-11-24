// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

export interface ListedFileStamp {
	relativePath: string;
	modified: number;
}

/** Paths added, removed, or with a new last-modified time. */
export function changedStampPaths(previous: ListedFileStamp[], next: ListedFileStamp[]): string[] {
	const prev = new Map(previous.map((stamp) => [stamp.relativePath, stamp.modified]));
	const nextMap = new Map(next.map((stamp) => [stamp.relativePath, stamp.modified]));
	const changed: string[] = [];
	for (const [path, modified] of nextMap) {
		if (prev.get(path) !== modified) changed.push(path);
	}
	for (const path of prev.keys()) {
		if (!nextMap.has(path)) changed.push(path);
	}
	return changed;
}
