// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * RED tests for the @finos/calm-models adoption rework on PR #2553.
 *
 * Each assertion exercises a canonical behavior the current code does
 * NOT support. They flip to GREEN as the adoption tasks land.
 */

import { describe, expect, it } from 'vitest';
import { validateCalmArchitecture } from './validation.js';
import type { CalmArchitecture } from './types.js';

describe('canonical CALM shape — calm-models adoption (#2553 rework)', () => {
	it('accepts connects endpoint with `interfaces?: string[]`', () => {
		const arch: CalmArchitecture = {
			nodes: [
				{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'A' },
				{ 'unique-id': 'b', 'node-type': 'service', name: 'B', description: 'B' },
			],
			relationships: [
				{
					'unique-id': 'a-to-b',
					'relationship-type': {
						connects: {
							source: { node: 'a', interfaces: ['iface-1'] },
							destination: { node: 'b' },
						},
					},
				},
			],
		};
		const issues = validateCalmArchitecture(arch);
		const errors = issues.filter((i) => i.severity === 'error');
		expect(errors).toEqual([]);
	});

	// Upstream gap: even the canonical calm/release/1.2/meta/core.json puts
	// `additionalProperties: false` *inside* `properties` (a property named
	// "additionalProperties") rather than at the schema root. The constraint
	// is therefore never enforced. Tracked upstream in #2552. When the
	// canonical schema is fixed, flip `it.todo` → `it` and this assertion
	// will pass via the symlinked canonical bundle.
	it.todo('rejects an unknown field at the architecture root (blocked on upstream #2552)');
});
