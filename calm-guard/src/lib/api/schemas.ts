import { z } from 'zod';
import { agentEventTypeSchema, agentIdentitySchema, severitySchema } from '@/lib/agents/types';
import { analysisResultSchema } from '@/lib/agents/orchestrator';
import { pipelineConfigSchema } from '@/lib/agents/pipeline-generator';
import { deterministicRuleSchema } from '@/lib/learning/types';

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Request schema for POST /api/analyze
 * Accepts raw CALM JSON — validated further in the route handler
 */
export const analyzeRequestSchema = z.object({
  calm: z.unknown(),
  frameworks: z.array(z.enum(['SOX', 'PCI-DSS', 'CCC', 'NIST-CSF', 'SOC2'])).optional(),
  demoMode: z.boolean().optional().default(false),
  /** Deterministic rules from the client-side learning store */
  deterministicRules: z.array(deterministicRuleSchema).optional().default([]),
  /** Learned patterns context (markdown) for prompt enrichment */
  learningContext: z.string().optional().default(''),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/**
 * Request schema for POST /api/calm/parse
 * Accepts raw CALM JSON for validation without running agents
 */
export const parseRequestSchema = z.object({
  calm: z.unknown(),
});

export type ParseRequest = z.infer<typeof parseRequestSchema>;

// ============================================================================
// SSE Event Schemas
// ============================================================================

/**
 * SSE Agent Event — lifecycle event emitted by agents during analysis
 */
export const sseAgentEventSchema = z.object({
  type: agentEventTypeSchema,
  agent: agentIdentitySchema,
  message: z.string().optional(),
  severity: severitySchema.optional(),
  data: z.unknown().optional(),
  timestamp: z.string().datetime(),
});

/**
 * SSE Done Event — final event when analysis completes successfully
 */
export const sseDoneEventSchema = z.object({
  type: z.literal('done'),
  result: analysisResultSchema,
});

/**
 * SSE Error Event — terminal event when analysis fails catastrophically
 */
export const sseErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

/**
 * Union of all possible SSE events.
 * Cannot use z.discriminatedUnion because agentEventTypeSchema includes 'error'
 * which conflicts with sseErrorEventSchema's z.literal('error') terminal type.
 * Clients should check parsed.type to discriminate: 'done' → SseDoneEvent,
 * 'error' with no agent → SseErrorEvent, otherwise → SseAgentEvent.
 */
export const sseEventSchema = z.union([
  sseDoneEventSchema,
  sseErrorEventSchema,
  sseAgentEventSchema,
]);

export type SseAgentEvent = z.infer<typeof sseAgentEventSchema>;
export type SseDoneEvent = z.infer<typeof sseDoneEventSchema>;
export type SseErrorEvent = z.infer<typeof sseErrorEventSchema>;
export type SseEvent = z.infer<typeof sseEventSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Response schema for POST /api/calm/parse
 * Returns the extracted AnalysisInput structure on success
 */
export const parseResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    nodes: z.array(z.unknown()),
    relationships: z.array(z.unknown()),
    controls: z.record(z.unknown()),
    flows: z.array(z.unknown()),
    metadata: z.object({
      nodeCount: z.number(),
      relationshipCount: z.number(),
      controlCount: z.number(),
      flowCount: z.number(),
      nodeTypes: z.record(z.number()),
      relationshipTypes: z.record(z.number()),
      protocols: z.array(z.string()),
    }),
  }),
});

export type ParseResponse = z.infer<typeof parseResponseSchema>;

/**
 * Response schema for GET /api/pipeline
 * Returns most recent pipeline generation result, or null if not yet generated
 */
export const pipelineResponseSchema = z.object({
  pipeline: pipelineConfigSchema.nullable(),
  message: z.string().optional(),
});

export type PipelineResponse = z.infer<typeof pipelineResponseSchema>;
