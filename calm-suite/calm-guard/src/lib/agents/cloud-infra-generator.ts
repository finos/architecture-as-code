import { z } from 'zod';
import { generateObject } from 'ai';
import { loadAgentConfig } from './registry';
import { loadSkillsForAgent } from '@/lib/skills/loader';
import { getModelForAgent, getDefaultModel } from '@/lib/ai/provider';
import { emitAgentEvent } from '@/lib/ai/streaming';
import { type AgentResult, type AgentIdentity } from './types';
import type { AnalysisInput } from '@/lib/calm/extractor';

/**
 * Cloud Infrastructure Config Schema
 * Defines the structured output for AWS Terraform generation
 */
export const cloudInfraConfigSchema = z.object({
  provider: z.literal('aws'),
  terraform: z.object({
    modules: z.array(
      z.object({
        name: z.string().describe('Module name, e.g. "vpc", "ecs", "rds", "security-groups"'),
        filename: z.string().describe('File path, e.g. "terraform/vpc.tf"'),
        content: z.string().describe(
          'Complete multi-line HCL content. MUST use literal newline characters (\\n) to separate lines. Indent nested blocks with 2 spaces.'
        ),
        calmSignal: z.string().describe(
          'CALM signal that drove this module, e.g. "network nodes → VPC segmentation"'
        ),
      })
    ),
  }),
  traceability: z.array(
    z.object({
      calmElement: z.string().describe('Node or relationship unique-id that drove this resource'),
      generatedResource: z
        .string()
        .describe('AWS resource identifier, e.g. "aws_security_group.app_sg"'),
      rationale: z.string().describe('Why this resource was generated'),
    })
  ),
  summary: z.string(),
});

export type CloudInfraConfig = z.infer<typeof cloudInfraConfigSchema>;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate AWS Terraform cloud infrastructure scaffolds from CALM architecture signals.
 *
 * Maps CALM nodes (service → ECS/ALB, database → RDS, network → VPC) to AWS resources.
 * Derives security groups from CALM protocols and IAM roles from CALM controls.
 * Emits SSE events during execution.
 *
 * Runs in Phase 1 parallel alongside Architecture Analyzer, Compliance Mapper,
 * and Pipeline Generator — only needs AnalysisInput, not Phase 2 results.
 *
 * @param input - CALM analysis input with nodes, relationships, controls
 * @returns AgentResult with CloudInfraConfig data
 */
export async function generateCloudInfra(
  input: AnalysisInput
): Promise<AgentResult<CloudInfraConfig>> {
  const startTime = performance.now();
  const agentName = 'cloud-infra-generator';

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
      message: 'Cloud Infra Generator started',
    });

    // Load skills for cloud infrastructure generation guidance
    const skillsContent = loadSkillsForAgent(config);

    // Build prompt — focused on AWS Terraform, not CI/CD
    const prompt = `${config.spec.role}

${skillsContent ? `**CLOUD INFRASTRUCTURE GUIDELINES:**\n${skillsContent}\n\n` : ''}You are generating **AWS Terraform infrastructure scaffolds** from a CALM architecture definition.
Every Terraform resource MUST trace back to a CALM signal (node, relationship, protocol, or control).

**INPUT:**
${JSON.stringify(input, null, 2)}

**TASK:**
Generate production-realistic AWS Terraform scaffolds:

1. **Terraform Modules** (one file per logical grouping):
   - terraform/main.tf — Provider config (AWS ~> 5.0), locals, data sources
   - terraform/vpc.tf — VPC, subnets (public for ALB, private for DB), route tables, IGW, NAT
   - terraform/ecs.tf — ECS cluster + service + ALB (for service nodes with HTTPS)
   - terraform/rds.tf — RDS instance + subnet group (only if database nodes present)
   - terraform/security-groups.tf — Ingress/egress per CALM protocol (HTTPS→443, mTLS→mutual auth)
   - terraform/iam.tf — IAM roles + policies per CALM node controls (only if controls present)
   - Only generate files relevant to the CALM document

2. **CALM → AWS Traceability** (for every Terraform resource):
   - calmElement: the CALM node unique-id or relationship unique-id that drove this resource
   - generatedResource: the AWS Terraform resource address (e.g. aws_vpc.main)
   - rationale: why this resource was needed based on the CALM signal

3. **Terraform Constraints**:
   - AWS provider ~> 5.0, Terraform 1.5+
   - Region: us-east-1 (financial services standard)
   - Tag all resources: Project = "calmguard", ManagedBy = "terraform"
   - Private subnets for databases, public subnets for load balancers
   - HTTPS → allow 443, deny 80 on ALB listeners
   - Database → restrict ingress to service security group CIDR only
   - Each resource comment maps to CALM element: "# CALM: database node 'trade-db'"

**CRITICAL FORMATTING RULE:**
All HCL content strings MUST use real newline characters (\\n in JSON).
CORRECT: "resource \\"aws_vpc\\" \\"main\\" {\\n  cidr_block = \\"10.0.0.0/16\\"\\n}"
WRONG: "resource \\"aws_vpc\\" \\"main\\" { cidr_block = \\"10.0.0.0/16\\" }"
Never put multi-line HCL on a single line.`;

    // Emit thinking event
    emitAgentEvent({
      type: 'thinking',
      agent: agentIdentity,
      message: 'Mapping CALM architecture signals to AWS Terraform resources...',
    });

    // Call generateObject with retry logic
    let result: CloudInfraConfig | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await generateObject({
          model,
          schema: cloudInfraConfigSchema,
          prompt:
            attempt === 0
              ? prompt
              : `${prompt}\n\nPREVIOUS ERROR: ${lastError?.message}\n\nPlease try again with valid output.`,
        });

        result = response.object;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[Cloud Infra Generator] Attempt ${attempt + 1} failed:`, lastError.message); // nosemgrep: unsafe-formatstring

        if (attempt < 2) {
          // Exponential backoff: 1s, 2s
          const delay = Math.pow(2, attempt) * 1000;
          await sleep(delay);
        }
      }
    }

    if (!result) {
      throw new Error(`Failed after 3 attempts: ${lastError?.message || 'Unknown error'}`);
    }

    // Single summary instead of per-traceability events to reduce UI noise
    if (result.traceability.length > 0) {
      emitAgentEvent({
        type: 'finding',
        agent: agentIdentity,
        message: `Generated ${result.terraform.modules.length} Terraform modules with ${result.traceability.length} CALM-traced resources`,
        severity: 'info',
        data: { moduleCount: result.terraform.modules.length, traceCount: result.traceability.length },
      });
    }

    // Emit completed event
    emitAgentEvent({
      type: 'completed',
      agent: agentIdentity,
      message: `Cloud infrastructure generation complete: ${result.terraform.modules.length} Terraform modules, ${result.traceability.length} CALM traceability entries`,
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
        displayName: 'Cloud Infra Generator',
        icon: 'cloud',
        color: '#0ea5e9',
      },
      message: `Cloud infrastructure generation failed: ${errorMessage}`,
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
