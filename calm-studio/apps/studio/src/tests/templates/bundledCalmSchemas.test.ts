// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { bundledCalmSchemas, schemaIdAliases } from '$lib/templates/bundledCalmSchemas';

describe('bundled CALM schemas', () => {
	it('aliases Hub 2025-03 published URLs onto the draft meta files', () => {
		expect(schemaIdAliases('https://calm.finos.org/draft/2025-03/meta/core.json')).toContain(
			'https://calm.finos.org/calm/schemas/2025-03/meta/core.json'
		);
		const map = bundledCalmSchemas();
		expect(map.has('https://calm.finos.org/calm/schemas/2025-03/meta/calm.json')).toBe(true);
		expect(map.has('https://calm.finos.org/calm/schemas/2025-03/meta/core.json')).toBe(true);
		expect(map.has('https://calm.finos.org/calm/schemas/2025-03/meta/interface.json')).toBe(true);
	});
});
