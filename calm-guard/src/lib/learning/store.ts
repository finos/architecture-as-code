import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { extractPatterns } from './extractor';
import type {
  CompliancePattern,
  DeterministicRule,
  AnalysisRunRecord,
  LearningMetrics,
  PatternFingerprint,
} from './types';
import type { AnalysisResult } from '@/lib/agents/orchestrator';
import type { AnalysisInput } from '@/lib/calm/extractor';

/** Minimum observations before a pattern can be promoted */
const PROMOTION_THRESHOLD_COUNT = 3;

/** Minimum confidence (0-1) before a pattern can be promoted */
const PROMOTION_THRESHOLD_CONFIDENCE = 0.75;

interface LearningState {
  /** All discovered compliance patterns, keyed by fingerprint */
  patternLibrary: Record<PatternFingerprint, CompliancePattern>;
  /** Patterns promoted to instant deterministic rules */
  deterministicRules: DeterministicRule[];
  /** History of analysis runs for the learning curve */
  analysisHistory: AnalysisRunRecord[];
}

interface LearningActions {
  /**
   * Record an analysis run: extract patterns, merge with library, auto-promote.
   * Call this after each analysis completes.
   */
  recordAnalysis: (
    result: AnalysisResult,
    input: AnalysisInput,
    deterministicRulesFired: number,
  ) => void;

  /**
   * Manually promote a pattern to a deterministic rule.
   */
  promotePattern: (fingerprint: PatternFingerprint) => void;

  /**
   * Remove a deterministic rule.
   */
  removeRule: (ruleId: string) => void;

  /**
   * Compute aggregated metrics for the dashboard.
   */
  getMetrics: () => LearningMetrics;

  /**
   * Generate markdown context for injection into agent prompts.
   */
  getLearningContext: () => string;

  /**
   * Get patterns eligible for promotion (meet thresholds but not yet promoted).
   */
  getEligibleForPromotion: () => CompliancePattern[];

  /**
   * Reset all learning state (for testing/demo).
   */
  clearAll: () => void;
}

/**
 * Compute the intelligence score (0-100) from current learning state.
 */
function computeIntelligenceScore(state: LearningState): number {
  const patterns = Object.values(state.patternLibrary);
  if (state.analysisHistory.length === 0) return 0;

  // Factor 1: Pattern coverage (0-40 pts, log scale)
  const patternScore = Math.min(40, Math.log2(patterns.length + 1) * 10);

  // Factor 2: Average confidence (0-30 pts)
  const avgConfidence = patterns.length > 0
    ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
    : 0;
  const confidenceScore = avgConfidence * 30;

  // Factor 3: Rule maturity (0-20 pts, 5 per rule)
  const ruleScore = Math.min(20, state.deterministicRules.length * 5);

  // Factor 4: Run history (0-10 pts, 2 per run)
  const runScore = Math.min(10, state.analysisHistory.length * 2);

  return Math.round(patternScore + confidenceScore + ruleScore + runScore);
}

