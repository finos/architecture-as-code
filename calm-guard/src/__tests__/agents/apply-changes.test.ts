import { describe, it, expect } from 'vitest';
import { applyChangesToCalm } from '@/lib/agents/remediation-merge';
import type { CalmDocument } from '@/lib/calm/types';
import type { CalmRemediationOutput } from '@/lib/agents/calm-remediator';

/**
 * Minimal CALM document matching the payment-gateway structure.
 */
const originalDoc: CalmDocument = {
  nodes: [
    {
      'unique-id': 'checkout-page',
      'node-type': 'webclient',
      name: 'Checkout Page',
      description: 'PCI-DSS compliant payment form',
      controls: {
        'input-validation': {
          description: 'Client-side validation of card number format and CVV',
          requirements: [
            { 'requirement-url': 'https://www.pcisecuritystandards.org/document_library' },
          ],
        },
      },
    },
    {
      'unique-id': 'payment-api',
      'node-type': 'service',
      name: 'Payment API',
      description: 'Payment processing endpoint',
      controls: {
        'pci-dss-compliance': {
          description: 'PCI-DSS SAQ-D compliant service',
          requirements: [
            { 'requirement-url': 'https://www.pcisecuritystandards.org/document_library' },
          ],
        },
      },
    },
    {
      'unique-id': 'card-network',
      'node-type': 'system',
      name: 'Card Network',
      description: 'External card network (Visa/Mastercard)',
    },
  ],
  relationships: [
    {
      'unique-id': 'checkout-to-api',
      'relationship-type': 'connects' as const,
      description: 'Checkout submits payment data',
      protocol: 'HTTPS' as const,
      connects: {
        source: { node: 'checkout-page' },
        destination: { node: 'payment-api' },
      },
    },
    {
      'unique-id': 'api-to-db',
      'relationship-type': 'connects' as const,
      description: 'API persists transaction records',
      protocol: 'JDBC' as const,
      connects: {
        source: { node: 'payment-api' },
        destination: { node: 'transaction-database' },
      },
    },
  ],
  controls: {},
  flows: [],
};

