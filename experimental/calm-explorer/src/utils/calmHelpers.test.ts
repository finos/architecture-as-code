import { describe, it, expect } from 'vitest';
import { extractId, extractNodeType, extractRelationshipType } from './calmHelpers';

describe('calmHelpers', () => {
  describe('extractId', () => {
    it('extracts hyphenated unique-id field', () => {
      const obj = { 'unique-id': 'test-123' };
      expect(extractId(obj)).toBe('test-123');
    });

    it('extracts underscore unique_id field', () => {
      const obj = { unique_id: 'test-456' };
      expect(extractId(obj)).toBe('test-456');
    });

    it('extracts simple id field', () => {
      const obj = { id: 'test-789' };
      expect(extractId(obj)).toBe('test-789');
    });

    it('prioritizes unique-id over unique_id', () => {
      const obj = { 'unique-id': 'hyphen', unique_id: 'underscore' };
      expect(extractId(obj)).toBe('hyphen');
    });

    it('prioritizes unique-id over id', () => {
      const obj = { 'unique-id': 'hyphen', id: 'simple' };
      expect(extractId(obj)).toBe('hyphen');
    });

    it('prioritizes unique_id over id', () => {
      const obj = { unique_id: 'underscore', id: 'simple' };
      expect(extractId(obj)).toBe('underscore');
    });

    it('returns undefined for object without ID field', () => {
      const obj = { name: 'test' };
      expect(extractId(obj)).toBeUndefined();
    });

    it('handles null input', () => {
      expect(extractId(null)).toBeUndefined();
    });

    it('handles undefined input', () => {
      expect(extractId(undefined)).toBeUndefined();
    });

    it('handles empty object', () => {
      expect(extractId({})).toBeUndefined();
    });
  });

  describe('extractNodeType', () => {
    it('extracts hyphenated node-type field', () => {
      const node = { 'node-type': 'service' };
      expect(extractNodeType(node)).toBe('service');
    });

    it('extracts underscore node_type field', () => {
      const node = { node_type: 'datastore' };
      expect(extractNodeType(node)).toBe('datastore');
    });

    it('extracts simple type field', () => {
      const node = { type: 'system' };
      expect(extractNodeType(node)).toBe('system');
    });

    it('prioritizes node-type over node_type', () => {
      const node = { 'node-type': 'service', node_type: 'datastore' };
      expect(extractNodeType(node)).toBe('service');
    });

    it('prioritizes node-type over type', () => {
      const node = { 'node-type': 'service', type: 'system' };
      expect(extractNodeType(node)).toBe('service');
    });

    it('prioritizes node_type over type', () => {
      const node = { node_type: 'datastore', type: 'system' };
      expect(extractNodeType(node)).toBe('datastore');
    });

    it('returns undefined for object without type field', () => {
      const node = { name: 'test' };
      expect(extractNodeType(node)).toBeUndefined();
    });

    it('handles null input', () => {
      expect(extractNodeType(null)).toBeUndefined();
    });

    it('handles undefined input', () => {
      expect(extractNodeType(undefined)).toBeUndefined();
    });

    it('handles empty object', () => {
      expect(extractNodeType({})).toBeUndefined();
    });
  });

  describe('extractRelationshipType', () => {
    it('extracts hyphenated relationship-type field', () => {
      const rel = {
        'relationship-type': {
          connects: { source: {}, destination: {} }
        }
      };
      expect(extractRelationshipType(rel)).toEqual({
        connects: { source: {}, destination: {} }
      });
    });

    it('extracts underscore relationship_type field', () => {
      const rel = {
        relationship_type: {
          connects: { source: {}, destination: {} }
        }
      };
      expect(extractRelationshipType(rel)).toEqual({
        connects: { source: {}, destination: {} }
      });
    });

    it('prioritizes relationship-type over relationship_type', () => {
      const rel = {
        'relationship-type': { connects: { type: 'hyphen' } },
        relationship_type: { connects: { type: 'underscore' } }
      };
      expect(extractRelationshipType(rel)).toEqual({
        connects: { type: 'hyphen' }
      });
    });

    it('returns undefined for object without relationship type field', () => {
      const rel = { description: 'test' };
      expect(extractRelationshipType(rel)).toBeUndefined();
    });

    it('handles null input', () => {
      expect(extractRelationshipType(null)).toBeUndefined();
    });

    it('handles undefined input', () => {
      expect(extractRelationshipType(undefined)).toBeUndefined();
    });

    it('handles empty object', () => {
      expect(extractRelationshipType({})).toBeUndefined();
    });

    it('handles complex nested relationship type', () => {
      const rel = {
        'relationship-type': {
          connects: {
            source: { node: 'node-1', interface: 'interface-1' },
            destination: { node: 'node-2', interface: 'interface-2' }
          }
        }
      };
      const result = extractRelationshipType(rel);
      expect(result.connects.source.node).toBe('node-1');
      expect(result.connects.destination.node).toBe('node-2');
    });
  });
});
