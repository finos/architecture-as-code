// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * decoratorForm.ts — Shared validation for the decorator authoring forms
 * (the per-element DecoratorSection and the document-scoped DocumentDecorators).
 * Pure, no Svelte/DOM deps.
 */

/**
 * Parse the `data` textarea of a decorator form. A decorator's `data` must be a
 * JSON object (not an array or primitive). Returns `{ data }` on success or
 * `{ error }` with a user-facing message. An empty string is treated as `{}`.
 */
export function parseDecoratorData(input: string): {
	data?: Record<string, unknown>;
	error?: string;
} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(input.trim() || '{}');
	} catch {
		return { error: 'Data must be valid JSON' };
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return { error: 'Data must be a JSON object' };
	}
	return { data: parsed as Record<string, unknown> };
}
