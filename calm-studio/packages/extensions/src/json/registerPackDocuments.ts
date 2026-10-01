// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { registerPack } from '../registry.js';
import { parsePackJson } from './parsePack.js';

export interface RegisterPackDocumentsResult {
	registered: number;
	warnings: string[];
}

/** Parse and register pack JSON documents. Invalid entries are skipped. */
export function registerPackDocuments(
	documents: Iterable<{ source: string; value: unknown }>,
	warn: (message: string) => void = () => undefined
): RegisterPackDocumentsResult {
	let registered = 0;
	const warnings: string[] = [];
	for (const doc of documents) {
		const parsed = parsePackJson(doc.value);
		if (!parsed.ok) {
			const message = `Skipped ${doc.source}: ${parsed.errors.join('; ')}`;
			warnings.push(message);
			warn(message);
			continue;
		}
		registerPack(parsed.pack);
		registered += 1;
	}
	return { registered, warnings };
}
