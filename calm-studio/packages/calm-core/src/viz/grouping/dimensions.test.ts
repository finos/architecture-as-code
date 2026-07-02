// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { dimensions, findContainerViaComposedOf, getNested } from './dimensions.js';
import type { CalmArchitecture } from '../../types.js';

const arch = {
  nodes: [
    { 'unique-id': 'parent', 'node-type': 'system' },
    { 'unique-id': 'child', 'node-type': 'ai:agent', metadata: { owner: 'team-a', deep: { key: 'value' } } },
    { 'unique-id': 'orphan', 'node-type': 'service' },
  ],
  relationships: [
    {
      'unique-id': 'r1',
      'relationship-type': { 'composed-of': { container: 'parent', nodes: ['child'] } },
    },
  ],
} as unknown as CalmArchitecture;

describe('dimensions', () => {
  it('container: returns parent for child, null for top-level', () => {
    expect(dimensions.container.extract(arch.nodes![1]!, arch)).toBe('parent');
    expect(dimensions.container.extract(arch.nodes![0]!, arch)).toBeNull();
    expect(dimensions.container.extract(arch.nodes![2]!, arch)).toBeNull();
  });

  it('nodeType: returns node-type', () => {
    expect(dimensions.nodeType.extract(arch.nodes![1]!, arch)).toBe('ai:agent');
  });

  it('aiDomain: extracts segment after "ai:"', () => {
    expect(dimensions.aiDomain.extract(arch.nodes![1]!, arch)).toBe('agent');
    expect(dimensions.aiDomain.extract(arch.nodes![2]!, arch)).toBeNull();
  });

  it('owner: reads metadata.owner', () => {
    expect(dimensions.owner.extract(arch.nodes![1]!, arch)).toBe('team-a');
    expect(dimensions.owner.extract(arch.nodes![2]!, arch)).toBeNull();
  });

  it('customKey: reads dotted path from node', () => {
    expect(dimensions.customKey.extract(arch.nodes![1]!, arch, { key: 'metadata.deep.key' })).toBe('value');
    expect(dimensions.customKey.extract(arch.nodes![1]!, arch, { key: 'metadata.missing' })).toBeNull();
  });

  it('customKey: returns null without key opt', () => {
    expect(dimensions.customKey.extract(arch.nodes![1]!, arch)).toBeNull();
  });
});

describe('getNested', () => {
  it('walks dotted path', () => {
    expect(getNested({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
    expect(getNested({ a: { b: { c: 1 } } }, 'a.x')).toBeUndefined();
  });

  it('returns undefined for non-object input', () => {
    expect(getNested(null, 'a.b')).toBeUndefined();
    expect(getNested('s', 'a.b')).toBeUndefined();
  });
});

describe('findContainerViaComposedOf', () => {
  it('returns container id when node is child', () => {
    expect(findContainerViaComposedOf(arch, 'child')).toBe('parent');
  });

  it('returns null when node is not nested', () => {
    expect(findContainerViaComposedOf(arch, 'orphan')).toBeNull();
  });
});
