// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * calmMetadata.ts — read/write keyed values in a CALM document's `metadata`.
 *
 * CALM 1.2 `metadata` is a oneOf: a single object, or an array of objects. Studio
 * stores a few document-level annotations there (the document name, the saved
 * diagram layout); these helpers set/read a key while preserving the existing
 * shape and every other key/entry, so the two annotations coexist cleanly.
 */

function hasKey(entry: unknown, key: string): entry is Record<string, unknown> {
	return !!entry && typeof entry === 'object' && key in (entry as object);
}

/** Read a document-level metadata value by key (object or array-of-objects form). */
export function getMetadataValue(meta: unknown, key: string): unknown {
	const entries = Array.isArray(meta) ? meta : meta ? [meta] : [];
	for (const entry of entries) {
		if (hasKey(entry, key)) return entry[key];
	}
	return undefined;
}

/**
 * Set (or remove, when value is null/undefined) a document-level metadata value by
 * key, preserving the existing shape and any other keys/entries. Returns
 * `undefined` when the result would be empty (so the caller can drop `metadata`).
 */
export function setMetadataValue(meta: unknown, key: string, value: unknown): unknown {
	const clear = value === null || value === undefined;
	if (Array.isArray(meta)) {
		const rest = meta.filter((e) => !hasKey(e, key));
		if (clear) return rest.length ? rest : undefined;
		return [{ [key]: value }, ...rest];
	}
	const obj: Record<string, unknown> = meta && typeof meta === 'object' ? { ...(meta as object) } : {};
	if (clear) delete obj[key];
	else obj[key] = value;
	return Object.keys(obj).length ? obj : undefined;
}
