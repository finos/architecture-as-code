import { describe, it, expect } from 'vitest';
import { parseCalm, getRelationshipVariant } from '@/lib/calm';
import complexArchitecture from '../fixtures/canonical/complex.architecture.json';
import test12Architecture from '../fixtures/canonical/test.architecture.1.2.json';
import { DEMO_ARCHITECTURES } from '../../../examples';

/**
 * Cross-tool interoperability gate.
 *
 * These are real canonical CALM documents authored by OTHER tools in the repo
 * (the VSCode plugin fixtures). They use the canonical NESTED `relationship-type`
 * form. If CALMGuard cannot parse them, a user moving a document from Studio /
 * the CLI / Hub into CALMGuard would hit a hard rejection — the exact footgun
 * this migration removes.
 */
describe('canonical CALM interop — nested relationship-type', () => {
  it('parses a canonical doc exercising all four concrete variants (connects, interacts, deployed-in, composed-of)', () => {
    const result = parseCalm(complexArchitecture);
    expect(result.success).toBe(true);

    if (result.success) {
      const variants = new Set(result.data.relationships.map(getRelationshipVariant));
      expect(variants).toContain('connects');
      expect(variants).toContain('interacts');
      expect(variants).toContain('deployed-in');
      expect(variants).toContain('composed-of');
    }
  });

  it('parses a canonical 1.2 document', () => {
    const result = parseCalm(test12Architecture);
    expect(result.success).toBe(true);
  });

  it('rejects the legacy flat relationship-type form (dialect fully retired)', () => {
    const flat = {
      nodes: [
        { 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'A' },
        { 'unique-id': 'b', 'node-type': 'service', name: 'B', description: 'B' },
      ],
      relationships: [
        {
          'unique-id': 'r1',
          'relationship-type': 'connects',
          connects: { source: { node: 'a' }, destination: { node: 'b' } },
        },
      ],
    };
    const result = parseCalm(flat);
    expect(result.success).toBe(false);
  });
});

describe('bundled demo architectures parse cleanly', () => {
  it.each(DEMO_ARCHITECTURES.map((d) => [d.id, d.data] as const))(
    'demo "%s" is a parseable CALM document',
    (_id, data) => {
      const result = parseCalm(data);
      expect(result.success).toBe(true);
    }
  );
});