describe('applyChangesToCalm', () => {
  it('adds a control to a node when changeType is control-added', () => {
    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'payment-api',
        changeType: 'control-added',
        description: 'Added MFA control',
        rationale: 'PCI-DSS 8.4.2 requires MFA for CDE access',
        before: 'N/A',
        after: 'pci-dss-req-8-4-2-mfa',
      },
    ];

    const result = applyChangesToCalm(originalDoc, changes);
    const node = result.nodes.find(n => n['unique-id'] === 'payment-api')!;

    expect(node.controls!['pci-dss-req-8-4-2-mfa']).toBeDefined();
    expect(node.controls!['pci-dss-req-8-4-2-mfa'].description).toBe('PCI-DSS 8.4.2 requires MFA for CDE access');
  });

  it('preserves all original controls when adding new ones', () => {
    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'payment-api',
        changeType: 'control-added',
        description: 'Added MFA',
        rationale: 'PCI-DSS 8.4.2',
        before: 'N/A',
        after: 'pci-dss-req-8-4-2-mfa',
      },
    ];

    const result = applyChangesToCalm(originalDoc, changes);
    const node = result.nodes.find(n => n['unique-id'] === 'payment-api')!;

    // Original control preserved
    expect(node.controls!['pci-dss-compliance']).toBeDefined();
    // New control added
    expect(node.controls!['pci-dss-req-8-4-2-mfa']).toBeDefined();
  });

  it('adds controls to a node that had no controls', () => {
    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'card-network',
        changeType: 'control-added',
        description: 'Added third-party management',
        rationale: 'NIST CSF GV.SC-02',
        before: 'N/A',
        after: 'nist-csf-gv-sc-02-third-party-management',
      },
    ];

    const result = applyChangesToCalm(originalDoc, changes);
    const node = result.nodes.find(n => n['unique-id'] === 'card-network')!;

    expect(node.controls).toBeDefined();
    expect(node.controls!['nist-csf-gv-sc-02-third-party-management']).toBeDefined();
  });

  it('upgrades protocol on a relationship', () => {
    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'api-to-db',
        changeType: 'protocol-upgrade',
        description: 'Upgraded JDBC to TLS',
        rationale: 'PCI-DSS 4.2.1 requires encrypted transmission',
        before: 'JDBC',
        after: 'TLS',
      },
    ];

    const result = applyChangesToCalm(originalDoc, changes);
    const rel = result.relationships.find(r => r['unique-id'] === 'api-to-db')!;

    expect(rel.protocol).toBe('TLS');
  });

  it('does not downgrade protocol if after is weaker', () => {
    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'checkout-to-api',
        changeType: 'protocol-upgrade',
        description: 'Changed HTTPS to HTTP',
        rationale: 'Some bad reason',
        before: 'HTTPS',
        after: 'HTTP',
      },
    ];

    const result = applyChangesToCalm(originalDoc, changes);
    const rel = result.relationships.find(r => r['unique-id'] === 'checkout-to-api')!;

    // Should keep HTTPS, not downgrade to HTTP
    expect(rel.protocol).toBe('HTTPS');
  });

  it('applies multiple changes across multiple nodes', () => {
    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'payment-api',
        changeType: 'control-added',
        description: 'Added MFA',
        rationale: 'PCI-DSS 8.4.2',
        before: 'N/A',
        after: 'pci-dss-req-8-4-2-mfa',
      },
      {
        nodeOrRelationshipId: 'payment-api',
        changeType: 'control-added',
        description: 'Added network segmentation',
        rationale: 'PCI-DSS 1.2.1',
        before: 'N/A',
        after: 'pci-dss-req-1-2-1-network-segmentation',
      },
      {
        nodeOrRelationshipId: 'checkout-page',
        changeType: 'control-added',
        description: 'Added WAF',
        rationale: 'PCI-DSS 6.4.2',
        before: 'N/A',
        after: 'pci-dss-req-6-4-2-waf',
      },
      {
        nodeOrRelationshipId: 'api-to-db',
        changeType: 'protocol-upgrade',
        description: 'Upgraded JDBC to TLS',
        rationale: 'PCI-DSS 4.2.1',
        before: 'JDBC',
        after: 'TLS',
      },
    ];

    const result = applyChangesToCalm(originalDoc, changes);

    // payment-api: 2 new controls + 1 original
    const paymentApi = result.nodes.find(n => n['unique-id'] === 'payment-api')!;
    expect(Object.keys(paymentApi.controls!)).toHaveLength(3);
    expect(paymentApi.controls!['pci-dss-req-8-4-2-mfa']).toBeDefined();
    expect(paymentApi.controls!['pci-dss-req-1-2-1-network-segmentation']).toBeDefined();
    expect(paymentApi.controls!['pci-dss-compliance']).toBeDefined();

    // checkout-page: 1 new + 1 original
    const checkout = result.nodes.find(n => n['unique-id'] === 'checkout-page')!;
    expect(checkout.controls!['pci-dss-req-6-4-2-waf']).toBeDefined();
    expect(checkout.controls!['input-validation']).toBeDefined();

    // api-to-db: protocol upgraded
    const rel = result.relationships.find(r => r['unique-id'] === 'api-to-db')!;
    expect(rel.protocol).toBe('TLS');
  });

  it('adds control to a relationship when target is a relationship id', () => {
    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'checkout-to-api',
        changeType: 'control-added',
        description: 'Added mutual TLS enforcement',
        rationale: 'SOC2 CC6.7',
        before: 'N/A',
        after: 'soc2-cc6-7-mtls-enforcement',
      },
    ];

    const result = applyChangesToCalm(originalDoc, changes);
    const rel = result.relationships.find(r => r['unique-id'] === 'checkout-to-api')!;

    expect(rel.controls).toBeDefined();
    expect(rel.controls!['soc2-cc6-7-mtls-enforcement']).toBeDefined();
  });

  it('adds top-level controls when target id is not a node or relationship', () => {
    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'remediatedCalm',
        changeType: 'control-added',
        description: 'Added cybersecurity policy',
        rationale: 'NIST CSF GV.PO-01',
        before: 'N/A',
        after: 'nist-csf-gv-po-01-security-policy',
      },
    ];

    const result = applyChangesToCalm(originalDoc, changes);

    expect(result.controls).toBeDefined();
    expect(result.controls!['nist-csf-gv-po-01-security-policy']).toBeDefined();
  });

  it('does not mutate the original document', () => {
    const originalControlCount = Object.keys(originalDoc.nodes[1].controls || {}).length;

    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'payment-api',
        changeType: 'control-added',
        description: 'Added MFA',
        rationale: 'PCI-DSS 8.4.2',
        before: 'N/A',
        after: 'pci-dss-req-8-4-2-mfa',
      },
    ];

    applyChangesToCalm(originalDoc, changes);

    // Original should be unchanged
    expect(Object.keys(originalDoc.nodes[1].controls || {})).toHaveLength(originalControlCount);
  });

  it('skips changes referencing unknown element ids', () => {
    const changes: CalmRemediationOutput['changes'] = [
      {
        nodeOrRelationshipId: 'nonexistent-node',
        changeType: 'control-added',
        description: 'Added something',
        rationale: 'Some reason',
        before: 'N/A',
        after: 'some-control',
      },
    ];

    // Should not throw, and top-level controls should get the fallback
    const result = applyChangesToCalm(originalDoc, changes);
    // Falls back to top-level controls
    expect(result.controls!['some-control']).toBeDefined();
  });
});
