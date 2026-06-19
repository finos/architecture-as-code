// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { applyGrouping } from './groupingEngine.js';
import { dimensions } from './dimensions.js';
import type { CalmArchitecture } from '../../types.js';

const arch = {
  nodes: [
    { 'unique-id': 'a', 'node-type': 'ai:agent' },
    { 'unique-id': 'b', 'node-type': 'ai:agent' },
    { 'unique-id': 'c', 'node-type': 'service' },
    { 'unique-id': 'd', 'node-type': 'database' },
  ],
  relationships: [],
} as unknown as CalmArchitecture;

describe('applyGrouping', () => {
  it('groups by nodeType', () => {
    const res = applyGrouping(arch, dimensions.nodeType);
    expect(res.virtualGroups.size).toBe(3);
    const aiAgentGroup = Array.from(res.virtualGroups.values()).find((g) => g.label === 'ai:agent');
    expect(aiAgentGroup?.childrenIds).toEqual(['a', 'b']);
  });

  it('groups by aiDomain (null-extracts stay top-level)', () => {
    const res = applyGrouping(arch, dimensions.aiDomain);
    expect(res.virtualGroups.size).toBe(1);
    expect(res.nodeToGroup.has('c')).toBe(false);
    expect(res.nodeToGroup.has('d')).toBe(false);
  });

  it('switching dim is idempotent (same dim → same result keys)', () => {
    const r1 = applyGrouping(arch, dimensions.nodeType);
    const r2 = applyGrouping(arch, dimensions.nodeType);
    expect(Array.from(r1.virtualGroups.keys()).sort()).toEqual(Array.from(r2.virtualGroups.keys()).sort());
  });

  it('empty arch produces empty result', () => {
    const empty = { nodes: [], relationships: [] } as unknown as CalmArchitecture;
    const res = applyGrouping(empty, dimensions.nodeType);
    expect(res.virtualGroups.size).toBe(0);
    expect(res.nodeToGroup.size).toBe(0);
  });

  it('virtual group ids are stable + normalized', () => {
    const res = applyGrouping(arch, dimensions.nodeType);
    expect(res.virtualGroups.has('vg-nodeType-ai-agent')).toBe(true);
    expect(res.virtualGroups.has('vg-nodeType-service')).toBe(true);
    expect(res.virtualGroups.has('vg-nodeType-database')).toBe(true);
  });
});
