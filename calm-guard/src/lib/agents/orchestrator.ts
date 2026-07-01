import { z } from 'zod';
import { loadAgentConfig } from './registry';
import { emitAgentEvent } from '@/lib/ai/streaming';
import type { AgentIdentity } from './types';
import type { AnalysisInput } from '@/lib/calm/extractor';
import { analyzeArchitecture, type ArchitectureAnalysis, architectureAnalysisSchema } from './architecture-analyzer';
import { mapCompliance, type ComplianceMapping, complianceMappingSchema } from './compliance-mapper';
import { generatePipeline, type PipelineConfig, pipelineConfigSchema } from './pipeline-generator';
import { generateCloudInfra, type CloudInfraConfig, cloudInfraConfigSchema } from './cloud-infra-generator';
import { scoreRisk, type RiskAssessment, riskAssessmentSchema } from './risk-scorer';
import { runDeterministicPreChecks } from '@/lib/learning/pre-check';
import type { DeterministicRule, PreCheckResult } from '@/lib/learning/types';

/**
 * Analysis Result Schema
 * Combines outputs from all 4 agents with execution metadata
 */
export const analysisResultSchema = z.object({
  architecture: architectureAnalysisSchema.nullable(),
  compliance: complianceMappingSchema.nullable(),
  pipeline: pipelineConfigSchema.nullable(),
  cloudInfra: cloudInfraConfigSchema.nullable(),
  risk: riskAssessmentSchema.nullable(),
  duration: z.number(),
  completedAgents: z.array(z.string()),
  failedAgents: z.array(z.string()),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/** Helper to add dramatic pauses in demo mode for cinematic effect */
const sleep = (ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run complete analysis orchestration
 *
 * Coordinates all 4 agents:
 * - Phase 1 (Parallel): Architecture Analyzer, Compliance Mapper, Pipeline Generator
 * - Phase 2 (Sequential): Risk Scorer (requires Phase 1 results)
 *
 * Uses Promise.allSettled for graceful degradation - one agent failure doesn't cancel others.
 *
 * @param input - CALM analysis input
 * @param selectedFrameworks - Optional list of compliance frameworks to analyze (e.g. ['SOX', 'PCI-DSS'])
 * @param demoMode - When true, adds dramatic pauses between phases for cinematic demo effect
 * @returns AnalysisResult with all agent outputs (null for failed agents)
 */
export async function runAnalysis(
  input: AnalysisInput,
  selectedFrameworks?: string[],
  demoMode?: boolean,
  deterministicRules?: DeterministicRule[],
  learningContext?: string,
): Promise<AnalysisResult> {
  const startTime = performance.now();

  try {
    // Load orchestrator configuration
    const config = loadAgentConfig('orchestrator');

    // Construct AgentIdentity from config metadata
    const agentIdentity: AgentIdentity = {
      name: config.metadata.name,
      displayName: config.metadata.displayName,
      icon: config.metadata.icon,
      color: config.metadata.color,
    };

    // Emit orchestrator started event
    emitAgentEvent({
      type: 'started',
      agent: agentIdentity,
      message: 'Orchestrator started - coordinating 5 AI agents',
    });

    // Demo mode: let judges see the dashboard load before agents fire
    if (demoMode) await sleep(800);

    // Track completed and failed agents
    const completedAgents: string[] = [];
    const failedAgents: string[] = [];

    // Initialize result containers
    let architecture: ArchitectureAnalysis | null = null;
    let compliance: ComplianceMapping | null = null;
    let pipeline: PipelineConfig | null = null;
    let cloudInfra: CloudInfraConfig | null = null;
    let risk: RiskAssessment | null = null;

    // ========================================================================
    // PHASE 0: Deterministic Pre-Checks (Oracle — instant, no LLM)
    // ========================================================================

    const rules = deterministicRules ?? [];
    let preCheckResults: PreCheckResult[] = [];

    const oracleIdentity: AgentIdentity = {
      name: 'learning-engine',
      displayName: 'Learning Engine',
      icon: 'brain',
      color: 'cyan',
    };

    // Oracle always starts — even with no rules, it's scanning
    emitAgentEvent({
      type: 'started',
      agent: oracleIdentity,
      message: rules.length > 0
        ? `Oracle scanning — ${rules.length} deterministic rule${rules.length === 1 ? '' : 's'} loaded`
        : 'Oracle scanning learning store for compliance patterns...',
    });

    // Cinematic pause so judges see Oracle working
    await sleep(1500);

    if (rules.length > 0) {
      emitAgentEvent({
        type: 'thinking',
        agent: oracleIdentity,
        message: `Running ${rules.length} deterministic pre-checks against architecture...`,
      });

      await sleep(800);

      preCheckResults = runDeterministicPreChecks(input, rules, selectedFrameworks);

      // Single summary message instead of per-finding noise
      if (preCheckResults.length > 0) {
        const frameworks = [...new Set(preCheckResults.map(r => r.framework))];
        emitAgentEvent({
          type: 'finding',
          agent: oracleIdentity,
          message: `Injecting ${preCheckResults.length} learned compliance insight${preCheckResults.length === 1 ? '' : 's'} (${frameworks.join(', ')})`,
          severity: 'info',
          data: { deterministic: true, advisory: true, count: preCheckResults.length, frameworks },
        });
      }
    } else {
      emitAgentEvent({
        type: 'thinking',
        agent: oracleIdentity,
        message: 'No deterministic rules yet — will extract patterns after analysis to learn for next time',
      });

      await sleep(1000);
    }

    emitAgentEvent({
      type: 'completed',
      agent: oracleIdentity,
      message: rules.length > 0
        ? preCheckResults.length > 0
          ? `Oracle surfaced ${preCheckResults.length} advisory insight${preCheckResults.length === 1 ? '' : 's'} from learned rules`
          : 'Oracle completed — no learned rules matched this architecture'
        : `Oracle ready — will learn from this analysis to build deterministic rules`,
    });

    completedAgents.push('learning-engine');

    // Pause before Phase 1 kicks off
    await sleep(500);

    // ========================================================================
    // PHASE 1: Parallel execution (Architecture Analyzer, Compliance Mapper, Pipeline Generator, Cloud Infra Generator)
    // ========================================================================

    emitAgentEvent({
      type: 'thinking',
      agent: agentIdentity,
      message: 'Running Architecture Analyzer, Compliance Mapper, Pipeline Generator, and Cloud Infra Generator in parallel...',
    });

    const phase1Results = await Promise.allSettled([
      analyzeArchitecture(input),
      mapCompliance(input, selectedFrameworks, learningContext),
      generatePipeline(input),
      generateCloudInfra(input),
    ]);

    // Extract Architecture Analyzer result
    const archResult = phase1Results[0];
    if (archResult.status === 'fulfilled' && archResult.value.success && archResult.value.data) {
      architecture = archResult.value.data;
      completedAgents.push('architecture-analyzer');
    } else {
      const error = archResult.status === 'rejected'
        ? archResult.reason
        : archResult.value.error || 'Unknown error';
      failedAgents.push('architecture-analyzer');

      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: `Architecture Analyzer failed: ${error}`,
        severity: 'critical',
      });
    }

    // Demo mode: stagger result announcements so agents appear sequential
    if (demoMode) await sleep(500);

    // Extract Compliance Mapper result
    const compResult = phase1Results[1];
    if (compResult.status === 'fulfilled' && compResult.value.success && compResult.value.data) {
      compliance = compResult.value.data;
      completedAgents.push('compliance-mapper');
    } else {
      const error = compResult.status === 'rejected'
        ? compResult.reason
        : compResult.value.error || 'Unknown error';
      failedAgents.push('compliance-mapper');

      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: `Compliance Mapper failed: ${error}`,
        severity: 'critical',
      });
    }

    // Demo mode: stagger result announcements
    if (demoMode) await sleep(500);

    // Extract Pipeline Generator result
    const pipeResult = phase1Results[2];
    if (pipeResult.status === 'fulfilled' && pipeResult.value.success && pipeResult.value.data) {
      pipeline = pipeResult.value.data;
      completedAgents.push('pipeline-generator');
    } else {
      const error = pipeResult.status === 'rejected'
        ? pipeResult.reason
        : pipeResult.value.error || 'Unknown error';
      failedAgents.push('pipeline-generator');

      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: `Pipeline Generator failed: ${error}`,
        severity: 'critical',
      });
    }

    // Demo mode: stagger result announcements
    if (demoMode) await sleep(500);

    // Extract Cloud Infra Generator result
    const cloudInfraResult = phase1Results[3];
    if (cloudInfraResult.status === 'fulfilled' && cloudInfraResult.value.success && cloudInfraResult.value.data) {
      cloudInfra = cloudInfraResult.value.data;
      completedAgents.push('cloud-infra-generator');
    } else {
      const error = cloudInfraResult.status === 'rejected'
        ? cloudInfraResult.reason
        : cloudInfraResult.value.error || 'Unknown error';
      failedAgents.push('cloud-infra-generator');

      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: `Cloud Infra Generator failed: ${error}`,
        severity: 'critical',
      });
    }

    // Store cloud infra result globally for PR route access
    globalThis.__lastCloudInfraResult = cloudInfra;

    // ========================================================================
    // PHASE 2: Sequential execution (Risk Scorer requires Phase 1 results)
    // ========================================================================

    // Demo mode: dramatic pause before risk scoring — "and now the verdict..."
    if (demoMode) await sleep(1500);

    // Risk Scorer requires at least Architecture AND Compliance to run
    if (architecture && compliance) {
      emitAgentEvent({
        type: 'thinking',
        agent: agentIdentity,
        message: 'Running Risk Scorer with aggregated results...',
      });

      try {
        const riskResult = await scoreRisk({
          architecture,
          compliance,
          pipeline: pipeline || {
            githubActions: { name: 'N/A', yaml: '' },
            securityScanning: { tools: [], summary: 'Pipeline generation failed' },
            infrastructureAsCode: { provider: 'terraform', config: '' },
            recommendations: [],
            summary: 'Pipeline data unavailable',
          },
          originalInput: input,
        }, selectedFrameworks);

        if (riskResult.success && riskResult.data) {
          risk = riskResult.data;
          completedAgents.push('risk-scorer');
        } else {
          failedAgents.push('risk-scorer');

          emitAgentEvent({
            type: 'finding',
            agent: agentIdentity,
            message: `Risk Scorer failed: ${riskResult.error || 'Unknown error'}`,
            severity: 'high',
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failedAgents.push('risk-scorer');

        emitAgentEvent({
          type: 'finding',
          agent: agentIdentity,
          message: `Risk Scorer failed: ${errorMessage}`,
          severity: 'high',
        });
      }
    } else {
      // Skip Risk Scorer if prerequisites missing
      failedAgents.push('risk-scorer');

      const missingAgents = [];
      if (!architecture) missingAgents.push('Architecture Analyzer');
      if (!compliance) missingAgents.push('Compliance Mapper');

      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: `Risk Scorer skipped: Missing required inputs from ${missingAgents.join(' and ')}`,
        severity: 'high',
      });
    }

    // ========================================================================
    // Complete orchestration
    // ========================================================================

    const duration = performance.now() - startTime;

    const successCount = completedAgents.length;
    const totalCount = rules.length > 0 ? 6 : 5;

    emitAgentEvent({
      type: 'completed',
      agent: agentIdentity,
      message: `Analysis complete: ${successCount}/${totalCount} agents succeeded`,
    });

    return {
      architecture,
      compliance,
      pipeline,
      cloudInfra,
      risk,
      duration,
      completedAgents,
      failedAgents,
    };
  } catch (error) {
    // Catastrophic error (e.g., no LLM providers configured)
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Emit error event with fallback identity if config load failed
    emitAgentEvent({
      type: 'error',
      agent: {
        name: 'orchestrator',
        displayName: 'Orchestrator',
        icon: 'layers',
        color: 'slate',
      },
      message: `Orchestration failed: ${errorMessage}`,
      severity: 'critical',
    });

    // Re-throw to signal complete failure
    throw error;
  }
}
