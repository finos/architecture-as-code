// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	extraMetadataEntries,
	removeExtraMetadata,
	upsertExtraMetadata,
} from '$lib/metadata/extraMetadata';

describe('generic metadata', () => {
	it('exposes extra keys on nodes and relationships, skipping reserved layout/style', () => {
		const metadata = {
			owner: 'team',
			_layout: { x: 1 },
			'building-block-style': { background: '#fff' },
			ticket: 'ABC-1',
			nested: { a: 1 },
		};
		const extra = extraMetadataEntries(metadata, [['owner']]);
		expect(extra.map((e) => e.key).sort()).toEqual(['nested', 'ticket']);
		expect(extra.find((e) => e.key === 'nested')?.value).toBe('{\n  "a": 1\n}');
		expect(extra.find((e) => e.key === 'nested')?.nested).toBe(true);
		expect(extra.find((e) => e.key === 'nested')?.isArray).toBe(false);
		expect(extra.find((e) => e.key === 'ticket')?.nested).toBe(false);
	});

	it('upserts JSON values and refuses reserved keys', () => {
		const next = upsertExtraMetadata({ owner: 'x' }, 'flags', '{"beta":true}');
		expect(next.flags).toEqual({ beta: true });
		expect(upsertExtraMetadata(next, '_layout', '{}')).toEqual(next);
		expect(removeExtraMetadata(next, 'flags').flags).toBeUndefined();
	});
});
