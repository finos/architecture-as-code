import { z } from 'zod';
import { generateObject } from 'ai';
import { loadAgentConfig } from './registry';
import { loadSkillsForAgent } from '@/lib/skills/loader';
import { getModelForAgent, getDefaultModel } from '@/lib/ai/provider';
import { emitAgentEvent } from '@/lib/ai/streaming';
import { type AgentResult, type AgentIdentity } from './types';
import type { AnalysisInput } from '@/lib/calm/extractor';

/**
 * Pipeline Config Schema
 * Defines the structured output for CI/CD pipeline generation
 */
export const pipelineConfigSchema = z.object({
  githubActions: z.object({
    name: z.string(),
    yaml: z.string().describe('Complete multi-line GitHub Actions YAML workflow. MUST use literal newline characters (\\n) to separate lines — never put the whole YAML on a single line. Indent nested YAML keys with 2 spaces after each newline.'),
  }),
  securityScanning: z.object({
    tools: z.array(
      z.object({
        name: z.enum(['semgrep', 'codeql', 'trivy', 'npm-audit', 'gitleaks', 'syft']),
        description: z.string(),
        config: z.string().describe('Multi-line tool configuration. MUST use literal newline characters (\\n) to separate lines.'),
      })
    ),
    summary: z.string(),
  }),
  infrastructureAsCode: z.object({
    provider: z.enum(['terraform', 'cloudformation']),
    config: z.string().describe('Complete multi-line Terraform HCL or CloudFormation YAML. MUST use literal newline characters (\\n) to separate lines — never put the entire config on a single line. Indent nested blocks with 2 spaces.'),
  }),
  recommendations: z.array(
    z.object({
      category: z.enum(['ci-cd', 'security', 'infrastructure', 'monitoring']),
      recommendation: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    })
  ),
  summary: z.string(),
});

export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate CI/CD pipeline configuration
 *
 * Creates GitHub Actions workflow, security scanning configs, and IaC templates.
 * Emits SSE events during execution.
 *
 * @param input - CALM analysis input with nodes, relationships, controls
 * @returns AgentResult with PipelineConfig data
 */
export async function generatePipeline(
  input: AnalysisInput
): Promise<AgentResult<PipelineConfig>> {
  const startTime = performance.now();
  const agentName = 'pipeline-generator';

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
      message: 'Pipeline Generator started',
    });

    // Load skills for pipeline generation guidance
    const skillsContent = loadSkillsForAgent(config);

    // Build prompt — focused on DevSecOps CI, not deployment
    const prompt = `${config.spec.role}

${skillsContent ? `**PIPELINE GENERATION GUIDELINES:**\n${skillsContent}\n\n` : ''}You are generating a **DevSecOps CI pipeline** for a CALM architecture definition.
This is a compliance-focused continuous integration pipeline — NOT a deployment pipeline.

**INPUT:**
${JSON.stringify(input, null, 2)}

**TASK:**
Generate a concise, compliance-first DevSecOps CI pipeline:

1. **GitHub Actions Workflow** (40-60 lines max):
   - Triggers: push and pull_request to main
   - DevSecOps stages: code-quality → sast → secret-detection → sca → sbom → build
   - Security stages run in parallel after code-quality
   - Build depends on all security stages passing (compliance gate)
   - Use real tools: semgrep for SAST, gitleaks for secrets, trivy for SCA, syft for SBOM
   - Add comments mapping each stage to compliance rationale (e.g. "# PCI-DSS: detect secrets")
   - DO NOT include deployment, staging, production, Docker, or Kubernetes steps

2. **Security Scanning** (2-3 tools based on CALM signals):
   - Semgrep: SAST rules mapped to architecture (SQL injection for DB nodes, XSS for webclient)
   - Trivy or npm-audit: SCA/dependency scanning for service nodes
   - Gitleaks: secret detection (always relevant)
   - Syft: SBOM generation for audit trail (if compliance controls present)
   - Keep each tool config to 10-20 lines

3. **Infrastructure as Code** (20-40 lines of Terraform):
   - Security group rules derived from CALM protocol requirements
   - HTTPS relationships → allow 443, deny 80
   - Database connections → restrict to service CIDR
   - Keep representative, not exhaustive

4. **Recommendations** (3-4 max):
   - Each referencing a CALM signal AND a compliance framework
   - Actionable as a pipeline stage or config change

**CRITICAL FORMATTING RULE:**
All YAML and HCL config strings MUST use real newline characters (\\n in JSON).
CORRECT: "name: ci\\non:\\n  push:\\n    branches: [main]"
WRONG: "name: ci on: push: branches: [main]"
Never put multi-line configs on a single line.`;

    // Emit thinking event
    emitAgentEvent({
      type: 'thinking',
      agent: agentIdentity,
      message: 'Generating CI/CD pipeline and security scanning configurations...',
    });

    // Call generateObject with retry logic
    let result: PipelineConfig | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await generateObject({
          model,
          schema: pipelineConfigSchema,
          prompt: attempt === 0 ? prompt : `${prompt}\n\nPREVIOUS ERROR: ${lastError?.message}\n\nPlease try again with valid output.`,
        });

        result = response.object;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[Pipeline Generator] Attempt ${attempt + 1} failed:`, lastError.message); // nosemgrep: unsafe-formatstring

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

    // Emit finding events for high-priority recommendations
    for (const rec of result.recommendations.filter((r) => r.priority === 'high')) {
      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: `${rec.category}: ${rec.recommendation}`,
        severity: 'high',
        data: {
          category: rec.category,
          priority: rec.priority,
        },
      });
    }

    // Emit completed event
    emitAgentEvent({
      type: 'completed',
      agent: agentIdentity,
      message: `Pipeline generation complete: GitHub Actions workflow, ${result.securityScanning.tools.length} security tools, ${result.recommendations.length} recommendations`,
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
        displayName: 'Pipeline Generator',
        icon: 'git-branch',
        color: 'purple',
      },
      message: `Pipeline generation failed: ${errorMessage}`,
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
