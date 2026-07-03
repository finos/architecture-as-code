import { describe, it, expect } from 'vitest';
import { runDeterministicPreChecks } from '@/lib/learning/pre-check';
import type { DeterministicRule } from '@/lib/learning/types';
import type { AnalysisInput } from '@/lib/calm/extractor';

const mockInput: AnalysisInput = {
  nodes: [
    {
      'unique-id': 'api-service',
      'node-type': 'service',
      name: 'API Service',
      description: 'Core API',
      controls: {
        'access-control': { description: 'RBAC' },
      },
    },
    {
      'unique-id': 'main-db',
      'node-type': 'database',
      name: 'Main Database',
      description: 'Primary database',
    },
  ],
  relationships: [
    {
      'unique-id': 'conn-api-db',
      'relationship-type': 'connects' as const,
      protocol: 'HTTP' as const,
      connects: {
        source: { node: 'api-service' },
        destination: { node: 'main-db' },
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

const httpRule: DeterministicRule = {
  id: 'rule-001',
  sourceFingerprint: 'HTTP|database,service|connects||PCI-DSS|non-compliant',
  description: 'HTTP on database connection is non-compliant for PCI-DSS',
  framework: 'PCI-DSS',
  status: 'non-compliant',
  severity: 'critical',
  triggers: {
    protocols: ['HTTP'],
    nodeTypes: ['service', 'database'],
    relationshipTypes: ['connects'],
    missingControls: [],
  },
  recommendation: 'Upgrade to HTTPS/TLS',
  promotedAt: '2026-02-25T12:00:00Z',
  sourceObservations: 3,
  sourceConfidence: 1.0,
};

const missingControlRule: DeterministicRule = {
  id: 'rule-002',
  sourceFingerprint: '||database||audit-logging|SOX|non-compliant',
  description: 'Database without audit-logging is non-compliant for SOX',
  framework: 'SOX',
  status: 'non-compliant',
  severity: 'high',
  triggers: {
    protocols: [],
    nodeTypes: ['database'],
    relationshipTypes: [],
    missingControls: ['audit-logging'],
  },
  recommendation: 'Add audit-logging control to database nodes',
  promotedAt: '2026-02-25T12:00:00Z',
  sourceObservations: 4,
  sourceConfidence: 0.9,
};

describe('runDeterministicPreChecks', () => {
  it('returns empty array for empty rules', () => {
    const results = runDeterministicPreChecks(mockInput, []);
    expect(results).toHaveLength(0);
  });

  it('matches a rule when all trigger conditions are met', () => {
    const results = runDeterministicPreChecks(mockInput, [httpRule]);

    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe('rule-001');
    expect(results[0].framework).toBe('PCI-DSS');
    expect(results[0].severity).toBe('critical');
  });

  it('returns matched nodes and relationships', () => {
    const results = runDeterministicPreChecks(mockInput, [httpRule]);

    expect(results[0].matchedRelationships).toContain('conn-api-db');
    expect(results[0].matchedNodes.length).toBeGreaterThan(0);
  });

  it('matches rules based on missing controls', () => {
    const results = runDeterministicPreChecks(mockInput, [missingControlRule]);

    // main-db has no audit-logging control, so the rule should fire
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe('rule-002');
  });

  it('does not match when missing control is actually present', () => {
    const inputWithAuditLogging: AnalysisInput = {
      ...mockInput,
      nodes: mockInput.nodes.map(n => ({
        ...n,
        controls: {
          ...n.controls,
          'audit-logging': { description: 'Comprehensive logging' },
        },
      })),
    };

    const results = runDeterministicPreChecks(inputWithAuditLogging, [missingControlRule]);
    expect(results).toHaveLength(0);
  });

  it('does not match when protocol does not exist in input', () => {
    const httpsOnlyRule: DeterministicRule = {
      ...httpRule,
      id: 'rule-https',
      triggers: {
        ...httpRule.triggers,
        protocols: ['SFTP'], // Input has HTTP, not SFTP
      },
    };

    const results = runDeterministicPreChecks(mockInput, [httpsOnlyRule]);
    expect(results).toHaveLength(0);
  });

  it('does not match when node type does not exist in input', () => {
    const actorRule: DeterministicRule = {
      ...httpRule,
      id: 'rule-actor',
      triggers: {
        ...httpRule.triggers,
        nodeTypes: ['actor', 'ldap'], // Input has service and database, not actor/ldap
      },
    };

    const results = runDeterministicPreChecks(mockInput, [actorRule]);
    expect(results).toHaveLength(0);
  });

  it('evaluates multiple rules independently', () => {
    const results = runDeterministicPreChecks(mockInput, [httpRule, missingControlRule]);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.ruleId)).toContain('rule-001');
    expect(results.map(r => r.ruleId)).toContain('rule-002');
  });

  it('ignores empty trigger arrays (they always match)', () => {
    const broadRule: DeterministicRule = {
      ...httpRule,
      id: 'rule-broad',
      triggers: {
        protocols: [], // empty = always matches
        nodeTypes: ['database'],
        relationshipTypes: [],
        missingControls: [],
      },
    };

    const results = runDeterministicPreChecks(mockInput, [broadRule]);
    expect(results).toHaveLength(1);
  });

  it('filters rules by selected frameworks — only fires matching frameworks', () => {
    const results = runDeterministicPreChecks(mockInput, [httpRule, missingControlRule], ['PCI-DSS']);

    // httpRule is PCI-DSS (selected), missingControlRule is SOX (not selected)
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe('rule-001');
    expect(results[0].framework).toBe('PCI-DSS');
  });

  it('filters out all rules when no selected frameworks match', () => {
    const results = runDeterministicPreChecks(mockInput, [httpRule, missingControlRule], ['NIST-CSF']);
    expect(results).toHaveLength(0);
  });

  it('fires all matching rules when selectedFrameworks is undefined', () => {
    const results = runDeterministicPreChecks(mockInput, [httpRule, missingControlRule], undefined);
    expect(results).toHaveLength(2);
  });

  it('fires all matching rules when selectedFrameworks is empty array', () => {
    const results = runDeterministicPreChecks(mockInput, [httpRule, missingControlRule], []);
    expect(results).toHaveLength(2);
  });
});
