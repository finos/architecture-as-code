import { z } from 'zod';
import { generateObject } from 'ai';
import { loadAgentConfig } from './registry';
import { loadSkillsForAgent } from '@/lib/skills/loader';
import { getModelForAgent, getDefaultModel } from '@/lib/ai/provider';
import { emitAgentEvent } from '@/lib/ai/streaming';
import { type AgentResult, type AgentIdentity } from './types';
import type { CalmDocument } from '@/lib/calm/types';
import type { ComplianceMapping } from './compliance-mapper';
import type { RiskAssessment } from './risk-scorer';

/**
 * CALM Remediation Output Schema
 * Structured output from the CALM remediator agent:
 * - remediatedCalm: the full modified CALM document
 * - changes: per-change explanations with before/after and rationale
 * - summary: human-readable summary of all changes made
 */
export const calmRemediationOutputSchema = z.object({
  changes: z.array(
    z.object({
      nodeOrRelationshipId: z.string(),
      changeType: z.enum(['protocol-upgrade', 'control-added']),
      description: z.string(),
      rationale: z.string(),
      before: z.string(),
      after: z.string(),
    })
  ).min(1),
  summary: z.string(),
});

export type CalmRemediationOutput = z.infer<typeof calmRemediationOutputSchema>;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Remediate a CALM document to address compliance gaps
 *
 * Analyzes compliance findings and risk assessment, then modifies the CALM document to:
 * 1. Upgrade weak protocols to secure equivalents (HTTP→HTTPS, FTP→SFTP, etc.)
 * 2. Add missing security controls to nodes and relationships
 *
 * Emits SSE events during execution and returns structured remediation output.
 *
 * @param originalCalm - The original CALM document to remediate
 * @param compliance - Compliance mapping with identified gaps
 * @param risk - Risk assessment with top findings
 * @returns AgentResult with CalmRemediationOutput data
 */
export async function remediateCalm(
  originalCalm: CalmDocument,
  compliance: ComplianceMapping,
  risk: RiskAssessment,
): Promise<AgentResult<CalmRemediationOutput>> {
  const startTime = performance.now();
  const agentName = 'calm-remediator';

  try {
    // Load agent configuration
    const config = loadAgentConfig(agentName);

    // Load skills (PROTOCOL-SECURITY knowledge for regulatory grounding)
    const skillsContent = loadSkillsForAgent(config);

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
      message: 'CALM Remediator started',
    });

    // Build prompt — ONLY ask for changes[], never the full document.
    // LLMs reliably identify gaps but fail to embed 30+ controls into JSON.
    const prompt = `${config.spec.role}

You are analyzing a CALM v1.1 architecture document to produce a list of compliance remediation changes.

**PROTOCOL SECURITY KNOWLEDGE:**
${skillsContent}

**ORIGINAL CALM DOCUMENT:**
${JSON.stringify(originalCalm, null, 2)}

**COMPLIANCE GAPS IDENTIFIED:**
${JSON.stringify(compliance.gaps, null, 2)}

**NON-COMPLIANT FRAMEWORK MAPPINGS:**
${JSON.stringify(compliance.frameworkMappings.filter((m) => m.status !== 'compliant'), null, 2)}

**TOP RISK FINDINGS:**
${JSON.stringify(risk.topFindings, null, 2)}

**TASK:**
Produce a changes array listing EVERY remediation needed. Do NOT return the modified document — only the changes list. Our code will apply the changes programmatically.

For EACH compliance gap or risk finding, add an entry to the changes array:

1. **Protocol Upgrades** (changeType: 'protocol-upgrade'):
   - HTTP → HTTPS, LDAP → TLS, TCP → TLS, FTP → SFTP, JDBC → TLS
   - nodeOrRelationshipId: the relationship unique-id
   - before: current protocol, after: upgraded protocol

2. **Add Missing Controls** (changeType: 'control-added'):
   - nodeOrRelationshipId: the node or relationship unique-id that needs the control
   - after: the control key in format {framework}-{control-id} (e.g., "pci-dss-req-8-4-2-mfa")
   - before: "N/A"
   - rationale: explain WHY this control is needed, citing the specific framework requirement ID
   - description: human-readable description of what the control does

CRITICAL RULES:
- You MUST produce at least one change entry for every compliance gap and risk finding
- Every control-added entry MUST have a unique control key in the "after" field
- The "after" field IS the control key that will be added to the CALM document
- Use the node/relationship unique-id from the original document as nodeOrRelationshipId
- For system-wide controls (policies, governance), use "system-wide" as nodeOrRelationshipId
- Aim for comprehensive coverage — address ALL identified gaps, not just the top ones
- The summary field should describe ALL changes at a high level`;

    // Emit thinking event
    emitAgentEvent({
      type: 'thinking',
      agent: agentIdentity,
      message: 'Analyzing compliance gaps and generating remediation...',
    });

    // Call generateObject with retry logic (exponential backoff: 1s, 2s, 4s)
    let result: CalmRemediationOutput | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await generateObject({
          model,
          schema: calmRemediationOutputSchema,
          prompt:
            attempt === 0
              ? prompt
              : `${prompt}\n\nPREVIOUS ERROR: ${lastError?.message}\n\nPlease try again with valid output. Remember: protocol values MUST be exactly one of: HTTP, HTTPS, FTP, SFTP, JDBC, WebSocket, SocketIO, LDAP, AMQP, TLS, mTLS, TCP. Node-type values MUST be exactly one of: actor, ecosystem, system, service, database, network, ldap, webclient, data-asset.`,
        });

        result = response.object;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[CALM Remediator] Attempt ${attempt + 1} failed:`, lastError.message); // nosemgrep: unsafe-formatstring

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

    // Emit finding events for each change
    for (const change of result.changes) {
      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: `${change.changeType}: ${change.description}`,
        severity: change.changeType === 'protocol-upgrade' ? 'high' : 'medium',
        data: {
          changeType: change.changeType,
          nodeOrRelationshipId: change.nodeOrRelationshipId,
        },
      });
    }

    // Emit completed event
    emitAgentEvent({
      type: 'completed',
      agent: agentIdentity,
      message: `Remediation complete: ${result.changes.length} changes — ${result.changes.filter((c) => c.changeType === 'protocol-upgrade').length} protocol upgrades, ${result.changes.filter((c) => c.changeType === 'control-added').length} controls added`,
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
        displayName: 'CALM Remediator',
        icon: 'shield-plus',
        color: '#10b981',
      },
      message: `Remediation failed: ${errorMessage}`,
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
