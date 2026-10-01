// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/** Extra metadata keys not owned by the pack schema form (R57). */

const RESERVED = new Set(['building-block-style', 'fidelity-style', '_layout']);

export function extraMetadataEntries(
	metadata: Record<string, unknown> | undefined,
	schemaPaths: string[][]
): Array<{ key: string; value: string; nested: boolean; isArray: boolean; raw: unknown }> {
	if (!metadata) return [];
	const schemaTop = new Set(schemaPaths.map((p) => p[0]).filter(Boolean) as string[]);
	const out: Array<{ key: string; value: string; nested: boolean; isArray: boolean; raw: unknown }> =
		[];
	for (const [key, value] of Object.entries(metadata)) {
		if (RESERVED.has(key) || schemaTop.has(key)) continue;
		const isArray = Array.isArray(value);
		const nested = !!value && typeof value === 'object';
		out.push({
			key,
			value:
				typeof value === 'string'
					? value
					: (() => {
							try {
								return JSON.stringify(value, null, 2);
							} catch {
								return String(value);
							}
						})(),
			nested,
			isArray,
			raw: value,
		});
	}
	return out;
}

export function upsertExtraMetadata(
	metadata: Record<string, unknown> | undefined,
	key: string,
	value: string
): Record<string, unknown> {
	const next = { ...(metadata ?? {}) };
	const trimmed = key.trim();
	if (!trimmed || RESERVED.has(trimmed)) return next;
	try {
		next[trimmed] = JSON.parse(value);
	} catch {
		next[trimmed] = value;
	}
	return next;
}

export function removeExtraMetadata(
	metadata: Record<string, unknown> | undefined,
	key: string
): Record<string, unknown> {
	const next = { ...(metadata ?? {}) };
	delete next[key];
	return next;
}
