import { z } from 'zod';
import { generateObject } from 'ai';
import { loadAgentConfig } from './registry';
import { loadSkillsForAgent } from '@/lib/skills/loader';
import { getModelForAgent, getDefaultModel } from '@/lib/ai/provider';
import { emitAgentEvent } from '@/lib/ai/streaming';
import { severitySchema, type AgentResult, type AgentIdentity } from './types';
import type { AnalysisInput } from '@/lib/calm/extractor';

/**
 * Compliance Mapping Schema
 * Defines the structured output for compliance framework mapping
 */
export const complianceMappingSchema = z.object({
  frameworkMappings: z.array(
    z.object({
      framework: z.enum(['SOX', 'PCI-DSS', 'CCC', 'NIST-CSF', 'SOC2']),
      controlId: z.string(),
      controlName: z.string(),
      calmControlId: z.string().nullable(),
      status: z.enum(['compliant', 'partial', 'non-compliant', 'not-applicable']),
      evidence: z.string(),
      recommendation: z.string(),
      severity: severitySchema,
    })
  ),
  frameworkScores: z.array(
    z.object({
      framework: z.enum(['SOX', 'PCI-DSS', 'CCC', 'NIST-CSF', 'SOC2']),
      score: z.number().min(0).max(100),
      totalControls: z.number().int().nonnegative(),
      compliantControls: z.number().int().nonnegative(),
      partialControls: z.number().int().nonnegative(),
      nonCompliantControls: z.number().int().nonnegative(),
    })
  ),
  gaps: z.array(
    z.object({
      framework: z.string(),
      missingControl: z.string(),
      description: z.string(),
      severity: severitySchema,
      recommendation: z.string(),
    })
  ),
  summary: z.string(),
});

export type ComplianceMapping = z.infer<typeof complianceMappingSchema>;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Map CALM controls to compliance frameworks
 *
 * Maps controls to SOX, PCI-DSS, CCC, and NIST-CSF frameworks using injected SKILL.md knowledge.
 * Emits SSE events during execution.
 *
 * @param input - CALM analysis input with nodes, relationships, controls
 * @returns AgentResult with ComplianceMapping data
 */
export async function mapCompliance(
  input: AnalysisInput,
  _selectedFrameworks?: string[],
  learningContext?: string,
): Promise<AgentResult<ComplianceMapping>> {
  const startTime = performance.now();
  const agentName = 'compliance-mapper';

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

    // Load skills (SOX, PCI-DSS, CCC, NIST-CSF knowledge)
    const skillsContent = loadSkillsForAgent(config);

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
      message: 'Compliance Mapper started',
    });

    // Build prompt with skills content
    const prompt = `${config.spec.role}

You are analyzing a CALM architecture definition and mapping its controls to compliance frameworks.

**COMPLIANCE FRAMEWORK KNOWLEDGE:**
${skillsContent}

**INPUT:**
${JSON.stringify(input, null, 2)}

**TASK:**
Map the CALM controls to SOX, PCI-DSS, CCC, NIST-CSF, and SOC2 frameworks.

For each framework:
1. Identify relevant controls from the framework
2. Map to CALM controls if present (or mark as gap if missing)
3. Assess compliance status: compliant (full control), partial (control exists but incomplete), non-compliant (control missing), not-applicable
4. Provide evidence from the CALM definition
5. Provide recommendations for gaps or partial compliance

Calculate per-framework scores:
- Score = (compliant + (partial * 0.5)) / total * 100
- Count total, compliant, partial, and non-compliant controls

**GUIDELINES:**
${learningContext ? `**LEARNED PATTERNS FROM PREVIOUS ANALYSES:**\n${learningContext}\n\nUse these patterns to validate and prioritize your findings. Patterns marked as "Deterministic Rules" have been confirmed across multiple analyses and should be treated as high-confidence signals.\n\n` : ''}- Use the compliance framework knowledge above to identify required controls
- Look for controls in both global controls and node/relationship-level controls
- Consider node types and protocols when assessing compliance (e.g., HTTPS for PCI-DSS)
- Flag gaps where framework requires a control but CALM definition lacks it
- Be thorough but realistic in your mappings

Provide structured output matching the schema.`;

    // Emit thinking event
    emitAgentEvent({
      type: 'thinking',
      agent: agentIdentity,
      message: 'Mapping controls to SOX, PCI-DSS, CCC, and NIST-CSF frameworks...',
    });

    // Call generateObject with retry logic
    let result: ComplianceMapping | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await generateObject({
          model,
          schema: complianceMappingSchema,
          prompt: attempt === 0 ? prompt : `${prompt}\n\nPREVIOUS ERROR: ${lastError?.message}\n\nPlease try again with valid output.`,
        });

        result = response.object;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[Compliance Mapper] Attempt ${attempt + 1} failed:`, lastError.message); // nosemgrep: unsafe-formatstring

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

    // Emit finding events for non-compliant and partial mappings
    for (const mapping of result.frameworkMappings) {
      if (mapping.status === 'non-compliant' || mapping.status === 'partial') {
        emitAgentEvent({
          type: 'finding',
          agent: agentIdentity,
          message: `${mapping.framework} ${mapping.controlId}: ${mapping.status}`,
          severity: mapping.severity,
          data: {
            framework: mapping.framework,
            controlId: mapping.controlId,
            controlName: mapping.controlName,
            status: mapping.status,
            recommendation: mapping.recommendation,
          },
        });
      }
    }

    // Emit completed event
    emitAgentEvent({
      type: 'completed',
      agent: agentIdentity,
      message: `Compliance mapping complete: ${result.frameworkMappings.length} mappings, ${result.gaps.length} gaps across 5 frameworks`,
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
        displayName: 'Compliance Mapper',
        icon: 'shield-check',
        color: 'emerald',
      },
      message: `Compliance mapping failed: ${errorMessage}`,
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
