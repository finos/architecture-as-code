import { describe, it, expect } from 'vitest';
import { detectCalmVersion, normalizeCalmDocument } from '@/lib/calm/normalizer';

// Helper: minimal v1.1 document
const minimalV11Doc = {
  nodes: [
    {
      'unique-id': 'node-1',
      'node-type': 'service',
      name: 'My Service',
      description: 'A service node',
    },
  ],
  relationships: [],
};

// Helper: minimal v1.0 document (uses calmSchemaVersion field)
const minimalV10DocWithSchemaVersion = {
  calmSchemaVersion: '1.0',
  name: 'My Architecture',
  nodes: [
    {
      name: 'API Gateway',
      type: 'apigateway',
      metadata: { description: 'The API gateway' },
    },
  ],
  relationships: [],
};

// Helper: v1.2 document with adrs field
const minimalV12DocWithAdrs = {
  nodes: [
    {
      'unique-id': 'node-1',
      'node-type': 'service',
      name: 'My Service',
      description: 'A service node',
    },
  ],
  relationships: [],
  adrs: ['https://example.com/adr/001'],
};

// Helper: v1.2 document with decorators field
const minimalV12DocWithDecorators = {
  nodes: [
    {
      'unique-id': 'node-1',
      'node-type': 'service',
      name: 'My Service',
      description: 'A service node',
    },
  ],
  relationships: [],
  decorators: { highlight: ['node-1'] },
};

describe('detectCalmVersion', () => {
  it('returns "1.0" for object with calmSchemaVersion field', () => {
    const result = detectCalmVersion(minimalV10DocWithSchemaVersion);
    expect(result).toBe('1.0');
  });

  it('returns "1.0" for object with legacy node types (type: "apigateway")', () => {
    const doc = {
      nodes: [{ name: 'Gateway', type: 'apigateway' }],
      relationships: [],
    };
    const result = detectCalmVersion(doc);
    expect(result).toBe('1.0');
  });

  it('returns "1.2" for object with adrs field', () => {
    const result = detectCalmVersion(minimalV12DocWithAdrs);
    expect(result).toBe('1.2');
  });

  it('returns "1.2" for object with decorators field', () => {
    const result = detectCalmVersion(minimalV12DocWithDecorators);
    expect(result).toBe('1.2');
  });

  it('returns "1.1" for standard v1.1 document (no version markers)', () => {
    const result = detectCalmVersion(minimalV11Doc);
    expect(result).toBe('1.1');
  });

  it('returns "1.1" for non-object input', () => {
    expect(detectCalmVersion(null)).toBe('1.1');
    expect(detectCalmVersion(undefined)).toBe('1.1');
    expect(detectCalmVersion('string')).toBe('1.1');
    expect(detectCalmVersion(42)).toBe('1.1');
    expect(detectCalmVersion([])).toBe('1.1');
  });
});

