// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createDefaultProjectConfig } from '$lib/project/defaults';
import { openCapacity, resolveMaxOpenEditors } from '$lib/editor/editorLimit';
import { resizeAdjacentColumns } from '$lib/ui/columnResize';

describe('editor limit', () => {
	it('defaults a missing or invalid cap to 10', () => {
		expect(resolveMaxOpenEditors(null)).toBe(10);
		const config = createDefaultProjectConfig('p');
		expect(resolveMaxOpenEditors(config)).toBe(10);
		config.ui = { demo: false, maxOpenEditors: 0 };
		expect(resolveMaxOpenEditors(config)).toBe(10);
		config.ui = { demo: false, maxOpenEditors: 4.5 };
		expect(resolveMaxOpenEditors(config)).toBe(10);
		config.ui = { demo: false, maxOpenEditors: 6 };
		expect(resolveMaxOpenEditors(config)).toBe(6);
	});

	it('evicts only when the count equals the limit', () => {
		expect(openCapacity(9, 10)).toBe('ok');
		expect(openCapacity(10, 10)).toBe('evict');
		expect(openCapacity(11, 10)).toBe('refuse');
	});
});

describe('column resize', () => {
	it('moves width between adjacent columns and keeps the sum', () => {
		const next = resizeAdjacentColumns([120, 80, 100], 0, 20);
		expect(next).toEqual([140, 60, 100]);
		expect(next.reduce((sum, width) => sum + width, 0)).toBe(300);
		expect(resizeAdjacentColumns([50, 48], 0, 10)).toEqual([50, 48]);
		expect(resizeAdjacentColumns([120, 80], 1, 10)).toEqual([120, 80]);
	});
});
