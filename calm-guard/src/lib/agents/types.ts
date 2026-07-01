import { z } from 'zod';

/**
 * Agent Event Types
 * Defines the 5 lifecycle events emitted by agents during execution
 */
export type AgentEventType = 'started' | 'thinking' | 'finding' | 'completed' | 'error';

export const agentEventTypeSchema = z.enum(['started', 'thinking', 'finding', 'completed', 'error']);

/**
 * Severity Levels
 * Used for findings and errors to indicate priority
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

/**
 * Agent Identity
 * Metadata for display/UI purposes - name, icon, color
 */
export interface AgentIdentity {
  name: string;
  displayName: string;
  icon: string;
  color: string;
}

export const agentIdentitySchema = z.object({
  name: z.string(),
  displayName: z.string(),
  icon: z.string(),
  color: z.string(),
});

/**
 * Agent Event
 * Core event structure emitted via SSE during agent execution
 */
export interface AgentEvent {
  type: AgentEventType;
  agent: AgentIdentity;
  message?: string;
  severity?: Severity;
  data?: unknown;
  timestamp: string; // ISO 8601
}

export const agentEventSchema = z.object({
  type: agentEventTypeSchema,
  agent: agentIdentitySchema,
  message: z.string().optional(),
  severity: severitySchema.optional(),
  data: z.unknown().optional(),
  timestamp: z.string().datetime(),
});

/**
 * Agent Config
 * Matches YAML agent definition structure from agents/ directory
 */
export interface AgentConfig {
  apiVersion: string;
  kind: 'Agent';
  metadata: {
    name: string;
    displayName: string;
    icon: string;
    color: string;
  };
  spec: {
    role: string;
    model: {
      provider: string;
      model: string;
      temperature: number;
    };
    skills: string[];
    inputs: Array<{ type: string }>;
    outputs: Array<{ type: string }>;
    maxTokens: number;
  };
}

export const agentConfigSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Agent'),
  metadata: z.object({
    name: z.string(),
    displayName: z.string(),
    icon: z.string(),
    color: z.string(),
  }),
  spec: z.object({
    role: z.string(),
    model: z.object({
      provider: z.string(),
      model: z.string(),
      temperature: z.number(),
    }),
    skills: z.array(z.string()),
    inputs: z.array(z.object({ type: z.string() })),
    outputs: z.array(z.object({ type: z.string() })),
    maxTokens: z.number(),
  }),
});

/**
 * Agent Result
 * Generic wrapper for agent execution results with timing and error handling
 */
export interface AgentResult<T = unknown> {
  agentName: string;
  success: boolean;
  data?: T;
  error?: string;
  duration: number; // milliseconds
}

export const agentResultSchema = z.object({
  agentName: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  duration: z.number(),
});
