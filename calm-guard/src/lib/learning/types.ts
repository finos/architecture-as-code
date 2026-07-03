import { z } from 'zod';

/**
 * Severity schema (reuse from agents/types)
 */
export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof severitySchema>;

/**
 * Pattern Fingerprint
 * Stable hash derived from structural characteristics of a compliance finding.
 * Ignores instance-specific details (node names/IDs) so the same structural
 * issue always produces the same fingerprint.
 *
 * Example: "HTTP|connects|database,service|PCI-DSS|non-compliant"
 */
export type PatternFingerprint = string;

/**
 * Pattern Triggers
 * Structural conditions in a CALM document that cause a compliance finding.
 * Used for both fingerprinting and deterministic pre-check matching.
 */
export const patternTriggersSchema = z.object({
  /** Protocols that trigger this pattern (e.g., ['HTTP']) */
  protocols: z.array(z.string()).default([]),
  /** Node types involved (e.g., ['service', 'database']) */
  nodeTypes: z.array(z.string()).default([]),
  /** Relationship types involved (e.g., ['connects']) */
  relationshipTypes: z.array(z.string()).default([]),
  /** Control IDs that must be absent for this to fire */
  missingControls: z.array(z.string()).default([]),
});

export type PatternTriggers = z.infer<typeof patternTriggersSchema>;

/**
 * Compliance Pattern
 * A recurring compliance observation extracted from analysis results.
 * Patterns accumulate observations across runs and track confidence.
 */
export const compliancePatternSchema = z.object({
  fingerprint: z.string().min(1),
  description: z.string(),
  framework: z.string(),
  status: z.enum(['compliant', 'partial', 'non-compliant', 'not-applicable']),
  severity: severitySchema,
  triggers: patternTriggersSchema,
  recommendation: z.string(),
  observationCount: z.number().int().nonnegative().default(0),
  confidence: z.number().min(0).max(1).default(0),
  firstSeen: z.string(),
  lastSeen: z.string(),
  promoted: z.boolean().default(false),
});

export type CompliancePattern = z.infer<typeof compliancePatternSchema>;

/**
 * Deterministic Rule
 * A promoted pattern that fires as an instant pre-check before the LLM.
 * Once promoted, these provide reproducible, instant compliance findings.
 */
export const deterministicRuleSchema = z.object({
  id: z.string(),
  sourceFingerprint: z.string().min(1),
  description: z.string(),
  framework: z.string(),
  status: z.enum(['compliant', 'partial', 'non-compliant']),
  severity: severitySchema,
  triggers: patternTriggersSchema,
  recommendation: z.string(),
  promotedAt: z.string(),
  sourceObservations: z.number().int(),
  sourceConfidence: z.number().min(0).max(1),
});

export type DeterministicRule = z.infer<typeof deterministicRuleSchema>;

/**
 * Analysis Run Record
 * Minimal record of each analysis run for the learning curve chart.
 */
export const analysisRunRecordSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  overallScore: z.number().min(0).max(100).nullable(),
  frameworkScores: z.array(z.object({
    framework: z.string(),
    score: z.number(),
  })),
  newPatternsDiscovered: z.number().int().nonnegative(),
  deterministicRulesFired: z.number().int().nonnegative(),
  patternsPromoted: z.number().int().nonnegative(),
  duration: z.number(),
});

export type AnalysisRunRecord = z.infer<typeof analysisRunRecordSchema>;

/**
 * Learning Metrics
 * Aggregated metrics for the dashboard panel.
 */
export interface LearningMetrics {
  totalPatterns: number;
  promotedCount: number;
  totalRuns: number;
  averageConfidence: number;
  intelligenceScore: number;
}

/**
 * Pre-Check Result
 * Output from running a deterministic rule against CALM input.
 */
export interface PreCheckResult {
  ruleId: string;
  fingerprint: PatternFingerprint;
  framework: string;
  status: string;
  severity: Severity;
  description: string;
  recommendation: string;
  matchedNodes: string[];
  matchedRelationships: string[];
}
