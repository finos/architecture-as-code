import { z } from 'zod';
import { generateObject } from 'ai';
import { loadAgentConfig } from './registry';
import { getModelForAgent, getDefaultModel } from '@/lib/ai/provider';
import { emitAgentEvent } from '@/lib/ai/streaming';
import { severitySchema, type AgentResult, type AgentIdentity } from './types';
import { nodeTypeSchema } from '@/lib/calm/types';
import type { AnalysisInput } from '@/lib/calm/extractor';

/**
 * Architecture Analysis Schema
 * Defines the structured output for architecture analysis
 */
export const architectureAnalysisSchema = z.object({
  components: z.array(
    z.object({
      nodeId: z.string(),
      name: z.string(),
      type: nodeTypeSchema,
      description: z.string(),
      securityControls: z.array(z.string()),
      dataClassification: z.string().optional(),
    })
  ),
  dataFlows: z.array(
    z.object({
      sourceId: z.string(),
      destinationId: z.string(),
      protocol: z.string().optional(),
      description: z.string(),
      dataTypes: z.array(z.string()),
      encrypted: z.boolean(),
    })
  ),
  trustBoundaries: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      nodeIds: z.array(z.string()),
      boundaryType: z.enum(['network', 'security-zone', 'deployment', 'organizational']),
    })
  ),
  securityZones: z.array(
    z.object({
      name: z.string(),
      nodes: z.array(z.string()),
      trustLevel: z.enum(['high', 'medium', 'low', 'untrusted']),
    })
  ),
  findings: z.array(
    z.object({
      finding: z.string(),
      severity: severitySchema,
      affectedNodes: z.array(z.string()),
      recommendation: z.string(),
    })
  ),
  summary: z.string(),
});

export type ArchitectureAnalysis = z.infer<typeof architectureAnalysisSchema>;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Analyze architecture from CALM input
 *
 * Extracts components, data flows, trust boundaries, and security zones.
 * Emits SSE events during execution.
 *
 * @param input - CALM analysis input with nodes, relationships, controls
 * @returns AgentResult with ArchitectureAnalysis data
 */
export async function analyzeArchitecture(
  input: AnalysisInput
): Promise<AgentResult<ArchitectureAnalysis>> {
  const startTime = performance.now();
  const agentName = 'architecture-analyzer';

  try {
    // Load agent configuration
    const config = loadAgentConfig(agentName);

    // Construct AgentIdentity from config metadata
    const agentIdentity: AgentIdentity = {
      name: config.metadata.name,
      displayName: config.metadata.displayName,
      icon: config.metadata.icon,
      color: config.metadata.color,
    };

    // Get model (prefer agent config, fallback to default)
    let model;
    try {
      model = getModelForAgent(config);
    } catch {
      model = getDefaultModel();
    }

    // Emit started event
    emitAgentEvent({
      type: 'started',
      agent: agentIdentity,
      message: 'Architecture Analyzer started',
    });

    // Build prompt
    const prompt = `${config.spec.role}

You are analyzing a CALM (Common Architecture Language Model) architecture definition.

**INPUT:**
${JSON.stringify(input, null, 2)}

**TASK:**
Analyze the architecture and extract:

1. **Components**: All nodes with their security controls and data classification
2. **Data Flows**: All relationships that represent data movement (connects, interacts)
3. **Trust Boundaries**: Logical groupings based on deployment, security zones, or network boundaries
4. **Security Zones**: Group nodes by trust level (high/medium/low/untrusted) based on controls and node types
5. **Findings**: Security concerns, architectural issues, or recommendations

**GUIDELINES:**
- For trust boundaries: Look for deployed-in, composed-of relationships, network nodes, and security controls
- For security zones: Consider node types (database=high trust, webclient=low trust), encryption controls, data classification
- For data flows: Extract protocol, encryption status, and data types from metadata
- For findings: Flag missing encryption, unprotected data flows, nodes without controls, trust boundary violations
- Be thorough but concise in your summary

Provide structured output matching the schema.`;

    // Emit thinking event
    emitAgentEvent({
      type: 'thinking',
      agent: agentIdentity,
      message: 'Analyzing architecture components and data flows...',
    });

    // Call generateObject with retry logic
    let result: ArchitectureAnalysis | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await generateObject({
          model,
          schema: architectureAnalysisSchema,
          prompt: attempt === 0 ? prompt : `${prompt}\n\nPREVIOUS ERROR: ${lastError?.message}\n\nPlease try again with valid output.`,
        });

        result = response.object;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[Architecture Analyzer] Attempt ${attempt + 1} failed:`, lastError.message); // nosemgrep: unsafe-formatstring

        if (attempt < 2) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          await sleep(delay);
        }
      }
    }

    if (!result) {
      throw new Error(`Failed after 3 attempts: ${lastError?.message || 'Unknown error'}`);
    }

    // Emit finding events for each finding
    for (const finding of result.findings) {
      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: finding.finding,
        severity: finding.severity,
        data: {
          affectedNodes: finding.affectedNodes,
          recommendation: finding.recommendation,
        },
      });
    }

    // Emit completed event
    emitAgentEvent({
      type: 'completed',
      agent: agentIdentity,
      message: `Architecture analysis complete: ${result.components.length} components, ${result.dataFlows.length} data flows, ${result.findings.length} findings`,
    });

    const duration = performance.now() - startTime;

    return {
      agentName,
      success: true,
      data: result,
      duration,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Emit error event
    emitAgentEvent({
      type: 'error',
      agent: {
        name: agentName,
        displayName: 'Architecture Analyzer',
        icon: 'blueprint',
        color: 'blue',
      },
      message: `Architecture analysis failed: ${errorMessage}`,
      severity: 'critical',
    });

    return {
      agentName,
      success: false,
      error: errorMessage,
      duration,
    };
  }
}
