import { describe, it, expect } from 'vitest';
import { generateFingerprint } from '@/lib/learning/fingerprint';
import type { PatternTriggers } from '@/lib/learning/types';

describe('generateFingerprint', () => {
  it('produces deterministic output for the same inputs', () => {
    const triggers: PatternTriggers = {
      protocols: ['HTTP'],
      nodeTypes: ['service', 'database'],
      relationshipTypes: ['connects'],
      missingControls: ['data-encryption'],
    };

    const fp1 = generateFingerprint(triggers, 'PCI-DSS', 'non-compliant');
    const fp2 = generateFingerprint(triggers, 'PCI-DSS', 'non-compliant');
    expect(fp1).toBe(fp2);
  });

  it('is order-independent within trigger arrays', () => {
    const triggers1: PatternTriggers = {
      protocols: ['HTTP', 'JDBC'],
      nodeTypes: ['database', 'service'],
      relationshipTypes: ['connects'],
      missingControls: ['audit-logging', 'data-encryption'],
    };
    const triggers2: PatternTriggers = {
      protocols: ['JDBC', 'HTTP'],
      nodeTypes: ['service', 'database'],
      relationshipTypes: ['connects'],
      missingControls: ['data-encryption', 'audit-logging'],
    };

    expect(generateFingerprint(triggers1, 'SOX', 'partial'))
      .toBe(generateFingerprint(triggers2, 'SOX', 'partial'));
  });

  it('produces different fingerprints for different triggers', () => {
    const triggersA: PatternTriggers = {
      protocols: ['HTTP'],
      nodeTypes: ['service'],
      relationshipTypes: ['connects'],
      missingControls: [],
    };
    const triggersB: PatternTriggers = {
      protocols: ['HTTPS'],
      nodeTypes: ['service'],
      relationshipTypes: ['connects'],
      missingControls: [],
    };

    expect(generateFingerprint(triggersA, 'PCI-DSS', 'non-compliant'))
      .not.toBe(generateFingerprint(triggersB, 'PCI-DSS', 'non-compliant'));
  });

  it('produces different fingerprints for different frameworks', () => {
    const triggers: PatternTriggers = {
      protocols: ['HTTP'],
      nodeTypes: ['service'],
      relationshipTypes: [],
      missingControls: [],
    };

    expect(generateFingerprint(triggers, 'PCI-DSS', 'non-compliant'))
      .not.toBe(generateFingerprint(triggers, 'SOX', 'non-compliant'));
  });

  it('produces different fingerprints for different statuses', () => {
    const triggers: PatternTriggers = {
      protocols: ['HTTP'],
      nodeTypes: ['service'],
      relationshipTypes: [],
      missingControls: [],
    };

    expect(generateFingerprint(triggers, 'PCI-DSS', 'non-compliant'))
      .not.toBe(generateFingerprint(triggers, 'PCI-DSS', 'partial'));
  });

  it('handles empty trigger arrays', () => {
    const triggers: PatternTriggers = {
      protocols: [],
      nodeTypes: [],
      relationshipTypes: [],
      missingControls: [],
    };

    const fp = generateFingerprint(triggers, 'SOX', 'compliant');
    expect(fp).toBe('|||SOX|compliant');
  });

  it('does not mutate input arrays', () => {
    const protocols = ['JDBC', 'HTTP'];
    const triggers: PatternTriggers = {
      protocols,
      nodeTypes: ['database'],
      relationshipTypes: [],
      missingControls: [],
    };

    generateFingerprint(triggers, 'SOX', 'partial');
    expect(protocols).toEqual(['JDBC', 'HTTP']); // Original order preserved
  });
});
