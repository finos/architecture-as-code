// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCalmModule } from './loader.js';

const fixturePath = fileURLToPath(new URL('./__fixtures__/two-node.calm.json', import.meta.url));
const fixtureRaw = readFileSync(fixturePath, 'utf8');

describe('buildCalmModule', () => {
  it('emits an ES module with architecture, svg, size and a default export', async () => {
    const code = await buildCalmModule(fixtureRaw, fixturePath);
    expect(code).toContain('export const architecture =');
    expect(code).toContain('export const svg =');
    expect(code).toContain('export const size =');
    expect(code).toContain('export default { architecture, svg, size };');
    expect(code).toContain('Web Client'); // node name baked into the SVG
  });

  it('emitted module source is valid JavaScript', async () => {
    const code = await buildCalmModule(fixtureRaw, fixturePath);
    // Throws SyntaxError if the emitted source does not parse as a module
    expect(() => new Function(code.replace(/export (const|default)/g, 'void 0,'))).not.toThrow();
  });

  it('throws with the file path on invalid JSON', async () => {
    await expect(buildCalmModule('{ not json', '/docs/broken.calm.json')).rejects.toThrow(
      /\/docs\/broken\.calm\.json/
    );
  });

  it('throws with the file path when rendering fails', async () => {
    await expect(buildCalmModule('{"nodes": "bad"}', '/docs/bad-arch.calm.json')).rejects.toThrow(
      /\/docs\/bad-arch\.calm\.json/
    );
  });
});
