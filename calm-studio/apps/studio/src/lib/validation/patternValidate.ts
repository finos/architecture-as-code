// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Validate an architecture against a CALM CLI pattern (R51 / #53).
 * Imports `@finos/calm-shared` validate — does not spawn the CLI.
 * Uses project url-mapping.json when `.calmrj` `urlMapping.path` is set (R75).
 */

import type { ValidationIssue } from '@calmstudio/calm-core';
import { validate } from '@finos/calm-shared/validate';
import { SchemaDirectory } from '@finos/calm-shared/generate';
import { isBundledCalmSchemaId } from '$lib/templates/bundledCalmSchemas';
import {
	createProjectCalmDocumentLoader,
	type UrlMappingSource,
} from '$lib/templates/mappedCalmLoader';
import { collectCanonicalUrls, lookupMappedUrl } from '$lib/project/urlMapping';

function severityOf(value: string | undefined): ValidationIssue['severity'] {
	if (value === 'error' || value === 'warning' || value === 'info') return value;
	return 'error';
}

function unmappedUrlIssues(
	docs: object[],
	map: Map<string, string>,
	hubUrl: string | null | undefined
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const seen = new Set<string>();
	for (const doc of docs) {
		for (const url of collectCanonicalUrls(doc)) {
			if (seen.has(url)) continue;
			seen.add(url);
			if (isBundledCalmSchemaId(url)) continue;
			const hit = lookupMappedUrl(url, map, hubUrl);
			if (hit.kind === 'unmapped') {
				issues.push({
					severity: 'warning',
					message: `Unmapped schema URL (no network fetch): ${url}`,
				});
			}
		}
	}
	return issues;
}

export async function validateArchitectureAgainstPattern(
	architecture: object,
	pattern: object,
	mapping?: UrlMappingSource
): Promise<ValidationIssue[]> {
	const { loader, warnings, map } = await createProjectCalmDocumentLoader(mapping);
	const schemaDirectory = new SchemaDirectory(loader, false);
	await schemaDirectory.loadSchemas();
	const outcome = await validate(architecture, pattern, undefined, schemaDirectory, false);
	const outputs = outcome.allValidationOutputs();
	const mappingIssues: ValidationIssue[] = warnings.map((message) => ({
		severity: 'warning' as const,
		message,
	}));
	return [
		...mappingIssues,
		...unmappedUrlIssues([architecture, pattern], map, mapping?.hubUrl),
		...outputs.map((item) => ({
			severity: severityOf(item.severity),
			message: item.message,
			path: item.path,
		})),
	];
}
