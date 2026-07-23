// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Compute a POSIX-style relative path from one file path to another.
 * Both paths are relative to the project root (e.g. "arch/a.json").
 */
export function relativePathBetween(fromFile: string, toFile: string): string {
	const fromDir = fromFile.includes('/')
		? fromFile.slice(0, fromFile.lastIndexOf('/'))
		: '';
	const fromParts = fromDir ? fromDir.split('/') : [];
	const toParts = toFile.split('/');

	let common = 0;
	while (
		common < fromParts.length &&
		common < toParts.length &&
		fromParts[common] === toParts[common]
	) {
		common++;
	}

	const up = fromParts.length - common;
	const down = toParts.slice(common);
	const segments = [...Array(up).fill('..'), ...down];
	return segments.length === 0 ? toParts[toParts.length - 1] ?? toFile : segments.join('/');
}
