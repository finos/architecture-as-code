/**
 * API Route SSE Streaming Tests: POST /api/analyze
 *
 * Tests the analyze route handler directly by constructing NextRequest objects
 * and calling the exported POST function. All LLM calls are mocked so no API
 * keys are required in the test environment.
 *
 * Verifies:
 * 1. Response Content-Type is text/event-stream for valid CALM documents
 * 2. Response body is a readable stream that yields SSE-formatted data
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---- Mocks (declared before imports that trigger module resolution) ----

// Mock the AI provider — prevents "no API keys" error at module init
vi.mock('@/lib/ai/provider', () => ({
  getDefaultModel: vi.fn(() => 'mock-model'),
  getModelForAgent: vi.fn(() => 'mock-model'),
  registry: {},
}));

// Mock generateObject from 'ai' SDK — prevents real LLM calls
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateObject: vi.fn(),
    createProviderRegistry: vi.fn(() => ({})),
  };
});

// Mock the agent registry — prevents reading YAML files from disk
vi.mock('@/lib/agents/registry', () => ({
  loadAgentConfig: vi.fn(() => ({
    apiVersion: 'agent/v1alpha1',
    kind: 'Agent',
    metadata: {
      name: 'mock-agent',
      displayName: 'Mock Agent',
      icon: 'cpu',
      color: 'blue',
    },
    spec: {
      role: 'Mock agent role',
      model: { provider: 'google', model: 'gemini-2.5-flash', temperature: 0.3 },
      skills: [],
      inputs: [{ type: 'AnalysisInput' }],
      outputs: [{ type: 'MockOutput' }],
      maxTokens: 1000,
    },
  })),
  loadAllAgentConfigs: vi.fn(() => new Map()),
  clearConfigCache: vi.fn(),
}));

// Mock skills loader — prevents reading .md files from disk
vi.mock('@/lib/skills/loader', () => ({
  loadSkillsForAgent: vi.fn(() => 'Mock compliance skills content'),
}));

// Mock all 4 agent modules — each returns a fixture result.
// IMPORTANT: spread actual module to keep real Zod schemas intact — orchestrator.ts imports
// architectureAnalysisSchema/complianceMappingSchema/pipelineConfigSchema at module level
// to build analysisResultSchema. Replacing them with {} breaks .nullable() calls.
vi.mock('@/lib/agents/architecture-analyzer', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/architecture-analyzer')>(
    '@/lib/agents/architecture-analyzer'
  );
  return {
    ...actual,
    analyzeArchitecture: vi.fn(async () => ({
      agentName: 'architecture-analyzer',
      success: true,
      data: {
        components: [],
        dataFlows: [],
        trustBoundaries: [],
        securityZones: [],
        findings: [],
        summary: 'Mock architecture summary',
      },
      duration: 100,
    })),
  };
});

vi.mock('@/lib/agents/compliance-mapper', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/compliance-mapper')>(
    '@/lib/agents/compliance-mapper'
  );
  return {
    ...actual,
    mapCompliance: vi.fn(async () => ({
      agentName: 'compliance-mapper',
      success: true,
      data: {
        frameworkMappings: [],
        frameworkScores: [],
        gaps: [],
        summary: 'Mock compliance summary',
      },
      duration: 100,
    })),
  };
});

vi.mock('@/lib/agents/pipeline-generator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/pipeline-generator')>(
    '@/lib/agents/pipeline-generator'
  );
  return {
    ...actual,
    generatePipeline: vi.fn(async () => ({
      agentName: 'pipeline-generator',
      success: true,
      data: {
        githubActions: { name: 'CI', yaml: 'name: CI\n' },
        securityScanning: { tools: [], summary: 'Mock scanning' },
        infrastructureAsCode: { provider: 'terraform', config: '' },
        recommendations: [],
        summary: 'Mock pipeline summary',
      },
      duration: 100,
    })),
  };
});

vi.mock('@/lib/agents/cloud-infra-generator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/cloud-infra-generator')>(
    '@/lib/agents/cloud-infra-generator'
  );
  return {
    ...actual,
    generateCloudInfra: vi.fn(async () => ({
      agentName: 'cloud-infra-generator',
      success: true,
      data: {
        terraform: {
          modules: [{ filename: 'terraform/main.tf', content: 'resource "aws_vpc" {}', calmSignal: 'network' }],
        },
        traceability: [],
        summary: 'Mock cloud infra summary',
      },
      duration: 100,
    })),
  };
});

vi.mock('@/lib/agents/risk-scorer', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/risk-scorer')>(
    '@/lib/agents/risk-scorer'
  );
  return {
    ...actual,
    scoreRisk: vi.fn(async () => ({
      agentName: 'risk-scorer',
      success: true,
      data: {
        overallScore: 75,
        overallRating: 'medium',
        frameworkScores: [],
        nodeRiskMap: [],
        topFindings: [],
        summary: 'Mock risk summary',
        executiveSummary: 'Mock executive summary',
      },
      duration: 100,
    })),
  };
});

// ---- Import handler AFTER mocks are declared ----
import { POST } from '@/app/api/analyze/route';

// ---- Fixtures ----

function makeMinimalCalmDoc() {
  return {
    nodes: [
      {
        'unique-id': 'svc-1',
        'node-type': 'service',
        name: 'Test Service',
        description: 'A test service node',
      },
    ],
    relationships: [],
  };
}

function makeAnalyzeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---- Tests ----

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Content-Type text/event-stream for a valid CALM document', async () => {
    const req = makeAnalyzeRequest({ calm: makeMinimalCalmDoc() });

    const response = await POST(req);

    // Must be a streaming response, not an error JSON
    const contentType = response.headers.get('Content-Type') ?? '';
    expect(contentType).toContain('text/event-stream');
  });

  it('returns a ReadableStream body that yields SSE data frames', async () => {
    const req = makeAnalyzeRequest({ calm: makeMinimalCalmDoc() });

    const response = await POST(req);

    // Body must be a ReadableStream (not null)
    expect(response.body).toBeTruthy();

    // Read the full stream and verify it contains SSE-formatted data
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    // Read until stream closes (mocked agents return immediately)
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      done = chunk.done;
      if (chunk.value) {
        accumulated += decoder.decode(chunk.value, { stream: !done });
      }
    }

    // SSE frames start with "data: " and end with "\n\n"
    expect(accumulated).toContain('data: ');

    // The final event should be either a 'done' or 'error' terminal event
    const hasTerminalEvent =
      accumulated.includes('"type":"done"') ||
      accumulated.includes('"type":"error"');
    expect(hasTerminalEvent).toBe(true);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid { json',
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.error).toBe('string');
  });

  it('returns 400 for missing calm field in request body', async () => {
    const req = makeAnalyzeRequest({ wrongField: 'no calm here' });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.error).toBe('string');
  });
});
