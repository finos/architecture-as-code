import { describe, it, expect, beforeEach } from 'vitest';
import { useLearningStore } from '@/lib/learning/store';
import type { AnalysisResult } from '@/lib/agents/orchestrator';
import type { AnalysisInput } from '@/lib/calm/extractor';

const mockInput: AnalysisInput = {
  nodes: [
    {
      'unique-id': 'svc-1',
      'node-type': 'service',
      name: 'Service A',
      description: 'A service',
    },
    {
      'unique-id': 'db-1',
      'node-type': 'database',
      name: 'Database A',
      description: 'A database',
    },
  ],
  relationships: [
    {
      'unique-id': 'conn-1',
      'relationship-type': 'connects' as const,
      protocol: 'HTTP' as const,
      connects: {
        source: { node: 'svc-1' },
        destination: { node: 'db-1' },
      },
    },
  ],
  controls: {},
  flows: [],
  metadata: {
    nodeCount: 2,
    relationshipCount: 1,
    controlCount: 0,
    flowCount: 0,
    nodeTypes: { service: 1, database: 1 },
    relationshipTypes: { connects: 1 },
    protocols: ['HTTP' as const],
  },
};

function makeResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    architecture: null,
    compliance: {
      frameworkMappings: [
        {
          framework: 'PCI-DSS',
          controlId: 'Req-4.2',
          controlName: 'Encrypt CHD in transit',
          calmControlId: 'data-encryption',
          status: 'non-compliant',
          evidence: 'HTTP used',
          recommendation: 'Use HTTPS',
          severity: 'critical',
        },
      ],
      frameworkScores: [
        { framework: 'PCI-DSS', score: 40, totalControls: 10, compliantControls: 4, partialControls: 0, nonCompliantControls: 6 },
      ],
      gaps: [],
      summary: 'test',
    },
    pipeline: null,
    cloudInfra: null,
    risk: {
      overallScore: 45,
      overallRating: 'medium',
      frameworkScores: [{ framework: 'PCI-DSS', score: 40, rating: 'medium' }],
      nodeRiskMap: [],
      topFindings: [],
      summary: 'test',
      executiveSummary: 'test',
    },
    duration: 5000,
    completedAgents: ['compliance-mapper', 'risk-scorer'],
    failedAgents: [],
    ...overrides,
  };
}