export const useLearningStore = create<LearningState & LearningActions>()(
  persist(
    (set, get) => ({
      // Initial state
      patternLibrary: {},
      deterministicRules: [],
      analysisHistory: [],

      recordAnalysis: (result, input, deterministicRulesFired) => {
        const state = get();
        const now = new Date().toISOString();

        // Skip if no compliance data
        if (!result.compliance) return;

        // Extract patterns from this analysis
        const newPatterns = extractPatterns(result.compliance, result.risk ?? null, input);

        // Merge with existing library
        const updatedLibrary = { ...state.patternLibrary };
        let newPatternsDiscovered = 0;

        for (const pattern of newPatterns) {
          const existing = updatedLibrary[pattern.fingerprint];
          if (existing) {
            // Increment observation count and recalculate confidence
            // Confidence = how close to promotion threshold (0-1, capped at 1)
            // A pattern seen 3+ times reaches 100% regardless of total runs
            const newObsCount = existing.observationCount + 1;
            updatedLibrary[pattern.fingerprint] = {
              ...existing,
              observationCount: newObsCount,
              confidence: Math.min(1, newObsCount / PROMOTION_THRESHOLD_COUNT),
              lastSeen: now,
              // Keep the most severe severity seen
              severity: compareSeverity(pattern.severity, existing.severity) > 0
                ? pattern.severity
                : existing.severity,
            };
          } else {
            // New pattern — confidence starts at 1/threshold (33% with threshold=3)
            updatedLibrary[pattern.fingerprint] = {
              ...pattern,
              confidence: Math.min(1, 1 / PROMOTION_THRESHOLD_COUNT),
            };
            newPatternsDiscovered++;
          }
        }

        // Auto-promote eligible patterns
        const newRules = [...state.deterministicRules];
        let patternsPromoted = 0;
        const existingFingerprints = new Set(newRules.map(r => r.sourceFingerprint));

        for (const [fp, pattern] of Object.entries(updatedLibrary)) {
          if (
            !pattern.promoted &&
            !existingFingerprints.has(fp) &&
            pattern.observationCount >= PROMOTION_THRESHOLD_COUNT &&
            pattern.confidence >= PROMOTION_THRESHOLD_CONFIDENCE
          ) {
            // Promote to deterministic rule
            updatedLibrary[fp] = { ...pattern, promoted: true };
            newRules.push({
              id: `rule-${Date.now()}-${patternsPromoted}`,
              sourceFingerprint: fp,
              description: pattern.description,
              framework: pattern.framework,
              status: pattern.status === 'not-applicable' ? 'non-compliant' : pattern.status,
              severity: pattern.severity,
              triggers: pattern.triggers,
              recommendation: pattern.recommendation,
              promotedAt: now,
              sourceObservations: pattern.observationCount,
              sourceConfidence: pattern.confidence,
            });
            patternsPromoted++;
          }
        }

        // Record the run
        const runRecord: AnalysisRunRecord = {
          id: `run-${Date.now()}`,
          timestamp: now,
          overallScore: result.risk?.overallScore ?? null,
          frameworkScores: result.risk?.frameworkScores?.map(fs => ({
            framework: fs.framework,
            score: fs.score,
          })) ?? result.compliance.frameworkScores.map(fs => ({
            framework: fs.framework,
            score: fs.score,
          })),
          newPatternsDiscovered,
          deterministicRulesFired,
          patternsPromoted,
          duration: result.duration,
        };

        set({
          patternLibrary: updatedLibrary,
          deterministicRules: newRules,
          analysisHistory: [...state.analysisHistory, runRecord],
        });
      },

      promotePattern: (fingerprint) => {
        const state = get();
        const pattern = state.patternLibrary[fingerprint];
        if (!pattern || pattern.promoted) return;

        const now = new Date().toISOString();
        const rule: DeterministicRule = {
          id: `rule-${Date.now()}`,
          sourceFingerprint: fingerprint,
          description: pattern.description,
          framework: pattern.framework,
          status: pattern.status === 'not-applicable' ? 'non-compliant' : pattern.status,
          severity: pattern.severity,
          triggers: pattern.triggers,
          recommendation: pattern.recommendation,
          promotedAt: now,
          sourceObservations: pattern.observationCount,
          sourceConfidence: pattern.confidence,
        };

        set({
          patternLibrary: {
            ...state.patternLibrary,
            [fingerprint]: { ...pattern, promoted: true },
          },
          deterministicRules: [...state.deterministicRules, rule],
        });
      },

      removeRule: (ruleId) => {
        const state = get();
        const rule = state.deterministicRules.find(r => r.id === ruleId);
        if (!rule) return;

        // Un-promote the source pattern
        const updatedLibrary = { ...state.patternLibrary };
        if (updatedLibrary[rule.sourceFingerprint]) {
          updatedLibrary[rule.sourceFingerprint] = {
            ...updatedLibrary[rule.sourceFingerprint],
            promoted: false,
          };
        }

        set({
          deterministicRules: state.deterministicRules.filter(r => r.id !== ruleId),
          patternLibrary: updatedLibrary,
        });
      },

      getMetrics: () => {
        const state = get();
        const patterns = Object.values(state.patternLibrary);
        const avgConfidence = patterns.length > 0
          ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
          : 0;

        return {
          totalPatterns: patterns.length,
          promotedCount: state.deterministicRules.length,
          totalRuns: state.analysisHistory.length,
          averageConfidence: avgConfidence,
          intelligenceScore: computeIntelligenceScore(state),
        };
      },

      getLearningContext: () => {
        const state = get();
        const patterns = Object.values(state.patternLibrary);

        if (patterns.length === 0) return '';

        const promoted = patterns.filter(p => p.promoted);
        const emerging = patterns.filter(p => !p.promoted && p.observationCount >= 2);

        if (promoted.length === 0 && emerging.length === 0) return '';

        let context = `## Learned Patterns from ${state.analysisHistory.length} Previous Analyses\n\n`;

        if (promoted.length > 0) {
          context += '### Deterministic Rules (High Confidence)\n';
          context += 'These patterns have been consistently observed and are now enforced as rules:\n\n';
          for (const p of promoted) {
            context += `- **${p.description}** (seen ${p.observationCount}x, ${Math.round(p.confidence * 100)}% confidence)\n`;
            context += `  Recommendation: ${p.recommendation}\n\n`;
          }
        }

        if (emerging.length > 0) {
          context += '### Emerging Patterns\n';
          context += 'These patterns are being tracked and may become rules:\n\n';
          for (const p of emerging.slice(0, 10)) {
            context += `- **${p.description}** (seen ${p.observationCount}x, ${Math.round(p.confidence * 100)}% confidence)\n`;
          }
        }

        return context;
      },

      getEligibleForPromotion: () => {
        const state = get();
        return Object.values(state.patternLibrary).filter(
          p => !p.promoted &&
               p.observationCount >= PROMOTION_THRESHOLD_COUNT &&
               p.confidence >= PROMOTION_THRESHOLD_CONFIDENCE
        );
      },

      clearAll: () => {
        set({
          patternLibrary: {},
          deterministicRules: [],
          analysisHistory: [],
        });
      },
    }),
    {
      name: 'calmguard-learning-v1',
    },
  ),
);

/**
 * Compare severity levels. Returns positive if a > b.
 */
function compareSeverity(a: string, b: string): number {
  const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  return (order[a] ?? 0) - (order[b] ?? 0);
}
