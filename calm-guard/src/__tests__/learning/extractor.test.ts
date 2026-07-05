import { describe, it, expect } from 'vitest';
import { extractPatterns } from '@/lib/learning/extractor';
import type { ComplianceMapping } from '@/lib/agents/compliance-mapper';
import type { AnalysisInput } from '@/lib/calm/extractor';

const mockInput: AnalysisInput = {
  nodes: [
    {
      'unique-id': 'payment-service',
      'node-type': 'service',
      name: 'Payment Service',
      description: 'Processes payments',
    },
    {
      'unique-id': 'payment-db',
      'node-type': 'database',
      name: 'Payment Database',
      description: 'Stores payment data',
      controls: {
        'backup-recovery': { description: 'Daily backups' },
      },
    },
  ],
  relationships: [
    {
      'unique-id': 'conn-svc-db',
      'relationship-type': 'connects' as const,
      protocol: 'HTTP' as const,
      connects: {
        source: { node: 'payment-service' },
        destination: { node: 'payment-db' },
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

const mockCompliance: ComplianceMapping = {
  frameworkMappings: [
    {
      framework: 'PCI-DSS',
      controlId: 'Req-4.2',
      controlName: 'Protect CHD in transit',
      calmControlId: 'data-encryption',
      status: 'non-compliant',
      evidence: 'HTTP protocol used for database connection',
      recommendation: 'Upgrade to HTTPS/TLS',
      severity: 'critical',
    },
    {
      framework: 'SOX',
      controlId: 'ITGC-2.1',
      controlName: 'Audit Logging',
      calmControlId: 'audit-logging',
      status: 'partial',
      evidence: 'Partial logging on payment service',
      recommendation: 'Add comprehensive audit logging',
      severity: 'high',
    },
    {
      framework: 'PCI-DSS',
      controlId: 'Req-1.1',
      controlName: 'Network Security',
      calmControlId: null,
      status: 'compliant',
      evidence: 'Network controls in place',
      recommendation: '',
      severity: 'info',
    },
  ],
  frameworkScores: [
    { framework: 'PCI-DSS', score: 45, totalControls: 10, compliantControls: 4, partialControls: 2, nonCompliantControls: 4 },
    { framework: 'SOX', score: 65, totalControls: 8, compliantControls: 5, partialControls: 2, nonCompliantControls: 1 },
  ],
  gaps: [
    {
      framework: 'PCI-DSS',
      missingControl: 'multi-factor-authentication',
      description: 'No MFA on CDE access',
      severity: 'critical',
      recommendation: 'Implement MFA for all CDE access points',
    },
  ],
  summary: 'Test compliance summary',
};

describe('extractPatterns', () => {
  it('extracts patterns from non-compliant and partial findings', () => {
    const patterns = extractPatterns(mockCompliance, null, mockInput);

    // 2 from frameworkMappings (non-compliant + partial) + 1 from gaps = 3
    expect(patterns.length).toBeGreaterThanOrEqual(2);

    // All should have observationCount = 1
    for (const pattern of patterns) {
      expect(pattern.observationCount).toBe(1);
    }
  });

  it('skips compliant findings', () => {
    const patterns = extractPatterns(mockCompliance, null, mockInput);

    const compliantPatterns = patterns.filter(p => p.status === 'compliant');
    expect(compliantPatterns).toHaveLength(0);
  });

  it('generates unique fingerprints for different patterns', () => {
    const patterns = extractPatterns(mockCompliance, null, mockInput);

    const fingerprints = new Set(patterns.map(p => p.fingerprint));
    expect(fingerprints.size).toBe(patterns.length);
  });

  it('extracts patterns from compliance gaps', () => {
    const patterns = extractPatterns(mockCompliance, null, mockInput);

    const mfaPattern = patterns.find(p =>
      p.triggers.missingControls.includes('multi-factor-authentication')
    );
    expect(mfaPattern).toBeDefined();
    expect(mfaPattern!.framework).toBe('PCI-DSS');
    expect(mfaPattern!.severity).toBe('critical');
  });

  it('populates trigger fields from CALM input structure', () => {
    const patterns = extractPatterns(mockCompliance, null, mockInput);

    // At least one pattern should reference the HTTP protocol from the relationship
    const httpPattern = patterns.find(p => p.triggers.protocols.includes('HTTP'));
    expect(httpPattern).toBeDefined();
  });

  it('includes framework and status in each pattern', () => {
    const patterns = extractPatterns(mockCompliance, null, mockInput);

    for (const pattern of patterns) {
      expect(pattern.framework).toBeTruthy();
      expect(['non-compliant', 'partial']).toContain(pattern.status);
    }
  });

  it('deduplicates patterns with the same fingerprint within a single extraction', () => {
    // Create compliance with duplicate structural findings
    const duplicateCompliance: ComplianceMapping = {
      ...mockCompliance,
      frameworkMappings: [
        ...mockCompliance.frameworkMappings,
        // Same structure as existing non-compliant mapping
        {
          framework: 'PCI-DSS',
          controlId: 'Req-4.2-alt',
          controlName: 'Another encryption check',
          calmControlId: 'data-encryption',
          status: 'non-compliant',
          evidence: 'Duplicate check',
          recommendation: 'Upgrade to HTTPS/TLS',
          severity: 'critical',
        },
      ],
    };

    const patterns = extractPatterns(duplicateCompliance, null, mockInput);
    const fingerprints = patterns.map(p => p.fingerprint);
    const uniqueFingerprints = new Set(fingerprints);

    expect(uniqueFingerprints.size).toBe(fingerprints.length);
  });

  it('returns empty array when no non-compliant or partial findings exist', () => {
    const allCompliant: ComplianceMapping = {
      frameworkMappings: [
        {
          framework: 'PCI-DSS',
          controlId: 'Req-1.1',
          controlName: 'Test',
          calmControlId: null,
          status: 'compliant',
          evidence: 'Good',
          recommendation: '',
          severity: 'info',
        },
      ],
      frameworkScores: [],
      gaps: [],
      summary: 'All good',
    };

    const patterns = extractPatterns(allCompliant, null, mockInput);
    expect(patterns).toHaveLength(0);
  });
});