describe('useLearningStore', () => {
  beforeEach(() => {
    useLearningStore.getState().clearAll();
  });

  describe('recordAnalysis', () => {
    it('creates patterns on first analysis', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);

      const state = useLearningStore.getState();
      expect(Object.keys(state.patternLibrary).length).toBeGreaterThan(0);
      expect(state.analysisHistory).toHaveLength(1);
    });

    it('increments observation count on repeated analysis', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);

      const state = useLearningStore.getState();
      const patterns = Object.values(state.patternLibrary);

      // Patterns seen twice should have observationCount >= 2
      const repeated = patterns.filter(p => p.observationCount >= 2);
      expect(repeated.length).toBeGreaterThan(0);
    });

    it('records analysis history for each run', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);

      const state = useLearningStore.getState();
      expect(state.analysisHistory).toHaveLength(3);
      expect(state.analysisHistory[0].overallScore).toBe(45);
    });

    it('tracks new patterns discovered per run', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);

      const state = useLearningStore.getState();
      expect(state.analysisHistory[0].newPatternsDiscovered).toBeGreaterThan(0);
    });

    it('tracks deterministic rules fired per run', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 3);

      const state = useLearningStore.getState();
      expect(state.analysisHistory[0].deterministicRulesFired).toBe(3);
    });

    it('skips recording when compliance data is null', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult({ compliance: null }), mockInput, 0);

      const state = useLearningStore.getState();
      expect(Object.keys(state.patternLibrary)).toHaveLength(0);
      expect(state.analysisHistory).toHaveLength(0);
    });
  });

  describe('auto-promotion', () => {
    it('promotes patterns after threshold observations', () => {
      const store = useLearningStore.getState();

      // Run 3 times to hit the promotion threshold (3 observations, >=75% confidence)
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);

      const state = useLearningStore.getState();
      expect(state.deterministicRules.length).toBeGreaterThan(0);

      // Promoted patterns should be marked
      const promoted = Object.values(state.patternLibrary).filter(p => p.promoted);
      expect(promoted.length).toBe(state.deterministicRules.length);
    });

    it('records patterns promoted count in run record', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);

      const state = useLearningStore.getState();
      // The 3rd run should have promoted patterns
      expect(state.analysisHistory[2].patternsPromoted).toBeGreaterThan(0);
    });
  });

  describe('promotePattern', () => {
    it('manually promotes a pattern to a rule', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);

      const state = useLearningStore.getState();
      const fingerprint = Object.keys(state.patternLibrary)[0];
      store.promotePattern(fingerprint);

      const updated = useLearningStore.getState();
      expect(updated.deterministicRules.length).toBeGreaterThan(0);
      expect(updated.patternLibrary[fingerprint].promoted).toBe(true);
    });

    it('does nothing for already promoted patterns', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);

      const state = useLearningStore.getState();
      const fingerprint = Object.keys(state.patternLibrary)[0];
      store.promotePattern(fingerprint);
      const countAfterFirst = useLearningStore.getState().deterministicRules.length;
      store.promotePattern(fingerprint);
      expect(useLearningStore.getState().deterministicRules.length).toBe(countAfterFirst);
    });
  });

  describe('removeRule', () => {
    it('removes a rule and un-promotes the source pattern', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);

      const fingerprint = Object.keys(useLearningStore.getState().patternLibrary)[0];
      store.promotePattern(fingerprint);

      const ruleId = useLearningStore.getState().deterministicRules[0].id;
      store.removeRule(ruleId);

      const state = useLearningStore.getState();
      expect(state.deterministicRules).toHaveLength(0);
      expect(state.patternLibrary[fingerprint].promoted).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('returns zeros for empty state', () => {
      const metrics = useLearningStore.getState().getMetrics();
      expect(metrics.totalPatterns).toBe(0);
      expect(metrics.promotedCount).toBe(0);
      expect(metrics.totalRuns).toBe(0);
      expect(metrics.averageConfidence).toBe(0);
      expect(metrics.intelligenceScore).toBe(0);
    });

    it('computes metrics after analyses', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);

      const metrics = store.getMetrics();
      expect(metrics.totalPatterns).toBeGreaterThan(0);
      expect(metrics.totalRuns).toBe(2);
      expect(metrics.averageConfidence).toBeGreaterThan(0);
      expect(metrics.intelligenceScore).toBeGreaterThan(0);
    });

    it('intelligence score increases with more runs and promotions', () => {
      const store = useLearningStore.getState();

      store.recordAnalysis(makeResult(), mockInput, 0);
      const score1 = store.getMetrics().intelligenceScore;

      store.recordAnalysis(makeResult(), mockInput, 0);
      const score2 = store.getMetrics().intelligenceScore;

      store.recordAnalysis(makeResult(), mockInput, 0);
      const score3 = store.getMetrics().intelligenceScore;

      // Score should generally increase (more data = more intelligence)
      expect(score2).toBeGreaterThanOrEqual(score1);
      expect(score3).toBeGreaterThanOrEqual(score2);
    });
  });

  describe('getLearningContext', () => {
    it('returns empty string for empty library', () => {
      const context = useLearningStore.getState().getLearningContext();
      expect(context).toBe('');
    });

    it('returns markdown with patterns after analyses', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);

      const context = store.getLearningContext();
      // Should contain markdown headers
      expect(context).toContain('## Learned Patterns from');
      expect(context).toContain('Emerging Patterns');
    });

    it('includes promoted rules as deterministic rules section', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.recordAnalysis(makeResult(), mockInput, 0);

      const context = store.getLearningContext();
      if (useLearningStore.getState().deterministicRules.length > 0) {
        expect(context).toContain('Deterministic Rules');
      }
    });
  });

  describe('clearAll', () => {
    it('resets all state', () => {
      const store = useLearningStore.getState();
      store.recordAnalysis(makeResult(), mockInput, 0);
      store.clearAll();

      const state = useLearningStore.getState();
      expect(Object.keys(state.patternLibrary)).toHaveLength(0);
      expect(state.deterministicRules).toHaveLength(0);
      expect(state.analysisHistory).toHaveLength(0);
    });
  });
});
