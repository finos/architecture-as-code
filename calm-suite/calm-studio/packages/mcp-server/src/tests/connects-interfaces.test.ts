// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * RED test for #2553 rework: the `RelationshipInputSchema` zod definition
 * must accept the canonical `interfaces?: string[]` field on connects
 * endpoints (per `CalmNodeInterfaceSchema` in @finos/calm-models).
 *
 * Today's `ConnectsEndpointSchema = z.object({ node: z.string() })`
 * silently strips `interfaces` because zod's default behavior on
 * `.object()` is `strip` — extra fields parse OK but are dropped from
 * the output. Task 7 of the rework adds the field; this test flips
 * GREEN at that point.
 */

import { describe, it, expect } from 'vitest';
import { RelationshipInputSchema } from '../types.js';

describe('RelationshipInputSchema: connects endpoint interfaces[] (#2553 rework)', () => {
	it('preserves `interfaces?: string[]` on connects source endpoint after zod parse', () => {
		const input = {
			'unique-id': 'a-to-b',
			'relationship-type': {
				connects: {
					source: { node: 'a', interfaces: ['iface-1'] },
					destination: { node: 'b' },
				},
			},
		};
		const result = RelationshipInputSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (!result.success) return;
		const rt = result.data['relationship-type'];
		if (!('connects' in rt)) throw new Error('expected connects variant');
		// The .strip() default would drop `interfaces` — this assertion fails
		// today and flips to GREEN once the schema models the field.
		expect((rt.connects.source as { interfaces?: string[] }).interfaces).toEqual(['iface-1']);
	});
});
