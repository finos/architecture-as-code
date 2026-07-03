/**
 * Orchestrator Flow Tests
 *
 * Verifies that runAnalysis() executes agents in the correct order:
 * - Phase 1 (parallel): architecture-analyzer, compliance-mapper, pipeline-generator
 * - Phase 2 (sequential): risk-scorer (receives Phase 1 results as input)
 *
 * All 4 agent modules are mocked. No real LLM calls. No API keys needed.
 *
 * TEST-05: Dashboard component tests deferred to post-hackathon
 * (async server components not testable in jsdom)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ---- Mocks (declared before any imports that trigger module resolution) ----

// Mock the AI provider — prevents "no API keys" error
vi.mock('@/lib/ai/provider', () => ({
  getDefaultModel: vi.fn(() => 'mock-model'),
  getModelForAgent: vi.fn(() => 'mock-model'),
  registry: {},
}));

// Mock generateObject — prevents real LLM calls
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateObject: vi.fn(),
    createProviderRegistry: vi.fn(() => ({})),
  };
});

// Mock the agent registry — prevents YAML file reads
vi.mock('@/lib/agents/registry', () => ({
  loadAgentConfig: vi.fn(() => ({
    apiVersion: 'agent/v1alpha1',
    kind: 'Agent',
    metadata: {
      name: 'orchestrator',
      displayName: 'Orchestrator',
      icon: 'layers',
      color: 'slate',
    },
    spec: {
      role: 'Orchestrator role',
      model: { provider: 'google', model: 'gemini-2.5-flash', temperature: 0.1 },
      skills: [],
      inputs: [{ type: 'AnalysisInput' }],
      outputs: [{ type: 'AnalysisResult' }],
      maxTokens: 500,
    },
  })),
  loadAllAgentConfigs: vi.fn(() => new Map()),
  clearConfigCache: vi.fn(),
}));

// Mock skills loader
vi.mock('@/lib/skills/loader', () => ({
  loadSkillsForAgent: vi.fn(() => 'Mock skills'),
}));

// ---- Agent mock fixtures ----

const mockArchitectureResult = {
  agentName: 'architecture-analyzer',
  success: true,
  data: {
    components: [
      {
        nodeId: 'svc-1',
        name: 'Test Service',
        type: 'service' as const,
        description: 'Test service component',
        securityControls: [],
      },
    ],
    dataFlows: [],
    trustBoundaries: [],
    securityZones: [],
    findings: [],
    summary: 'Architecture analysis complete',
  },
  duration: 50,
};

const mockComplianceResult = {
  agentName: 'compliance-mapper',
  success: true,
  data: {
    frameworkMappings: [],
    frameworkScores: [
      {
        framework: 'SOX' as const,
        score: 80,
        totalControls: 5,
        compliantControls: 4,
        partialControls: 1,
        nonCompliantControls: 0,
      },
    ],
    gaps: [],
    summary: 'Compliance mapping complete',
  },
  duration: 60,
};

const mockPipelineResult = {
  agentName: 'pipeline-generator',
  success: true,
  data: {
    githubActions: { name: 'CI/CD Pipeline', yaml: 'name: CI\n' },
    securityScanning: {
      tools: [
        {
          name: 'semgrep' as const,
          description: 'Static analysis',
          config: '.semgrep.yml',
        },
      ],
      summary: 'Security scanning configured',
    },
    infrastructureAsCode: { provider: 'terraform' as const, config: 'resource "aws_vpc" {}' },
    recommendations: [],
    summary: 'Pipeline generation complete',
  },
  duration: 70,
};

const mockCloudInfraResult = {
  agentName: 'cloud-infra-generator',
  success: true,
  data: {
    terraform: {
      modules: [
        { filename: 'terraform/main.tf', content: 'resource "aws_vpc" {}', calmSignal: 'network topology' },
      ],
    },
    traceability: [
      { calmElement: 'svc-1', generatedResource: 'aws_ecs_service.svc_1', rationale: 'Maps service node to ECS' },
    ],
    summary: 'Cloud infra generation complete',
  },
  duration: 65,
};

const mockRiskResult = {
  agentName: 'risk-scorer',
  success: true,
  data: {
    overallScore: 75,
    overallRating: 'medium' as const,
    frameworkScores: [
      { framework: 'SOX' as const, score: 80, rating: 'low' as const },
    ],
    nodeRiskMap: [
      {
        nodeId: 'svc-1',
        nodeName: 'Test Service',
        riskLevel: 'low' as const,
        riskFactors: [],
        complianceGaps: 0,
      },
    ],
    topFindings: [],
    summary: 'Risk assessment complete',
    executiveSummary: 'Low overall risk.',
  },
  duration: 80,
};

// Mock each agent module with tracked mock functions.
// IMPORTANT: export the real Zod schemas alongside mocked functions —
// orchestrator.ts imports the schemas at module level (analysisResultSchema uses them),
// so mocking them as {} would cause ".nullable is not a function" errors.
vi.mock('@/lib/agents/architecture-analyzer', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/architecture-analyzer')>(
    '@/lib/agents/architecture-analyzer'
  );
  return {
    ...actual,
    analyzeArchitecture: vi.fn(async () => mockArchitectureResult),
  };
});

vi.mock('@/lib/agents/compliance-mapper', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/compliance-mapper')>(
    '@/lib/agents/compliance-mapper'
  );
  return {
    ...actual,
    mapCompliance: vi.fn(async () => mockComplianceResult),
  };
});

vi.mock('@/lib/agents/pipeline-generator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/pipeline-generator')>(
    '@/lib/agents/pipeline-generator'
  );
  return {
    ...actual,
    generatePipeline: vi.fn(async () => mockPipelineResult),
  };
});

vi.mock('@/lib/agents/cloud-infra-generator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/cloud-infra-generator')>(
    '@/lib/agents/cloud-infra-generator'
  );
  return {
    ...actual,
    generateCloudInfra: vi.fn(async () => mockCloudInfraResult),
  };
});

vi.mock('@/lib/agents/risk-scorer', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agents/risk-scorer')>(
    '@/lib/agents/risk-scorer'
  );
  return {
    ...actual,
    scoreRisk: vi.fn(async () => mockRiskResult),
  };
});

// ---- Import under test (after mocks) ----
import { runAnalysis } from '@/lib/agents/orchestrator';
import { analyzeArchitecture } from '@/lib/agents/architecture-analyzer';
import { mapCompliance } from '@/lib/agents/compliance-mapper';
import { generatePipeline } from '@/lib/agents/pipeline-generator';
import { generateCloudInfra } from '@/lib/agents/cloud-infra-generator';
import { scoreRisk } from '@/lib/agents/risk-scorer';

// Minimal AnalysisInput fixture
const minimalAnalysisInput = {
  nodes: [
    {
      'unique-id': 'svc-1',
      'node-type': 'service' as const,
      name: 'Test Service',
      description: 'A test service node',
    },
  ],
  relationships: [],
  controls: {},
  flows: [],
  metadata: {
    nodeCount: 1,
    relationshipCount: 0,
    controlCount: 0,
    flowCount: 0,
    nodeTypes: { service: 1 },
    relationshipTypes: {},
    protocols: [],
  },
};

describe('runAnalysis orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default implementations after clearAllMocks
    (analyzeArchitecture as Mock).mockResolvedValue(mockArchitectureResult);
    (mapCompliance as Mock).mockResolvedValue(mockComplianceResult);
    (generatePipeline as Mock).mockResolvedValue(mockPipelineResult);
    (generateCloudInfra as Mock).mockResolvedValue(mockCloudInfraResult);
    (scoreRisk as Mock).mockResolvedValue(mockRiskResult);
  });

  it('calls Phase 1 agents (architecture, compliance, pipeline) and Phase 2 risk scorer, returns combined result', async () => {
    const result = await runAnalysis(minimalAnalysisInput);

    // All 5 agents must have been called
    expect(analyzeArchitecture).toHaveBeenCalledOnce();
    expect(mapCompliance).toHaveBeenCalledOnce();
    expect(generatePipeline).toHaveBeenCalledOnce();
    expect(generateCloudInfra).toHaveBeenCalledOnce();
    expect(scoreRisk).toHaveBeenCalledOnce();

    // Phase 1 agents receive the analysis input
    expect(analyzeArchitecture).toHaveBeenCalledWith(minimalAnalysisInput);
    expect(mapCompliance).toHaveBeenCalledWith(minimalAnalysisInput, undefined, undefined);
    expect(generatePipeline).toHaveBeenCalledWith(minimalAnalysisInput);
    expect(generateCloudInfra).toHaveBeenCalledWith(minimalAnalysisInput);

    // Phase 2: risk scorer receives Phase 1 results (architecture, compliance, pipeline)
    const riskCallArgs = (scoreRisk as Mock).mock.calls[0][0] as {
      architecture: unknown;
      compliance: unknown;
      pipeline: unknown;
      originalInput: unknown;
    };
    expect(riskCallArgs.architecture).toEqual(mockArchitectureResult.data);
    expect(riskCallArgs.compliance).toEqual(mockComplianceResult.data);
    expect(riskCallArgs.pipeline).toEqual(mockPipelineResult.data);
    expect(riskCallArgs.originalInput).toEqual(minimalAnalysisInput);

    // Result shape: all 5 agent outputs present
    expect(result.architecture).toEqual(mockArchitectureResult.data);
    expect(result.compliance).toEqual(mockComplianceResult.data);
    expect(result.pipeline).toEqual(mockPipelineResult.data);
    expect(result.cloudInfra).toEqual(mockCloudInfraResult.data);
    expect(result.risk).toEqual(mockRiskResult.data);

    // Metadata
    expect(result.completedAgents).toContain('architecture-analyzer');
    expect(result.completedAgents).toContain('compliance-mapper');
    expect(result.completedAgents).toContain('pipeline-generator');
    expect(result.completedAgents).toContain('cloud-infra-generator');
    expect(result.completedAgents).toContain('risk-scorer');
    expect(result.failedAgents).toHaveLength(0);
    expect(typeof result.duration).toBe('number');
  });

  it('skips risk scorer and marks it failed when Phase 1 architecture agent fails', async () => {
    // Architecture analyzer fails
    (analyzeArchitecture as Mock).mockResolvedValue({
      agentName: 'architecture-analyzer',
      success: false,
      error: 'LLM timeout',
      duration: 5000,
    });

    const result = await runAnalysis(minimalAnalysisInput);

    // Risk scorer should NOT be called — missing required architecture input
    expect(scoreRisk).not.toHaveBeenCalled();

    // Architecture agent shows as failed
    expect(result.architecture).toBeNull();
    expect(result.failedAgents).toContain('architecture-analyzer');
    expect(result.failedAgents).toContain('risk-scorer');

    // Compliance and pipeline still ran (parallel, unaffected)
    expect(mapCompliance).toHaveBeenCalledOnce();
    expect(generatePipeline).toHaveBeenCalledOnce();
  });
});
