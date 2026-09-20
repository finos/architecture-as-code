// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
	path.join(process.cwd(), 'src/lib/canvas/nodes/ContainerNode.svelte'),
	'utf8'
);

describe('container visual size (R47)', () => {
	it('does not use Tailwind class container (that class caps max-width at breakpoints)', () => {
		expect(src).not.toMatch(/class="container[\s"]/);
		expect(src).toMatch(/class="node-shell /);
	});
});
