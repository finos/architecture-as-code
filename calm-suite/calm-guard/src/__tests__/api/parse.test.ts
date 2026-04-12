/**
 * API Route Contract Tests: POST /api/calm/parse
 *
 * Tests the parse route handler directly by constructing NextRequest objects
 * and calling the exported POST function. No HTTP server needed.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/calm/parse/route';

// Minimal valid CALM node fixture
function makeNode(id: string, nodeType: string) {
  return {
    'unique-id': id,
    'node-type': nodeType,
    name: `${nodeType} node`,
    description: `A ${nodeType} node for testing`,
  };
}

// Minimal valid CALM document
function makeMinimalCalmDoc() {
  return {
    nodes: [makeNode('svc-1', 'service')],
    relationships: [],
  };
}

// Build a NextRequest with JSON body for POST /api/calm/parse
function makeParseRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/calm/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/calm/parse', () => {
  it('returns 200 with success=true and data shape for a valid CALM document', async () => {
    const req = makeParseRequest({ calm: makeMinimalCalmDoc() });

    const response = await POST(req);

    expect(response.status).toBe(200);

    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);

    // Response must have data with the AnalysisInput shape
    const data = body.data as Record<string, unknown>;
    expect(data).toBeDefined();
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(Array.isArray(data.relationships)).toBe(true);
    expect(typeof data.controls).toBe('object');
    expect(Array.isArray(data.flows)).toBe(true);

    const metadata = data.metadata as Record<string, unknown>;
    expect(typeof metadata.nodeCount).toBe('number');
    expect(typeof metadata.relationshipCount).toBe('number');
    expect(metadata.nodeCount).toBe(1);
    expect(metadata.relationshipCount).toBe(0);
  });

  it('returns 400 with error message for an invalid CALM document (missing required fields)', async () => {
    // A document with nodes that have no 'unique-id' — violates CALM schema
    const invalidCalm = {
      nodes: [{ 'node-type': 'service', name: 'Missing ID' }],
      relationships: [],
    };

    const req = makeParseRequest({ calm: invalidCalm });

    const response = await POST(req);

    expect(response.status).toBe(400);

    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.error).toBe('string');
    // Error must be a non-empty string indicating what went wrong
    expect((body.error as string).length).toBeGreaterThan(0);
  });

  it('returns 400 for missing calm field in request body', async () => {
    // Request body missing the required 'calm' field
    const req = makeParseRequest({ notCalm: 'this is wrong' });

    const response = await POST(req);

    expect(response.status).toBe(400);

    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.error).toBe('string');
  });

  it('returns 400 for invalid JSON body', async () => {
    // Send a request with non-JSON body
    const req = new NextRequest('http://localhost/api/calm/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is { not valid json',
    });

    const response = await POST(req);

    expect(response.status).toBe(400);

    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.error).toBe('string');
  });
});
