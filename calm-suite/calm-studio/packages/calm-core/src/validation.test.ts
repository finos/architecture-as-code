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

  it('skips semantic rules when nodes is not an array', () => {
    const arch = { nodes: 'bad', relationships: [] } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    // Should have schema error but no semantic warnings (orphan, etc.)
    const warnings = issues.filter((i) => i.severity === 'warning');
    expect(warnings).toHaveLength(0);
  });

  it('skips semantic rules when relationships is not an array', () => {
    const arch = { nodes: [], relationships: 'bad' } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const warnings = issues.filter((i) => i.severity === 'warning');
    expect(warnings).toHaveLength(0);
  });

  it('schema error on relationship extracts relationshipId', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        {
          'unique-id': 'rel-bad',
          'relationship-type': '' as never, // minLength violation
          source: 'node-a',
          destination: 'node-a'
        } as never
      ]
    };
    const issues = validateCalmArchitecture(arch);
    const schemaErrors = issues.filter(
      (i) => i.severity === 'error' && i.path?.startsWith('/relationships/')
    );
    expect(schemaErrors.length).toBeGreaterThan(0);
    expect(schemaErrors[0]!.relationshipId).toBe('rel-bad');
  });

  it('schema error on node without unique-id does not set nodeId', () => {
    const arch = {
      nodes: [{ 'node-type': '', name: 'X' }], // missing unique-id, empty node-type
      relationships: []
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const nodeSchemaErrors = issues.filter(
      (i) => i.severity === 'error' && i.path?.startsWith('/nodes/')
    );
    expect(nodeSchemaErrors.length).toBeGreaterThan(0);
    // nodeId should be undefined since the node has no unique-id
    expect(nodeSchemaErrors[0]!.nodeId).toBeUndefined();
  });

  it('schema error with empty instancePath omits path prefix in message', () => {
    // Architecture missing required 'nodes' property entirely
    const arch = { relationships: [] } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    // At least one error should have empty path (root-level schema error)
    const rootError = errors.find((i) => i.path === '');
    expect(rootError).toBeDefined();
    // Message should not start with ':'
    expect(rootError!.message).not.toMatch(/^:/);
  });

  it('relationship missing source returns error', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        { 'unique-id': 'rel-1', 'relationship-type': 'connects', destination: 'node-a' }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('missing a source')
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.relationshipId).toBe('rel-1');
  });

  it('relationship missing destination returns error', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        { 'unique-id': 'rel-1', 'relationship-type': 'connects', source: 'node-a' }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('missing a destination')
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.relationshipId).toBe('rel-1');
  });

  it('dangling destination reference returns error', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [makeRel('rel-1', 'node-a', 'ghost-node')]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('destination') && i.message.includes('ghost-node')
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.relationshipId).toBe('rel-1');
  });

  it('duplicate relationship unique-ids returns error', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('node-a', 'Node A'), makeNode('node-b', 'Node B')],
      relationships: [makeRel('rel-dup', 'node-a', 'node-b'), makeRel('rel-dup', 'node-b', 'node-a')]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('Duplicate relationship')
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.relationshipId).toBe('rel-dup');
  });

  it('relationship without unique-id skips duplicate check and uses ? in messages', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        { 'relationship-type': 'connects', source: 'node-a', destination: 'ghost' }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    // Should have dangling ref error with '?' as relId
    const danglingErrors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('"?"')
    );
    expect(danglingErrors.length).toBeGreaterThan(0);
    // Should NOT have relationshipId set
    expect(danglingErrors[0]!.relationshipId).toBeUndefined();
  });

  it('node without unique-id is skipped in duplicate/semantic checks', () => {
    const arch = {
      nodes: [
        { 'node-type': 'service', name: 'No ID', description: 'desc' },
        makeNode('node-b', 'Node B')
      ],
      relationships: []
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    // Should not crash; no duplicate errors for undefined ids
    const dupErrors = issues.filter((i) => i.message.includes('Duplicate node'));
    expect(dupErrors).toHaveLength(0);
  });

  it('node with empty string description returns info', () => {
    const arch: CalmArchitecture = {
      nodes: [
        { 'unique-id': 'node-1', 'node-type': 'service' as const, name: 'Test', description: '   ' }
      ],
      relationships: []
    };
    const issues = validateCalmArchitecture(arch);
    const infos = issues.filter(
      (i) => i.severity === 'info' && i.nodeId === 'node-1' && i.message.includes('no description')
    );
    expect(infos.length).toBeGreaterThan(0);
  });

  it('dangling source with zero nodes does not report dangling ref', () => {
    // nodeIds.size === 0 branch: skip dangling check
    const arch = {
      nodes: [],
      relationships: [
        { 'unique-id': 'rel-1', 'relationship-type': 'connects', source: 'x', destination: 'y' }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const danglingErrors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('does not reference a known node')
    );
    expect(danglingErrors).toHaveLength(0);
  });

  it('relationship with missing source AND no relId omits relationshipId', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        { 'relationship-type': 'connects', destination: 'node-a' }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const missingSource = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('missing a source')
    );
    expect(missingSource.length).toBeGreaterThan(0);
    expect(missingSource[0]!.relationshipId).toBeUndefined();
  });

  it('relationship with missing destination AND no relId omits relationshipId', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        { 'relationship-type': 'connects', source: 'node-a' }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const missingDest = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('missing a destination')
    );
    expect(missingDest.length).toBeGreaterThan(0);
    expect(missingDest[0]!.relationshipId).toBeUndefined();
  });

  it('self-loop with no relId uses ? and omits relationshipId', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        { 'relationship-type': 'connects', source: 'node-a', destination: 'node-a' }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const selfLoop = issues.filter(
      (i) => i.severity === 'warning' && i.message.includes('connects a node to itself')
    );
    expect(selfLoop.length).toBeGreaterThan(0);
    expect(selfLoop[0]!.message).toContain('"?"');
    expect(selfLoop[0]!.relationshipId).toBeUndefined();
  });

  it('issues are sorted by severity: errors first, then warnings, then info', () => {
    const arch: CalmArchitecture = {
      nodes: [
        { 'unique-id': 'node-a', 'node-type': 'service' as const, name: 'A' }, // info: no desc
        { 'unique-id': 'node-b', 'node-type': 'service' as const, name: 'B' }, // warning: orphan, info: no desc
      ],
      relationships: [makeRel('rel-1', 'node-a', 'ghost')] // error: dangling dest
    };
    const issues = validateCalmArchitecture(arch);
    expect(issues.length).toBeGreaterThanOrEqual(3);
    const severities = issues.map((i) => i.severity);
    const errorIdx = severities.indexOf('error');
    const warnIdx = severities.indexOf('warning');
    const infoIdx = severities.indexOf('info');
    if (errorIdx >= 0 && warnIdx >= 0) expect(errorIdx).toBeLessThan(warnIdx);
    if (warnIdx >= 0 && infoIdx >= 0) expect(warnIdx).toBeLessThan(infoIdx);
  });

  it('schema error on relationship without unique-id does not set relationshipId', () => {
    const arch = {
      nodes: [],
      relationships: [
        { 'relationship-type': '', source: 'a', destination: 'b' } // minLength violation, no unique-id
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const relSchemaErrors = issues.filter(
      (i) => i.severity === 'error' && i.path?.startsWith('/relationships/')
    );
    expect(relSchemaErrors.length).toBeGreaterThan(0);
    expect(relSchemaErrors[0]!.relationshipId).toBeUndefined();
  });

  it('dangling source ref without relId uses ? and omits relationshipId', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        { 'relationship-type': 'connects', source: 'ghost', destination: 'node-a' }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const dangling = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('source') && i.message.includes('ghost')
    );
    expect(dangling.length).toBeGreaterThan(0);
    expect(dangling[0]!.message).toContain('"?"');
    expect(dangling[0]!.relationshipId).toBeUndefined();
  });

  it('dangling destination ref without relId uses ? and omits relationshipId', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        { 'relationship-type': 'connects', source: 'node-a', destination: 'ghost' }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const dangling = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('destination') && i.message.includes('ghost')
    );
    expect(dangling.length).toBeGreaterThan(0);
    expect(dangling[0]!.message).toContain('"?"');
    expect(dangling[0]!.relationshipId).toBeUndefined();
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
