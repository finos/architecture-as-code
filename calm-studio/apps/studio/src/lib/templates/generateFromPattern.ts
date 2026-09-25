// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * In-memory CALM generate via @finos/calm-shared (R41 / #42).
 * Does not spawn the CLI and does not reimplement instantiate.
 */

import type { CalmArchitecture } from '@calmstudio/calm-core';
import {
	extractOptions,
	generateArchitecture,
	SchemaDirectory,
	type CalmChoice,
	type CalmOption,
} from '@finos/calm-shared/generate';
import {
	createProjectCalmDocumentLoader,
	type UrlMappingSource,
} from './mappedCalmLoader';

export function patternGenerateOptions(pattern: object): CalmOption[] {
	return extractOptions(pattern);
}

export async function generateArchitectureFromPattern(
	pattern: object,
	choices?: CalmChoice[],
	mapping?: UrlMappingSource
): Promise<CalmArchitecture> {
	const { loader } = await createProjectCalmDocumentLoader(mapping);
	const schemaDirectory = new SchemaDirectory(loader, false);
	const result = await generateArchitecture(pattern, false, schemaDirectory, choices);
	if (!result || typeof result !== 'object') {
		throw new Error('Generate did not return an architecture object');
	}
	const rec = result as Record<string, unknown>;
	if (!Array.isArray(rec['nodes'])) {
		throw new Error('Generated document is missing a nodes array');
	}
	return result as CalmArchitecture;
}
