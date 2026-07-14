// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { prerenderCalmSvg } from './prerender.js';
import fixture from './__fixtures__/two-node.calm.json';

describe('prerenderCalmSvg', () => {
  it('renders light and dark SVG variants', async () => {
    const bundle = await prerenderCalmSvg(fixture);
    expect(bundle.svg.light).toContain('<svg');
    expect(bundle.svg.light).toContain('Web Client');
    expect(bundle.svg.dark).toContain('<svg');
    expect(bundle.svg.light).not.toEqual(bundle.svg.dark);
  });

  it('extracts intrinsic size from the SVG', async () => {
    const bundle = await prerenderCalmSvg(fixture);
    expect(bundle.size.width).toBeGreaterThan(0);
    expect(bundle.size.height).toBeGreaterThan(0);
  });

  it('rejects on a broken architecture', async () => {
    await expect(prerenderCalmSvg({ nodes: 'not-an-array' })).rejects.toThrow();
  });
});
