import { describe, it, expect } from 'vitest';
import {
  validCALMWithUniqueId,
  validCALMWithUnderscoreId,
  validCALMWithPlainId,
  invalidCALMNoIds,
} from './mockData/calmSamples';

/**
 * Tests for ID extraction patterns used throughout the codebase
 * This validates the current behavior before refactoring
 */

// Current implementation (will be refactored)
function extractId(obj: any): string | undefined {
  return obj?.['unique-id'] ?? obj?.unique_id ?? obj?.id;
}

function extractNodeType(node: any): string | undefined {
  return node?.['node-type'] ?? node?.node_type ?? node?.type;
}

describe('ID Extraction Patterns', () => {
  describe('extractId', () => {
    it('should extract hyphenated unique-id', () => {
      const node = validCALMWithUniqueId.nodes[0];
      expect(extractId(node)).toBe('node-1');
    });

    it('should extract underscore unique_id', () => {
      const node = validCALMWithUnderscoreId.nodes[0];
      expect(extractId(node)).toBe('node-1');
    });

    it('should extract plain id', () => {
      const node = validCALMWithPlainId.nodes[0];
      expect(extractId(node)).toBe('node-1');
    });

    it('should return undefined for missing ID', () => {
      const node = invalidCALMNoIds.nodes[0];
      expect(extractId(node)).toBeUndefined();
    });

    it('should return undefined for null input', () => {
      expect(extractId(null)).toBeUndefined();
    });

    it('should return undefined for undefined input', () => {
      expect(extractId(undefined)).toBeUndefined();
    });

    it('should prioritize unique-id over unique_id', () => {
      const node = {
        'unique-id': 'hyphenated',
        unique_id: 'underscore',
        id: 'plain',
      };
      expect(extractId(node)).toBe('hyphenated');
    });

    it('should prioritize unique_id over id', () => {
      const node = {
        unique_id: 'underscore',
        id: 'plain',
      };
      expect(extractId(node)).toBe('underscore');
    });

    it('should work with relationship objects', () => {
      const rel = validCALMWithUniqueId.relationships[0];
      expect(extractId(rel)).toBe('rel-1');
    });
  });

  describe('extractNodeType', () => {
    it('should extract hyphenated node-type', () => {
      const node = validCALMWithUniqueId.nodes[0];
      expect(extractNodeType(node)).toBe('service');
    });

    it('should extract underscore node_type', () => {
      const node = validCALMWithUnderscoreId.nodes[0];
      expect(extractNodeType(node)).toBe('service');
    });

    it('should extract plain type', () => {
      const node = validCALMWithPlainId.nodes[0];
      expect(extractNodeType(node)).toBe('service');
    });

    it('should handle database type', () => {
      const node = validCALMWithUniqueId.nodes[1];
      expect(extractNodeType(node)).toBe('database');
    });

    it('should return undefined for missing type', () => {
      const node = { name: 'No type' };
      expect(extractNodeType(node)).toBeUndefined();
    });

    it('should prioritize node-type over node_type', () => {
      const node = {
        'node-type': 'hyphenated',
        node_type: 'underscore',
        type: 'plain',
      };
      expect(extractNodeType(node)).toBe('hyphenated');
    });
  });

  describe('ID extraction in arrays', () => {
    it('should extract IDs from all nodes in array', () => {
      const nodes = validCALMWithUniqueId.nodes;
      const ids = nodes.map(extractId).filter(Boolean);
      expect(ids).toEqual(['node-1', 'node-2']);
    });

    it('should extract IDs from all relationships in array', () => {
      const rels = validCALMWithUniqueId.relationships;
      const ids = rels.map(extractId).filter(Boolean);
      expect(ids).toEqual(['rel-1']);
    });

    it('should handle mixed ID formats in same array', () => {
      const mixed = [
        { 'unique-id': 'node-1' },
        { unique_id: 'node-2' },
        { id: 'node-3' },
      ];
      const ids = mixed.map(extractId);
      expect(ids).toEqual(['node-1', 'node-2', 'node-3']);
    });
  });
});
