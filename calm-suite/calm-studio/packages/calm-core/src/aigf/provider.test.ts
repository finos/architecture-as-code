// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import {
  aigfGuidanceProvider,
  BUILTIN_GUIDANCE_PROVIDERS,
  getBuiltinGuidanceProvider,
} from './provider.js';

describe('AIGF guidance provider (built-in)', () => {
  it('is registered as a built-in', () => {
    expect(BUILTIN_GUIDANCE_PROVIDERS.map((p) => p.id)).toContain('aigf');
    expect(getBuiltinGuidanceProvider('aigf')).toBe(aigfGuidanceProvider);
    expect(getBuiltinGuidanceProvider('nope')).toBeUndefined();
  });

  it('cites the canonical finos-air coordinate', () => {
    expect(aigfGuidanceProvider.catalogRef).toEqual({
      namespace: 'finos-aigf',
      catalogId: 'finos-air',
      version: '0.2.0',
    });
  });

  it('exposes the 23 bundled finos-air guidelines, each well-formed', () => {
    const g = aigfGuidanceProvider.guidelines();
    expect(g).toHaveLength(23);
    for (const x of g) {
      expect(x.id).toMatch(/^AIR-(PREV|DET)-\d+$/);
      expect(x.title).toBeTruthy();
      expect(x.objective).toBeTruthy();
    }
    expect(g.find((x) => x.id === 'AIR-PREV-002')?.title).toBe('Data Filtering From External Knowledge Bases');
  });

  it('recommends node-type-applicable guidelines (the built-in advantage)', () => {
    const vs = aigfGuidanceProvider.recommendedGuidelineIds!('ai:vector-store');
    expect(vs).toContain('AIR-PREV-002');
    // recommendations resolve to real bundled guidelines
    const ids = new Set(aigfGuidanceProvider.guidelines().map((x) => x.id));
    for (const id of vs) expect(ids.has(id)).toBe(true);
    // unknown node-type → no recommendations
    expect(aigfGuidanceProvider.recommendedGuidelineIds!('service')).toEqual([]);
  });
});
