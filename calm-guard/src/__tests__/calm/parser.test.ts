import { describe, it, expect } from 'vitest';
import { parseCalm, parseCalmFromString } from '@/lib/calm/parser';
import type { CalmDocument } from '@/lib/calm/types';

// Minimal valid CALM node fixture factory
function makeNode(
  id: string,
  nodeType: string,
  name = 'Test Node',
  description = 'A test node'
) {
  return {
    'unique-id': id,
    'node-type': nodeType,
    name,
    description,
  };
}

// Minimal valid CALM document with one node and no relationships
function makeMinimalDoc(overrides: Partial<CalmDocument> = {}): unknown {
  return {
    nodes: [makeNode('node-1', 'service')],
    relationships: [],
    ...overrides,
  };
}

describe('parseCalm', () => {
  it('parses a valid minimal CALM document with one node', () => {
    const result = parseCalm(makeMinimalDoc());

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.data.nodes).toHaveLength(1);
    expect(result.data.nodes[0]['unique-id']).toBe('node-1');
  });

  it('rejects a document with an empty nodes array', () => {
    const result = parseCalm({ nodes: [], relationships: [] });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it('rejects a document with an invalid node-type', () => {
    const result = parseCalm({
      nodes: [makeNode('n1', 'invalid-type')],
      relationships: [],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it('accepts all 9 valid CALM node types', () => {
    const nodeTypes = [
      'actor',
      'ecosystem',
      'system',
      'service',
      'database',
      'network',
      'ldap',
      'webclient',
      'data-asset',
    ] as const;

    for (const nodeType of nodeTypes) {
      const result = parseCalm({
        nodes: [makeNode(`node-${nodeType}`, nodeType, `${nodeType} Node`, `A ${nodeType} node`)],
        relationships: [],
      });

      expect(result.success, `Expected node-type '${nodeType}' to be valid`).toBe(true);
    }
  });
});

describe('parseCalmFromString', () => {
  it('parses a valid JSON string into a CALM document', () => {
    const jsonString = JSON.stringify(makeMinimalDoc());

    const result = parseCalmFromString(jsonString);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.data.nodes).toHaveLength(1);
  });

  it('returns an error for malformed (non-JSON) input', () => {
    const result = parseCalmFromString('this is not valid { json at all');

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    // The error message should indicate a JSON parsing issue
    expect(result.error.message.toLowerCase()).toContain('json');
  });
});

// --- Multi-version support tests ---

// Minimal v1.0 document with calmSchemaVersion and legacy types
const v10Doc = {
  calmSchemaVersion: '1.0',
  name: 'API Gateway Architecture',
  nodes: [
    { name: 'api-gateway', type: 'apigateway', metadata: { description: 'The API gateway' } },
    { name: 'customer-service', type: 'microservice', metadata: { description: 'Customer service' } },
  ],
  relationships: [
    { from: 'api-gateway', to: 'customer-service', type: 'uses' },
  ],
};

// Minimal v1.2 document with extra fields
const v12Doc = {
  nodes: [makeNode('node-1', 'service', 'Service A', 'A service')],
  relationships: [],
  adrs: ['https://example.com/adr/001', 'https://example.com/adr/002'],
  decorators: { highlight: ['node-1'] },
  timelines: [{ label: 'Phase 1', nodes: ['node-1'] }],
};

describe('parseCalm — version field (multi-version support)', () => {
  it('returns version "1.1" for standard v1.1 document (regression)', () => {
    const result = parseCalm(makeMinimalDoc());

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.version).toBe('1.1');
  });

  it('successfully parses a v1.0 document with legacy node types and returns version "1.0"', () => {
    const result = parseCalm(v10Doc);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.version).toBe('1.0');
  });

  it('maps v1.0 apigateway nodes to service node-type in parsed output', () => {
    const result = parseCalm(v10Doc);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    const gatewayNode = result.data.nodes.find(n => n['unique-id'] === 'api-gateway');
    expect(gatewayNode).toBeDefined();
    expect(gatewayNode?.['node-type']).toBe('service');
  });

  it('maps v1.0 "uses" relationships to connects in parsed output', () => {
    const result = parseCalm(v10Doc);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    const rel = result.data.relationships[0];
    expect(rel['relationship-type']).toBe('connects');
  });

  it('successfully parses a v1.2 document with adrs, decorators, timelines and returns version "1.2"', () => {
    const result = parseCalm(v12Doc);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.version).toBe('1.2');
  });

  it('preserves v1.2 adrs array in parsed output', () => {
    const result = parseCalm(v12Doc);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.data.adrs).toEqual(['https://example.com/adr/001', 'https://example.com/adr/002']);
  });

  it('parseCalmFromString returns version field on success', () => {
    const result = parseCalmFromString(JSON.stringify(v10Doc));

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.version).toBe('1.0');
  });
});

