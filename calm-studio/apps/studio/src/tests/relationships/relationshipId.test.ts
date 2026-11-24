// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	allocateRelationshipId,
	relationshipIdBase,
	storedRelationshipIdFromEdge,
} from '$lib/relationships/relationshipId';

describe('relationship unique-id (V18)', () => {
	it('builds a slug from source, type, and target', () => {
		expect(relationshipIdBase('Pay API', 'connects', 'Ledger')).toBe('pay-api-connects-ledger');
	});

	it('appends -2, -3 when the base id is taken', () => {
		const taken = ['pay-api-connects-ledger', 'pay-api-connects-ledger-2'];
		expect(allocateRelationshipId('Pay API', 'connects', 'Ledger', taken)).toBe(
			'pay-api-connects-ledger-3',
		);
	});

	it('keeps a stored calmRelId, including a legacy xy-edge value', () => {
		expect(
			storedRelationshipIdFromEdge({ id: 'xy-edge__a-b', data: { calmRelId: 'xy-edge' } }),
		).toBe('xy-edge');
	});

	it('does not collapse a generated xy-edge id to xy-edge', () => {
		expect(storedRelationshipIdFromEdge({ id: 'xy-edge__svc-a-svc-b' })).toBeNull();
	});

	it('still strips the canvas fan-out suffix from a real relationship id', () => {
		expect(storedRelationshipIdFromEdge({ id: 'pay-api-connects-ledger#1' })).toBe(
			'pay-api-connects-ledger',
		);
	});
});
