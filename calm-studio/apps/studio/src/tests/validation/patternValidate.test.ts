// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@finos/calm-shared/validate', () => ({
	validate: vi.fn(async () => ({
		allValidationOutputs: () => [{ severity: 'error', message: 'missing node', path: '/nodes' }],
	})),
}));

vi.mock('@finos/calm-shared/generate', () => ({
	SchemaDirectory: class {
		async loadSchemas() {}
	},
}));

vi.mock('@finos/calm-shared/document-loader-types', () => ({
	DocumentLoadError: class extends Error {},
}));

describe('patternValidate', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('imports shared validate and does not spawn a CLI process', async () => {
		const spawn = vi.spyOn(process, 'kill');
		const { validateArchitectureAgainstPattern } = await import('$lib/validation/patternValidate');
		const issues = await validateArchitectureAgainstPattern({ nodes: [], relationships: [] }, {
			$id: 'p',
			properties: { nodes: {} },
		});
		expect(issues).toEqual([
			{ severity: 'error', message: 'missing node', path: '/nodes' },
		]);
		expect(spawn).not.toHaveBeenCalled();
		spawn.mockRestore();
	});

	it('warns on unmapped schema URLs and does not fetch them', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const { validateArchitectureAgainstPattern } = await import('$lib/validation/patternValidate');
		const issues = await validateArchitectureAgainstPattern(
			{
				$schema: 'https://example.com/unmapped-standard.json',
				nodes: [],
				relationships: [],
			},
			{ $id: 'p', properties: { nodes: {} } }
		);
		expect(issues).toEqual(
			expect.arrayContaining([
				{
					severity: 'warning',
					message: 'Unmapped schema URL (no network fetch): https://example.com/unmapped-standard.json',
				},
			])
		);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
});
