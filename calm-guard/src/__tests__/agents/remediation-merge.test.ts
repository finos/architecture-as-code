import { describe, it, expect } from 'vitest';
import { mergeRemediatedCalm } from '@/lib/agents/remediation-merge';
import type { CalmDocument } from '@/lib/calm/types';

/**
 * Minimal CALM document with rich controls that the LLM tends to strip.
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
            { 'requirement-url': 'https://www.pcisecuritystandards.org/document_library?category=pcidss&document=pci_dss' },
          ],
        },
        'secure-transmission': {
          description: 'All payment data transmitted over TLS 1.2 or higher',
          requirements: [
            { 'requirement-url': 'https://www.pcisecuritystandards.org/document_library?category=pcidss&document=pci_dss' },
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
            { 'requirement-url': 'https://www.pcisecuritystandards.org/document_library?category=pcidss&document=pci_dss' },
          ],
        },
        'api-authentication': {
          description: 'API key authentication with rate limiting',
          requirements: [
            { 'requirement-url': 'https://owasp.org/www-project-api-security/' },
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
      'unique-id': 'api-to-network',
      'relationship-type': 'connects' as const,
      description: 'API forwards to card network',
      protocol: 'HTTP' as const,
      connects: {
        source: { node: 'payment-api' },
        destination: { node: 'card-network' },
      },
    },
  ],
  controls: {},
  flows: [],
};

/**
 * Simulate what the LLM returns: controls stripped to {}, but protocol upgraded.
 */
const llmRemediatedDoc: CalmDocument = {
  nodes: [
    {
      'unique-id': 'checkout-page',
      'node-type': 'webclient',
      name: 'Checkout Page',
      description: 'PCI-DSS compliant payment form',
      controls: {},  // LLM stripped all controls!
      'data-classification': 'CONFIDENTIAL',
    },
    {
      'unique-id': 'payment-api',
      'node-type': 'service',
      name: 'Payment API',
      description: 'Payment processing endpoint',
      controls: {
        // LLM stripped original controls but added a new one
        'pci-dss-req-4.1': {
          description: 'Require strong cryptography for cardholder data transmission',
        },
      },
    },
    {
      'unique-id': 'card-network',
      'node-type': 'system',
      name: 'Card Network',
      description: 'External card network (Visa/Mastercard)',
      controls: {},
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
      'unique-id': 'api-to-network',
      'relationship-type': 'connects' as const,
      description: 'API forwards to card network',
      protocol: 'HTTPS' as const,  // LLM upgraded HTTP → HTTPS (good!)
      connects: {
        source: { node: 'payment-api' },
        destination: { node: 'card-network' },
      },
    },
  ],
  controls: {},
  flows: [],
};

