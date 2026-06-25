// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { validateCalmArchitecture, validateDecorators, type ValidationIssue } from './validation.js';
import type { CalmArchitecture, CalmDecorator, CalmRelationship } from './types.js';

// Helper: make a minimal valid node
function makeNode(id: string, name: string, description?: string) {
  return {
    'unique-id': id,
    'node-type': 'service' as const,
    name,
    description: description ?? `Description for ${name}`
  };
}

// Helper: make a minimal valid relationship in CALM 1.2 nested `connects` form.
function makeRel(id: string, sourceNode: string, destNode: string): CalmRelationship {
  return {
    'unique-id': id,
    'relationship-type': {
      connects: {
        source: { node: sourceNode },
        destination: { node: destNode }
      }
    }
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
    // A relationship with no relationship-type object at all is a schema violation.
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        {
          'unique-id': 'rel-bad'
          // missing relationship-type entirely
        }
      ]
    } as unknown as CalmArchitecture;
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

  it('connects relationship missing source.node returns error', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        {
          'unique-id': 'rel-1',
          'relationship-type': {
            connects: { destination: { node: 'node-a' } }
          }
        }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) => i.severity === 'error' && i.relationshipId === 'rel-1'
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('connects relationship missing destination.node returns error', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        {
          'unique-id': 'rel-1',
          'relationship-type': {
            connects: { source: { node: 'node-a' } }
          }
        }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) => i.severity === 'error' && i.relationshipId === 'rel-1'
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('dangling destination reference returns error', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [makeRel('rel-1', 'node-a', 'ghost-node')]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) =>
        i.severity === 'error' &&
        i.message.includes('ghost-node') &&
        i.relationshipId === 'rel-1'
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('duplicate relationship unique-ids returns error', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('node-a', 'Node A'), makeNode('node-b', 'Node B')],
      relationships: [
        makeRel('rel-dup', 'node-a', 'node-b'),
        makeRel('rel-dup', 'node-b', 'node-a')
      ]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('Duplicate relationship')
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.relationshipId).toBe('rel-dup');
  });

  it('relationship without unique-id still surfaces dangling-ref error using "?"', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        {
          'relationship-type': {
            connects: { source: { node: 'node-a' }, destination: { node: 'ghost' } }
          }
        }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const danglingErrors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('"?"')
    );
    expect(danglingErrors.length).toBeGreaterThan(0);
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
    const dupErrors = issues.filter((i) => i.message.includes('Duplicate node'));
    expect(dupErrors).toHaveLength(0);
  });

  it('node with empty/whitespace description returns info', () => {
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

  it('dangling ref with zero nodes does not report dangling ref', () => {
    const arch = {
      nodes: [],
      relationships: [
        {
          'unique-id': 'rel-1',
          'relationship-type': {
            connects: { source: { node: 'x' }, destination: { node: 'y' } }
          }
        }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const danglingErrors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('references unknown node')
    );
    expect(danglingErrors).toHaveLength(0);
  });

  it('self-loop without relId uses "?" and omits relationshipId', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        {
          'relationship-type': {
            connects: { source: { node: 'node-a' }, destination: { node: 'node-a' } }
          }
        }
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
        { 'unique-id': 'node-a', 'node-type': 'service' as const, name: 'A', description: '' },
        { 'unique-id': 'node-b', 'node-type': 'service' as const, name: 'B', description: '' }
      ],
      relationships: [makeRel('rel-1', 'node-a', 'ghost')] // error: dangling
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
        { 'relationship-type': {} } // empty variant object: schema violation, no unique-id
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const relSchemaErrors = issues.filter(
      (i) => i.severity === 'error' && i.path?.startsWith('/relationships/')
    );
    expect(relSchemaErrors.length).toBeGreaterThan(0);
    expect(relSchemaErrors[0]!.relationshipId).toBeUndefined();
  });

  it('dangling source ref without relId uses "?" and omits relationshipId', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        {
          'relationship-type': {
            connects: { source: { node: 'ghost' }, destination: { node: 'node-a' } }
          }
        }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const dangling = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('ghost')
    );
    expect(dangling.length).toBeGreaterThan(0);
    expect(dangling[0]!.message).toContain('"?"');
    expect(dangling[0]!.relationshipId).toBeUndefined();
  });

  it('dangling destination ref without relId uses "?" and omits relationshipId', () => {
    const arch = {
      nodes: [makeNode('node-a', 'Node A')],
      relationships: [
        {
          'relationship-type': {
            connects: { source: { node: 'node-a' }, destination: { node: 'ghost' } }
          }
        }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const dangling = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('ghost')
    );
    expect(dangling.length).toBeGreaterThan(0);
    expect(dangling[0]!.message).toContain('"?"');
    expect(dangling[0]!.relationshipId).toBeUndefined();
  });

  it('ValidationIssue includes optional path, nodeId, relationshipId fields', () => {
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

  // ─── New tests covering CALM 1.2 nested variants ─────────────────────────

  it('composed-of variant: container + nodes are resolved as referenced nodes', () => {
    const arch: CalmArchitecture = {
      nodes: [
        makeNode('container', 'Container'),
        makeNode('child-a', 'Child A'),
        makeNode('child-b', 'Child B')
      ],
      relationships: [
        {
          'unique-id': 'co-1',
          'relationship-type': {
            'composed-of': {
              container: 'container',
              nodes: ['child-a', 'child-b']
            }
          }
        }
      ]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
    const orphans = issues.filter(
      (i) =>
        i.severity === 'warning' &&
        i.message.includes('not referenced by any relationship')
    );
    expect(orphans).toHaveLength(0);
  });

  it('composed-of variant: dangling child node returns error', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('container', 'Container'), makeNode('child-a', 'Child A')],
      relationships: [
        {
          'unique-id': 'co-dangling',
          'relationship-type': {
            'composed-of': {
              container: 'container',
              nodes: ['child-a', 'ghost-child']
            }
          }
        }
      ]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) => i.severity === 'error' && i.message.includes('ghost-child')
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.relationshipId).toBe('co-dangling');
  });

  it('interacts variant: actor + nodes are resolved as referenced nodes', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('actor', 'Actor'), makeNode('app', 'Application')],
      relationships: [
        {
          'unique-id': 'i-1',
          'relationship-type': {
            interacts: {
              actor: 'actor',
              nodes: ['app']
            }
          }
        }
      ]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('deployed-in variant: container + nodes are resolved as referenced nodes', () => {
    const arch: CalmArchitecture = {
      nodes: [makeNode('cluster', 'Cluster'), makeNode('pod-1', 'Pod 1')],
      relationships: [
        {
          'unique-id': 'd-1',
          'relationship-type': {
            'deployed-in': {
              container: 'cluster',
              nodes: ['pod-1']
            }
          }
        }
      ]
    };
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('composed-of with empty nodes array returns error', () => {
    const arch = {
      nodes: [makeNode('container', 'Container')],
      relationships: [
        {
          'unique-id': 'co-empty',
          'relationship-type': {
            'composed-of': { container: 'container', nodes: [] }
          }
        }
      ]
    } as unknown as CalmArchitecture;
    const issues = validateCalmArchitecture(arch);
    const errors = issues.filter(
      (i) => i.severity === 'error' && i.relationshipId === 'co-empty'
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('validateDecorators', () => {
  const arch: CalmArchitecture = {
    nodes: [makeNode('vector-store', 'Vector Store')],
    relationships: []
  };
  const dec = (over: Partial<CalmDecorator> = {}): CalmDecorator => ({
    'unique-id': 'd1',
    type: 'gemara-link',
    target: ['arch.json'],
    'applies-to': ['vector-store'],
    data: { k: 1 },
    ...over
  });

  it('passes a well-formed decorator that resolves', () => {
    expect(validateDecorators([dec()], arch)).toHaveLength(0);
  });

  it('warns (not errors) when applies-to does not resolve', () => {
    const issues = validateDecorators([dec({ 'applies-to': ['nope'] })], arch);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toMatch(/applies-to "nope"/);
  });

  it('skips the @architecture whole-document sentinel', () => {
    expect(validateDecorators([dec({ 'applies-to': ['@architecture'] })], arch)).toHaveLength(0);
  });

  it('errors on empty target and empty applies-to', () => {
    const issues = validateDecorators([dec({ target: [], 'applies-to': [] })], arch);
    const errs = issues.filter((i) => i.severity === 'error');
    expect(errs.some((i) => /must target at least one document/.test(i.message))).toBe(true);
    expect(errs.some((i) => /must apply to at least one element/.test(i.message))).toBe(true);
  });

  it('errors on empty data object', () => {
    const issues = validateDecorators([dec({ data: {} })], arch);
    expect(issues.some((i) => i.severity === 'error' && /data must be a non-empty object/.test(i.message))).toBe(true);
  });

  it('errors on duplicate decorator unique-ids', () => {
    const issues = validateDecorators([dec(), dec()], arch);
    expect(issues.some((i) => i.severity === 'error' && /Duplicate decorator unique-id/.test(i.message))).toBe(true);
  });

  it('resolves applies-to against relationships and flows, not just nodes', () => {
    const a = {
      nodes: [makeNode('n1', 'N1')],
      relationships: [makeRel('r1', 'n1', 'n1')],
      flows: [{ 'unique-id': 'f1', name: 'Flow', description: 'd', transitions: [] }]
    } as unknown as CalmArchitecture;
    expect(validateDecorators([dec({ 'applies-to': ['r1', 'f1'] })], a)).toHaveLength(0);
  });
});
