// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { createSeverityResolver } from './severityResolver.js';
import { createBadgeAPI } from '../badges/BadgeAPI.js';
import { decoratorsAdapter } from '../badges/adapters/decoratorsAdapter.js';
import type { CalmArchitecture } from '../../types.js';

function archWith(nodeDecorators: unknown[]): CalmArchitecture {
  return {
    nodes: [{ 'unique-id': 'n1', 'node-type': 'service', decorators: nodeDecorators }],
    relationships: [],
  } as unknown as CalmArchitecture;
}

describe('createSeverityResolver', () => {
  it('returns highest severity across decorators', () => {
    const arch = archWith([
      { 'unique-id': 'd1', type: 'threat', data: { severity: 'low' } },
      { 'unique-id': 'd2', type: 'threat', data: { severity: 'high' } },
      { 'unique-id': 'd3', type: 'threat', data: { severity: 'medium' } },
    ]);
    const badges = createBadgeAPI(arch, [decoratorsAdapter]);
    const sev = createSeverityResolver(badges, arch);
    expect(sev.forNode('n1')).toBe('high');
  });

  it('returns critical when any decorator is critical', () => {
    const arch = archWith([
      { 'unique-id': 'd1', type: 'threat', data: { severity: 'high' } },
      { 'unique-id': 'd2', type: 'threat', data: { severity: 'critical' } },
    ]);
    const sev = createSeverityResolver(createBadgeAPI(arch, [decoratorsAdapter]), arch);
    expect(sev.forNode('n1')).toBe('critical');
  });

  it('returns unknown for nodes with no decorators', () => {
    const arch = archWith([]);
    const sev = createSeverityResolver(createBadgeAPI(arch, [decoratorsAdapter]), arch);
    expect(sev.forNode('n1')).toBe('unknown');
  });

  it('returns unknown for missing node id', () => {
    const arch = archWith([]);
    const sev = createSeverityResolver(createBadgeAPI(arch, [decoratorsAdapter]), arch);
    expect(sev.forNode('does-not-exist')).toBe('unknown');
  });

  it('rank order is unknown < low < medium < high < critical', () => {
    const arch = archWith([
      { 'unique-id': 'd1', type: 'threat', data: { severity: 'low' } },
      { 'unique-id': 'd2', type: 'threat', data: { severity: 'medium' } },
    ]);
    const sev = createSeverityResolver(createBadgeAPI(arch, [decoratorsAdapter]), arch);
    expect(sev.forNode('n1')).toBe('medium');
  });
});
