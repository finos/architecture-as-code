import { describe, it, expect } from 'vitest';
import { extractAnalysisInput } from '@/lib/calm/extractor';
import type { CalmDocument } from '@/lib/calm/types';

// Minimal valid CALM document with one service node
const minimalDoc: CalmDocument = {
  nodes: [
    {
      'unique-id': 'api-service',
      'node-type': 'service',
      name: 'API Service',
      description: 'Core API service',
    },
  ],
  relationships: [],
};

// CALM document with a connects relationship between two services
const docWithRelationships: CalmDocument = {
  nodes: [
    {
      'unique-id': 'web-client',
      'node-type': 'webclient',
      name: 'Web Client',
      description: 'Browser-based client',
    },
    {
      'unique-id': 'api-gateway',
      'node-type': 'service',
      name: 'API Gateway',
      description: 'API Gateway service',
    },
  ],
  relationships: [
    {
      'unique-id': 'conn-web-api',
      'relationship-type': 'connects',
      protocol: 'HTTPS',
      connects: {
        source: { node: 'web-client' },
        destination: { node: 'api-gateway' },
      },
    },
  ],
};

describe('extractAnalysisInput', () => {
  it('extracts nodes and metadata from a minimal CALM document', () => {
    const input = extractAnalysisInput(minimalDoc);

    expect(input.nodes).toHaveLength(1);
    expect(input.nodes[0]['unique-id']).toBe('api-service');
    expect(input.relationships).toHaveLength(0);
    expect(input.metadata.nodeCount).toBe(1);
    expect(input.metadata.relationshipCount).toBe(0);
    expect(input.metadata.nodeTypes['service']).toBe(1);
  });

  it('extracts relationships and protocols from a document with connects relationships', () => {
    const input = extractAnalysisInput(docWithRelationships);

    expect(input.nodes).toHaveLength(2);
    expect(input.relationships).toHaveLength(1);
    expect(input.metadata.nodeCount).toBe(2);
    expect(input.metadata.relationshipCount).toBe(1);
    expect(input.metadata.relationshipTypes['connects']).toBe(1);
    expect(input.metadata.protocols).toContain('HTTPS');
    expect(input.metadata.nodeTypes['webclient']).toBe(1);
    expect(input.metadata.nodeTypes['service']).toBe(1);
  });
});