describe('mergeRemediatedCalm', () => {
  it('preserves original controls that LLM stripped', () => {
    const merged = mergeRemediatedCalm(originalDoc, llmRemediatedDoc);

    const checkoutNode = merged.nodes.find(n => n['unique-id'] === 'checkout-page')!;
    expect(checkoutNode.controls).toBeDefined();
    expect(checkoutNode.controls!['input-validation']).toBeDefined();
    expect(checkoutNode.controls!['secure-transmission']).toBeDefined();
    expect(checkoutNode.controls!['input-validation'].description).toBe(
      'Client-side validation of card number format and CVV',
    );
  });

  it('keeps new controls added by LLM', () => {
    const merged = mergeRemediatedCalm(originalDoc, llmRemediatedDoc);

    const paymentNode = merged.nodes.find(n => n['unique-id'] === 'payment-api')!;
    // New control from LLM
    expect(paymentNode.controls!['pci-dss-req-4.1']).toBeDefined();
    expect(paymentNode.controls!['pci-dss-req-4.1'].description).toBe(
      'Require strong cryptography for cardholder data transmission',
    );
  });

  it('preserves original controls AND keeps new ones (merge, not replace)', () => {
    const merged = mergeRemediatedCalm(originalDoc, llmRemediatedDoc);

    const paymentNode = merged.nodes.find(n => n['unique-id'] === 'payment-api')!;
    // Original controls preserved
    expect(paymentNode.controls!['pci-dss-compliance']).toBeDefined();
    expect(paymentNode.controls!['api-authentication']).toBeDefined();
    // New control also present
    expect(paymentNode.controls!['pci-dss-req-4.1']).toBeDefined();
  });

  it('preserves protocol upgrades from LLM', () => {
    const merged = mergeRemediatedCalm(originalDoc, llmRemediatedDoc);

    const apiToNetwork = merged.relationships.find(r => r['unique-id'] === 'api-to-network')!;
    expect(apiToNetwork.protocol).toBe('HTTPS'); // upgraded from HTTP
  });

  it('preserves new fields added by LLM (data-classification)', () => {
    const merged = mergeRemediatedCalm(originalDoc, llmRemediatedDoc);

    const checkoutNode = merged.nodes.find(n => n['unique-id'] === 'checkout-page')!;
    expect(checkoutNode['data-classification']).toBe('CONFIDENTIAL');
  });

  it('preserves relationship controls from original', () => {
    const originalWithRelControls: CalmDocument = {
      ...originalDoc,
      relationships: [
        {
          'unique-id': 'checkout-to-api',
          'relationship-type': 'connects' as const,
          protocol: 'HTTPS' as const,
          connects: {
            source: { node: 'checkout-page' },
            destination: { node: 'payment-api' },
          },
          controls: {
            'tls-enforcement': {
              description: 'TLS 1.2+ enforced on all connections',
            },
          },
        },
      ],
    };

    const llmStrippedRelControls: CalmDocument = {
      ...llmRemediatedDoc,
      relationships: [
        {
          'unique-id': 'checkout-to-api',
          'relationship-type': 'connects' as const,
          protocol: 'HTTPS' as const,
          connects: {
            source: { node: 'checkout-page' },
            destination: { node: 'payment-api' },
          },
          controls: {}, // LLM stripped relationship controls too
        },
      ],
    };

    const merged = mergeRemediatedCalm(originalWithRelControls, llmStrippedRelControls);
    const rel = merged.relationships.find(r => r['unique-id'] === 'checkout-to-api')!;
    expect(rel.controls).toBeDefined();
    expect(rel.controls!['tls-enforcement']).toBeDefined();
  });

  it('preserves top-level controls from original', () => {
    const originalWithTopControls: CalmDocument = {
      ...originalDoc,
      controls: {
        'org-security-policy': {
          description: 'Organization-wide security policy',
        },
      },
    };

    const llmStrippedTopControls: CalmDocument = {
      ...llmRemediatedDoc,
      controls: {},
    };

    const merged = mergeRemediatedCalm(originalWithTopControls, llmStrippedTopControls);
    expect(merged.controls).toBeDefined();
    expect(merged.controls!['org-security-policy']).toBeDefined();
  });

  it('uses original document as base when LLM drops nodes', () => {
    // LLM might drop a node entirely
    const llmWithMissingNode: CalmDocument = {
      ...llmRemediatedDoc,
      nodes: llmRemediatedDoc.nodes.filter(n => n['unique-id'] !== 'card-network'),
    };

    const merged = mergeRemediatedCalm(originalDoc, llmWithMissingNode);
    // card-network should still be present from original
    const cardNetwork = merged.nodes.find(n => n['unique-id'] === 'card-network');
    expect(cardNetwork).toBeDefined();
  });

  it('uses original document as base when LLM drops relationships', () => {
    const llmWithMissingRel: CalmDocument = {
      ...llmRemediatedDoc,
      relationships: llmRemediatedDoc.relationships.filter(
        r => r['unique-id'] !== 'checkout-to-api',
      ),
    };

    const merged = mergeRemediatedCalm(originalDoc, llmWithMissingRel);
    const checkoutToApi = merged.relationships.find(r => r['unique-id'] === 'checkout-to-api');
    expect(checkoutToApi).toBeDefined();
  });
});