// --- Canonical (nested) relationship-type tests ---

// Canonical CALM relationships, as defined by calm/release/1.x/meta/core.json:
// `relationship-type` is an object holding exactly one keyed variant.
const canonicalNodes = [
  makeNode('user', 'actor', 'User', 'A user'),
  makeNode('a', 'service', 'A', 'Service A'),
  makeNode('b', 'database', 'B', 'Database B'),
  makeNode('cluster', 'system', 'Cluster', 'A cluster'),
];

const canonicalRelationships = [
  {
    'unique-id': 'a-to-b',
    description: 'A reads from B',
    protocol: 'JDBC',
    'relationship-type': {
      connects: {
        source: { node: 'a' },
        destination: { node: 'b', interfaces: ['jdbc'] },
      },
    },
  },
  {
    'unique-id': 'user-uses-a',
    'relationship-type': { interacts: { actor: 'user', nodes: ['a'] } },
  },
  {
    'unique-id': 'a-in-cluster',
    'relationship-type': { 'deployed-in': { container: 'cluster', nodes: ['a', 'b'] } },
  },
  {
    'unique-id': 'cluster-has-a',
    'relationship-type': { 'composed-of': { container: 'cluster', nodes: ['a'] } },
  },
];

describe('parseCalm — canonical nested relationship-type', () => {
  it('parses a canonical connects relationship', () => {
    const result = parseCalm({ nodes: canonicalNodes, relationships: [canonicalRelationships[0]] });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    const rel = result.data.relationships[0];
    expect(rel['relationship-type']).toBe('connects');
    if (rel['relationship-type'] !== 'connects') throw new Error('Expected connects');
    expect(rel.connects.source.node).toBe('a');
    expect(rel.connects.destination).toEqual({ node: 'b', interfaces: ['jdbc'] });
    expect(rel.protocol).toBe('JDBC');
    expect(rel.description).toBe('A reads from B');
  });

  it('parses canonical interacts, deployed-in and composed-of relationships', () => {
    const result = parseCalm({ nodes: canonicalNodes, relationships: canonicalRelationships });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.data.relationships.map(r => r['relationship-type'])).toEqual([
      'connects',
      'interacts',
      'deployed-in',
      'composed-of',
    ]);
    const interacts = result.data.relationships[1];
    if (interacts['relationship-type'] !== 'interacts') throw new Error('Expected interacts');
    expect(interacts.interacts).toEqual({ actor: 'user', nodes: ['a'] });
  });

  it('parses a canonical options relationship', () => {
    const options = [{ description: 'Option 1', nodes: ['a'], relationships: [] }];
    const result = parseCalm({
      nodes: canonicalNodes,
      relationships: [{ 'unique-id': 'choice', 'relationship-type': { options } }],
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    const rel = result.data.relationships[0];
    if (rel['relationship-type'] !== 'options') throw new Error('Expected options');
    expect(rel.options).toEqual(options);
  });

  it('parses a v1.2 document with canonical relationships', () => {
    const result = parseCalm({ ...v12Doc, nodes: canonicalNodes, relationships: canonicalRelationships });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.version).toBe('1.2');
    expect(result.data.relationships).toHaveLength(4);
  });

  it('does not mutate the input document', () => {
    const input = { nodes: canonicalNodes, relationships: [canonicalRelationships[0]] };
    const before = JSON.parse(JSON.stringify(input));

    parseCalm(input);

    expect(input).toEqual(before);
  });

  it('rejects a canonical relationship with an unknown relationship-type key', () => {
    const result = parseCalm({
      nodes: canonicalNodes,
      relationships: [{ 'unique-id': 'bad', 'relationship-type': { 'depends-on': { nodes: ['a'] } } }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a canonical relationship-type with more than one variant', () => {
    const result = parseCalm({
      nodes: canonicalNodes,
      relationships: [
        {
          'unique-id': 'bad',
          'relationship-type': {
            interacts: { actor: 'user', nodes: ['a'] },
            'composed-of': { container: 'cluster', nodes: ['a'] },
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a canonical connects relationship that is missing its destination', () => {
    const result = parseCalm({
      nodes: canonicalNodes,
      relationships: [
        { 'unique-id': 'bad', 'relationship-type': { connects: { source: { node: 'a' } } } },
      ],
    });

    expect(result.success).toBe(false);
  });
});
