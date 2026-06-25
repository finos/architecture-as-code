// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * documentName.ts — persist the document's display name inside CALM `metadata`.
 *
 * CALM 1.2 has no top-level name/title for an architecture; `metadata` (a oneOf of
 * an object, or an array of objects) is the only canonical free-form document-level
 * slot. Storing the name there lets the title survive content-only round trips
 * (paste, templates, CALM Hub) — not just the OS filename.
 *
 * Both metadata shapes are supported on read; on write we preserve the existing
 * shape and any other metadata keys/entries.
 */

import type { CalmArchitecture } from '@calmstudio/calm-core';
import { getMetadataValue, setMetadataValue } from './calmMetadata';

const NAME_KEY = 'name';

/** Read the persisted document name from CALM metadata (object or array form). */
export function readDocumentName(arch: Pick<CalmArchitecture, 'metadata'>): string | null {
	const value = getMetadataValue(arch.metadata, NAME_KEY);
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Return a metadata value with the document name set (or removed when null/blank),
 * preserving the existing shape and any other metadata keys/entries. Returns
 * `undefined` when the result would be empty (so the caller can drop the key).
 */
export function writeDocumentName(meta: unknown, name: string | null): unknown {
	return setMetadataValue(meta, NAME_KEY, name?.trim() ? name.trim() : null);
}
