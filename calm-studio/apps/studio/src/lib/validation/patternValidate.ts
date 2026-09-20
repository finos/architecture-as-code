// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Validate an architecture against a CALM CLI pattern (R51 / #53).
 * Imports `@finos/calm-shared` validate — does not spawn the CLI.
 */

import type { ValidationIssue } from '@calmstudio/calm-core';
import { validate } from '@finos/calm-shared/validate';
import { SchemaDirectory } from '@finos/calm-shared/generate';
import { createBundledCalmDocumentLoader } from '$lib/templates/bundledCalmSchemas';

function severityOf(value: string | undefined): ValidationIssue['severity'] {
	if (value === 'error' || value === 'warning' || value === 'info') return value;
	return 'error';
}

export async function validateArchitectureAgainstPattern(
	architecture: object,
	pattern: object
): Promise<ValidationIssue[]> {
	const loader = createBundledCalmDocumentLoader();
	const schemaDirectory = new SchemaDirectory(loader, false);
	await schemaDirectory.loadSchemas();
	const outcome = await validate(architecture, pattern, undefined, schemaDirectory, false);
	const outputs = outcome.allValidationOutputs();
	return outputs.map((item) => ({
		severity: severityOf(item.severity),
		message: item.message,
		path: item.path,
	}));
}
