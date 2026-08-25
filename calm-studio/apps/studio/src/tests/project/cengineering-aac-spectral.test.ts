// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration: CEngineering-App architecture/rules.json × aac.appcomp.json
 * via runSpectralLint (same path CalmStudio uses for project rulesets).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runSpectralLint } from '$lib/project/spectralBridge';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Sibling checkout: …/git/difa/CEngineering-App (next to architecture-as-code). */
function resolveCEngineeringRoot(): string | null {
	if (process.env['CENGINEERING_APP']) {
		const envRoot = process.env['CENGINEERING_APP'];
		return existsSync(envRoot) ? envRoot : null;
	}
	// apps/studio/src/tests/project → …/git (7 levels up after calm-studio move)
	const gitRoot = path.resolve(HERE, '../../../../../../..');
	const candidate = path.join(gitRoot, 'difa', 'CEngineering-App');
	return existsSync(candidate) ? candidate : null;
}

function resolveCEngineeringInputs(): { rulesetPath: string; documentPath: string } | null {
	const root = resolveCEngineeringRoot();
	if (!root) return null;
	const rulesetPath = path.join(root, 'architecture', 'rules.json');
	const documentPath = [
		path.join(root, 'application-components', 'aac', 'aac.appcomp.json'),
		path.join(root, 'tests', 'fixtures', 'aac.appcomp.json'),
	].find((candidate) => existsSync(candidate));
	if (!existsSync(rulesetPath) || !documentPath) return null;
	return { rulesetPath, documentPath };
}

describe('CEngineering AAC Spectral rules', () => {
	const inputs = resolveCEngineeringInputs();

	it.skipIf(!inputs)('flags incomplete applicationService in aac.appcomp.json', async () => {
		const ruleset = JSON.parse(
			readFileSync(inputs!.rulesetPath, 'utf8')
		) as unknown;
		const document = JSON.parse(
			readFileSync(inputs!.documentPath, 'utf8')
		) as unknown;

		const results = await runSpectralLint(document, ruleset);
		const codes = results.map((r) => r.code);

		expect(codes).toContain('archimate-metadata-required');
		expect(codes).toContain('application-service-mapping');

		const incomplete = results.filter(
			(r) =>
				Array.isArray(r.path) &&
				r.path[0] === 'nodes' &&
				String(r.path[1]) === '1'
		);
		expect(incomplete.length).toBeGreaterThan(0);
		expect(incomplete.some((r) => r.code === 'archimate-metadata-required')).toBe(true);
		expect(incomplete.some((r) => r.code === 'application-service-mapping')).toBe(true);

		// Complete nodes / relationship must not trigger metadata-required
		const completeNodeMeta = results.filter(
			(r) =>
				r.code === 'archimate-metadata-required' &&
				Array.isArray(r.path) &&
				(String(r.path[1]) === '0' || String(r.path[1]) === '2')
		);
		expect(completeNodeMeta).toHaveLength(0);
	});
});
