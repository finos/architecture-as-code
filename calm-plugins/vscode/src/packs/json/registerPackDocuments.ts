// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition } from '../types.js';
import { registerPack } from '../registry.js';
import { parsePackJson } from './parsePack.js';

export function registerPackDocuments(
	documents: Iterable<{ source: string; value: unknown }>
): { registered: number; warnings: string[]; packs: PackDefinition[] } {
	let registered = 0;
	const warnings: string[] = [];
	const packs: PackDefinition[] = [];
	for (const doc of documents) {
		const parsed = parsePackJson(doc.value);
		if (!parsed.ok) {
			warnings.push(`Skipped ${doc.source}: ${parsed.errors.join('; ')}`);
			continue;
		}
		registerPack(parsed.pack);
		packs.push(parsed.pack);
		registered += 1;
	}
	return { registered, warnings, packs };
}
