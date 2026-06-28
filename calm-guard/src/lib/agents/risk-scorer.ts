import { z } from 'zod';
import { generateObject } from 'ai';
import { loadAgentConfig } from './registry';
import { getModelForAgent, getDefaultModel } from '@/lib/ai/provider';
import { emitAgentEvent } from '@/lib/ai/streaming';
import { severitySchema, type AgentResult, type AgentIdentity } from './types';
import type { AnalysisInput } from '@/lib/calm/extractor';
import type { ArchitectureAnalysis } from './architecture-analyzer';
import type { ComplianceMapping } from './compliance-mapper';
import type { PipelineConfig } from './pipeline-generator';

/**
 * Risk Assessment Schema
 * Defines the structured output for risk scoring and aggregation
 */
export const riskAssessmentSchema = z.object({
  overallScore: z.number().min(0).max(100),
  overallRating: z.enum(['critical', 'high', 'medium', 'low']),
  frameworkScores: z.array(
    z.object({
      framework: z.enum(['SOX', 'PCI-DSS', 'CCC', 'NIST-CSF']),
      score: z.number().min(0).max(100),
      rating: z.enum(['critical', 'high', 'medium', 'low']),
    })
  ),
  nodeRiskMap: z.array(
    z.object({
      nodeId: z.string(),
      nodeName: z.string(),
      riskLevel: z.enum(['critical', 'high', 'medium', 'low']),
      riskFactors: z.array(z.string()),
      complianceGaps: z.number().int().nonnegative(),
    })
  ),
  topFindings: z.array(
    z.object({
      finding: z.string(),
      severity: severitySchema,
      affectedNodes: z.array(z.string()),
      framework: z.string().optional(),
      recommendation: z.string(),
    })
  ),
  summary: z.string(),
  executiveSummary: z.string(),
});

export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;

/**
 * Risk Scorer Input
 * Aggregates results from all previous agents plus original CALM input
 */
export interface RiskScorerInput {
  architecture: ArchitectureAnalysis;
  compliance: ComplianceMapping;
  pipeline: PipelineConfig;
  originalInput: AnalysisInput;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Score risk by aggregating all agent results
 *
 * Produces overall score, per-framework scores, node risk map, and executive summary.
 * Emits SSE events during execution.
 *
 * @param input - Aggregated results from all agents plus original CALM input
 * @returns AgentResult with RiskAssessment data
 */
export async function scoreRisk(
  input: RiskScorerInput,
  _selectedFrameworks?: string[]
): Promise<AgentResult<RiskAssessment>> {
  const startTime = performance.now();
  const agentName = 'risk-scorer';

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
      message: 'Risk Scorer started',
    });

    // Build prompt with all agent results
    const prompt = `${config.spec.role}

You are aggregating results from multiple AI agents analyzing a CALM architecture definition.

**ARCHITECTURE ANALYSIS:**
${JSON.stringify(input.architecture, null, 2)}

**COMPLIANCE MAPPING:**
${JSON.stringify(input.compliance, null, 2)}

**PIPELINE CONFIGURATION:**
${JSON.stringify(input.pipeline, null, 2)}

**ORIGINAL CALM INPUT:**
${JSON.stringify(input.originalInput, null, 2)}

**TASK:**
Aggregate the results into a comprehensive risk assessment:

1. **Overall Score (0-100)**: Calculate based on:
   - Compliance scores (40% weight)
   - Architecture findings severity (30% weight)
   - Pipeline security maturity (20% weight)
   - Trust boundary violations (10% weight)
   - Formula: 100 - (weighted sum of penalties)

2. **Overall Rating**: Map score to rating:
   - 80-100: low
   - 60-79: medium
   - 40-59: high
   - 0-39: critical

3. **Framework Scores**: For each framework (SOX, PCI-DSS, CCC, NIST-CSF):
   - Use the score from compliance mapping
   - Apply same rating scale as overall

4. **Node Risk Map**: For each node in original input:
   - Assign risk level based on findings, compliance gaps, security controls
   - List specific risk factors (e.g., "No encryption", "Missing authentication")
   - Count compliance gaps affecting this node

5. **Top Findings**: Extract top 10 most critical findings across all agents:
   - Prioritize by severity (critical > high > medium > low)
   - Include source framework if applicable
   - Provide actionable recommendations

6. **Summary**: 2-3 paragraphs explaining the risk assessment

7. **Executive Summary**: 1 paragraph for executives (non-technical, business impact focus)

**GUIDELINES:**
- Be objective and data-driven in scoring
- Prioritize findings by business impact
- Executive summary should focus on risk to business goals, not technical details
- Node risk map should cover all nodes from original input
- Top findings should be actionable, not just observations

Provide structured output matching the schema.`;

    // Emit thinking event
    emitAgentEvent({
      type: 'thinking',
      agent: agentIdentity,
      message: 'Aggregating results and calculating risk scores...',
    });

    // Call generateObject with retry logic
    let result: RiskAssessment | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await generateObject({
          model,
          schema: riskAssessmentSchema,
          prompt: attempt === 0 ? prompt : `${prompt}\n\nPREVIOUS ERROR: ${lastError?.message}\n\nPlease try again with valid output.`,
        });

        result = response.object;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[Risk Scorer] Attempt ${attempt + 1} failed:`, lastError.message); // nosemgrep: unsafe-formatstring

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

    // Emit finding events for top findings (critical and high severity)
    for (const finding of result.topFindings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high'
    )) {
      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: finding.finding,
        severity: finding.severity,
        data: {
          affectedNodes: finding.affectedNodes,
          framework: finding.framework,
          recommendation: finding.recommendation,
        },
      });
    }

    // Emit completed event
    emitAgentEvent({
      type: 'completed',
      agent: agentIdentity,
      message: `Risk assessment complete: Overall score ${result.overallScore}/100 (${result.overallRating}), ${result.topFindings.length} top findings`,
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
        displayName: 'Risk Scorer',
        icon: 'alert-triangle',
        color: 'red',
      },
      message: `Risk scoring failed: ${errorMessage}`,
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
