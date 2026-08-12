// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { isReferenceNode, getDetailedArchitectureHref } from './referenceNode';

describe('referenceNode', () => {
	it('detects reference via calmDetails.detailed-architecture', () => {
		expect(
			isReferenceNode({
				calmDetails: { 'detailed-architecture': '../other.json' },
			}),
		).toBe(true);
	});

	it('detects reference via isReference flag', () => {
		expect(isReferenceNode({ isReference: true })).toBe(true);
	});

	it('returns false for regular nodes', () => {
		expect(isReferenceNode({ calmDetails: {} })).toBe(false);
	});

	it('extracts href when present', () => {
		expect(
			getDetailedArchitectureHref({ calmDetails: { 'detailed-architecture': 'arch/api.json' } }),
		).toBe('arch/api.json');
	});
});