describe('normalizeCalmDocument', () => {
  it('returns input unchanged for v1.1', () => {
    const result = normalizeCalmDocument(minimalV11Doc, '1.1');
    expect(result).toBe(minimalV11Doc); // Same reference — not mutated
  });

  it('returns input unchanged for v1.2', () => {
    const result = normalizeCalmDocument(minimalV12DocWithAdrs, '1.2');
    expect(result).toBe(minimalV12DocWithAdrs); // Same reference — not mutated
  });

  it('maps v1.0 node type: "apigateway" to node-type: "service"', () => {
    const doc = {
      nodes: [{ name: 'Gateway', type: 'apigateway', metadata: { description: 'The gateway' } }],
      relationships: [],
    };
    const result = normalizeCalmDocument(doc, '1.0') as { nodes: Array<Record<string, unknown>> };
    expect(result.nodes[0]['node-type']).toBe('service');
  });

  it('maps v1.0 node type: "microservice" to node-type: "service"', () => {
    const doc = {
      nodes: [{ name: 'My Service', type: 'microservice', metadata: { description: 'A service' } }],
      relationships: [],
    };
    const result = normalizeCalmDocument(doc, '1.0') as { nodes: Array<Record<string, unknown>> };
    expect(result.nodes[0]['node-type']).toBe('service');
  });

  it('uses name as unique-id fallback for v1.0 nodes', () => {
    const doc = {
      nodes: [{ name: 'API Gateway', type: 'apigateway', metadata: { description: 'Gateway' } }],
      relationships: [],
    };
    const result = normalizeCalmDocument(doc, '1.0') as { nodes: Array<Record<string, unknown>> };
    expect(result.nodes[0]['unique-id']).toBe('API Gateway');
  });

  it('extracts description from metadata.description for v1.0 nodes', () => {
    const doc = {
      nodes: [{ name: 'My Node', type: 'microservice', metadata: { description: 'Node description here' } }],
      relationships: [],
    };
    const result = normalizeCalmDocument(doc, '1.0') as { nodes: Array<Record<string, unknown>> };
    expect(result.nodes[0]['description']).toBe('Node description here');
  });

  it('converts v1.0 { from, to, type: "uses" } relationship to connects structure', () => {
    const doc = {
      nodes: [
        { name: 'Client', type: 'actor', metadata: { description: 'A client' } },
        { name: 'API', type: 'apigateway', metadata: { description: 'An API' } },
      ],
      relationships: [{ from: 'Client', to: 'API', type: 'uses' }],
    };
    const result = normalizeCalmDocument(doc, '1.0') as {
      relationships: Array<Record<string, unknown>>;
    };
    const rel = result.relationships[0] as Record<string, unknown>;
    expect(rel['relationship-type']).toBe('connects');
    const connects = rel['connects'] as Record<string, unknown>;
    expect((connects['source'] as Record<string, unknown>)['node']).toBe('Client');
    expect((connects['destination'] as Record<string, unknown>)['node']).toBe('API');
  });

  it('generates unique-id as "rel-{index}" for v1.0 relationships without one', () => {
    const doc = {
      nodes: [
        { name: 'A', type: 'microservice', metadata: { description: 'Service A' } },
        { name: 'B', type: 'microservice', metadata: { description: 'Service B' } },
      ],
      relationships: [{ from: 'A', to: 'B', type: 'uses' }],
    };
    const result = normalizeCalmDocument(doc, '1.0') as {
      relationships: Array<Record<string, unknown>>;
    };
    expect(result.relationships[0]['unique-id']).toBe('rel-0');
  });

  it('maps unknown node types (e.g., "lambda") to "service"', () => {
    const doc = {
      nodes: [{ name: 'Lambda Fn', type: 'lambda', metadata: { description: 'A lambda function' } }],
      relationships: [],
    };
    const result = normalizeCalmDocument(doc, '1.0') as { nodes: Array<Record<string, unknown>> };
    expect(result.nodes[0]['node-type']).toBe('service');
  });

  it('strips calmSchemaVersion from normalized v1.0 output to prevent re-detection', () => {
    const doc = {
      calmSchemaVersion: '1.0',
      nodes: [{ name: 'Svc', type: 'microservice', metadata: { description: 'A service' } }],
      relationships: [],
    };
    const result = normalizeCalmDocument(doc, '1.0') as Record<string, unknown>;
    expect(result).not.toHaveProperty('calmSchemaVersion');
    // Re-detecting version on normalized output should no longer return v1.0
    expect(detectCalmVersion(result)).toBe('1.1');
  });

  it('survives double-normalization: already-normalized v1.0 doc re-detected as v1.0 preserves connects', () => {
    // Simulates the roundtrip bug: fetch-calm normalizes v1.0 → client stores CalmDocument
    // (still has calmSchemaVersion) → sends to /api/analyze → parseCalm detects v1.0 again
    const v10Doc = {
      calmSchemaVersion: '1.0',
      nodes: [
        { name: 'API Gateway', type: 'apigateway', metadata: { description: 'Gateway' } },
        { name: 'Customer Service', type: 'microservice', metadata: { description: 'Service' } },
      ],
      relationships: [{ from: 'API Gateway', to: 'Customer Service', type: 'uses' }],
    };

    // First normalization (happens in fetch-calm route)
    const firstPass = normalizeCalmDocument(v10Doc, '1.0') as Record<string, unknown>;
    const firstRels = (firstPass['relationships'] as Array<Record<string, unknown>>);
    const firstConnects = firstRels[0]['connects'] as Record<string, unknown>;
    expect((firstConnects['source'] as Record<string, unknown>)['node']).toBe('API Gateway');
    expect((firstConnects['destination'] as Record<string, unknown>)['node']).toBe('Customer Service');

    // Second normalization attempt — calmSchemaVersion is stripped, so it detects as v1.1 (pass-through)
    const secondVersion = detectCalmVersion(firstPass);
    expect(secondVersion).toBe('1.1'); // Fixed: calmSchemaVersion stripped, no longer re-triggers v1.0

    const secondPass = normalizeCalmDocument(firstPass, secondVersion) as Record<string, unknown>;
    const secondRels = (secondPass['relationships'] as Array<Record<string, unknown>>);
    const secondConnects = secondRels[0]['connects'] as Record<string, unknown>;

    // These MUST still be valid after double-normalization
    expect((secondConnects['source'] as Record<string, unknown>)['node']).toBe('API Gateway');
    expect((secondConnects['destination'] as Record<string, unknown>)['node']).toBe('Customer Service');
  });
});
