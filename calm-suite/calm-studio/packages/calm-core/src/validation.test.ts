// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { validateCalmArchitecture, type ValidationIssue } from './validation.js';
import type { CalmArchitecture } from './types.js';

// Helper: make a minimal valid node
function makeNode(id: string, name: string, description?: string) {
  return {
    'unique-id': id,
    'node-type': 'service' as const,
    name,
    description: description ?? `Description for ${name}`
  };
}

// Helper: make a minimal valid relationship (CalmStudio flat format)
function makeRel(id: string, sourceNode: string, destNode: string) {
  return {
    'unique-id': id,
    'relationship-type': 'connects' as const,
    source: sourceNode,
    destination: destNode
  };
}

describe('validateCalmArchitecture', () => {
  it('valid architecture with 2 nodes + 1 relationship returns empty issues', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('node-a', 'Node A'), makeNode('node-b', 'Node B')],
      relationships: [makeRel('rel-1', 'node-a', 'node-b')]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('empty architecture returns no errors', () => {
    const arch: CalmArchitecture = { nodes: [], relationships: [] };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('node missing unique-id returns error', () => {
    const arch = {
      nodes: [{ 'node-type': 'service', name: 'Missing ID', description: 'desc' }],
      relationships: []
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('node missing name returns error', () => {
    const arch = {
      nodes: [{ 'unique-id': 'node-1', 'node-type': 'service', description: 'desc' }],
      relationships: []
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('relationship with dangling source ref returns error with relationshipId', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('node-b', 'Node B')],
      relationships: [makeRel('rel-1', 'unknown-node', 'node-b')]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error' && i.relationshipId === 'rel-1');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('duplicate node unique-ids returns error', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('node-1', 'Node One'), makeNode('node-1', 'Node One Duplicate')],
      relationships: []
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error' && i.nodeId === 'node-1');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('orphan node (no relationships) returns warning with nodeId', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('orphan', 'Orphan Node')],
      relationships: []
    };
    const issues = validateCalmArchitecture(arch);
    const warnings = issues.filter((i) => i.severity === 'warning' && i.nodeId === 'orphan');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('self-loop relationship returns warning with relationshipId', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('node-a', 'Node A'), makeNode('node-b', 'Node B')],
      relationships: [makeRel('rel-loop', 'node-a', 'node-a')]
    };
    const issues = validateCalmArchitecture(arch);
    const warnings = issues.filter(
      (i) => i.severity === 'warning' && i.relationshipId === 'rel-loop'
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('node missing description returns info issue', () => {
    const arch = {
      nodes: [
        {
          'unique-id': 'node-1',
          'node-type': 'service' as const,
          name: 'No Desc Node'
          // no description field
        }
      ],
      relationships: []
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const infos = issues.filter((i) => i.severity === 'info' && i.nodeId === 'node-1');
    expect(infos.length).toBeGreaterThan(0);
  });

  it('Ajv rejects architecture with wrong types (nodes is string not array)', () => {
    const arch = { nodes: 'not-an-array', relationships: [] } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('ValidationIssue includes optional path, nodeId, relationshipId fields', () => {
    // Ensure the type has the right shape — compile-time check via TypeScript
    const issue: ValidationIssue = {
      severity: 'info',
      message: 'test message',
      nodeId: 'n1',
      relationshipId: 'r1',
      path: '/nodes/0'
    };
    expect(issue.severity).toBe('info');
    expect(issue.path).toBe('/nodes/0');
  });
});
