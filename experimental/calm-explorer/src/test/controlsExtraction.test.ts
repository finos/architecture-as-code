import { describe, it, expect } from 'vitest';
import { calmWithControls } from './mockData/calmSamples';
import { extractId } from '@/utils/calmHelpers';

/**
 * Tests for controls extraction logic
 * This validates the current behavior before refactoring
 */

// Current implementation from Index.tsx (will be refactored)
function extractAllControls(parsedData: any) {
  const rootControls = parsedData?.controls || {};
  const nodeControls: Record<string, any> = {};
  const relationshipControls: Record<string, any> = {};

  // Extract controls from nodes
  const nodes = parsedData?.nodes || [];
  nodes.forEach((node: any) => {
    if (node.controls) {
      const nodeId = extractId(node);
      Object.entries(node.controls).forEach(([controlId, control]: [string, any]) => {
        const uniqueControlId = `${nodeId}/${controlId}`;
        nodeControls[uniqueControlId] = {
          ...control,
          appliesTo: nodeId,
          nodeName: node.name || nodeId,
          appliesToType: 'node',
        };
      });
    }
  });

  // Extract controls from relationships
  const relationships = parsedData?.relationships || [];
  relationships.forEach((relationship: any) => {
    if (relationship.controls) {
      const relId = extractId(relationship);
      Object.entries(relationship.controls).forEach(([controlId, control]: [string, any]) => {
        const uniqueControlId = `${relId}/${controlId}`;
        relationshipControls[uniqueControlId] = {
          ...control,
          appliesTo: relId,
          relationshipDescription: relationship.description || relId,
          appliesToType: 'relationship',
        };
      });
    }
  });

  return { ...nodeControls, ...relationshipControls, ...rootControls };
}

describe('Controls Extraction', () => {
  describe('extractAllControls', () => {
    it('should extract controls from nodes', () => {
      const controls = extractAllControls(calmWithControls);

      expect(controls['node-1/control-1']).toBeDefined();
      expect(controls['node-1/control-1'].description).toBe('TLS encryption required');
      expect(controls['node-1/control-1'].appliesTo).toBe('node-1');
      expect(controls['node-1/control-1'].appliesToType).toBe('node');
      expect(controls['node-1/control-1'].nodeName).toBe('Service A');
    });

    it('should extract multiple controls from same node', () => {
      const controls = extractAllControls(calmWithControls);

      expect(controls['node-1/control-1']).toBeDefined();
      expect(controls['node-1/control-2']).toBeDefined();
      expect(controls['node-1/control-2'].description).toBe('Authentication required');
    });

    it('should extract controls from relationships', () => {
      const controls = extractAllControls(calmWithControls);

      expect(controls['rel-1/rel-control-1']).toBeDefined();
      expect(controls['rel-1/rel-control-1'].description).toBe('Encrypted connection');
      expect(controls['rel-1/rel-control-1'].appliesTo).toBe('rel-1');
      expect(controls['rel-1/rel-control-1'].appliesToType).toBe('relationship');
    });

    it('should extract root-level controls', () => {
      const controls = extractAllControls(calmWithControls);

      expect(controls['global-control-1']).toBeDefined();
      expect(controls['global-control-1'].description).toBe('System-wide control');
    });

    it('should give precedence to root controls over node/relationship controls for same ID', () => {
      const data = {
        nodes: [
          {
            'unique-id': 'node-1',
            name: 'Test',
            controls: {
              'shared-control': { description: 'From node' },
            },
          },
        ],
        relationships: [],
        controls: {
          'shared-control': { description: 'From root' },
        },
      };

      const controls = extractAllControls(data);
      // Root control should overwrite node control due to spread order
      expect(controls['shared-control'].description).toBe('From root');
    });

    it('should handle empty controls gracefully', () => {
      const data = {
        nodes: [],
        relationships: [],
      };

      const controls = extractAllControls(data);
      expect(Object.keys(controls)).toHaveLength(0);
    });

    it('should handle missing controls property', () => {
      const data = {
        nodes: [
          { 'unique-id': 'node-1', name: 'No controls' },
        ],
        relationships: [],
      };

      const controls = extractAllControls(data);
      expect(Object.keys(controls)).toHaveLength(0);
    });

    it('should create unique control IDs with node/relationship prefix', () => {
      const controls = extractAllControls(calmWithControls);
      const keys = Object.keys(controls);

      expect(keys).toContain('node-1/control-1');
      expect(keys).toContain('node-1/control-2');
      expect(keys).toContain('rel-1/rel-control-1');
      expect(keys).toContain('global-control-1');
    });

    it('should preserve control requirements', () => {
      const controls = extractAllControls(calmWithControls);

      expect(controls['node-1/control-1'].requirements).toBeDefined();
      expect(controls['node-1/control-1'].requirements).toHaveLength(1);
      expect(controls['node-1/control-1'].requirements[0]['requirement-url']).toBe(
        'https://example.com/req1'
      );
    });

    it('should handle relationship without description', () => {
      const data = {
        nodes: [],
        relationships: [
          {
            'unique-id': 'rel-no-desc',
            controls: {
              'control-1': { description: 'Test' },
            },
          },
        ],
      };

      const controls = extractAllControls(data);
      expect(controls['rel-no-desc/control-1'].relationshipDescription).toBe('rel-no-desc');
    });
  });

  describe('controls count', () => {
    it('should count total controls correctly', () => {
      const controls = extractAllControls(calmWithControls);
      const count = Object.keys(controls).length;

      // 2 from node-1, 1 from rel-1, 1 global = 4 total
      expect(count).toBe(4);
    });

    it('should count only node controls', () => {
      const controls = extractAllControls(calmWithControls);
      const nodeControlKeys = Object.keys(controls).filter(key => key.startsWith('node-'));
      expect(nodeControlKeys).toHaveLength(2);
    });

    it('should count only relationship controls', () => {
      const controls = extractAllControls(calmWithControls);
      const relControlKeys = Object.keys(controls).filter(key => key.startsWith('rel-'));
      expect(relControlKeys).toHaveLength(1);
    });
  });
});
