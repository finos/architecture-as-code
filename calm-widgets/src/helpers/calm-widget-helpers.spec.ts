import { describe, it, expect, beforeEach } from 'vitest';
import { CalmWidgetHelpers } from './calm-widget-helpers.js';

describe('CalmWidgetHelpers', () => {
  describe('getHelpers', () => {
    it('should return an object with helper functions', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers).toBeDefined();
      expect(typeof helpers).toBe('object');
    });

    it('should include table helper', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers.table).toBeDefined();
      expect(typeof helpers.table).toBe('function');
    });

    it('should include node helper', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers.node).toBeDefined();
      expect(typeof helpers.node).toBe('function');
    });

    it('should include all utility helpers', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers.getColumns).toBeDefined();
      expect(helpers.getValue).toBeDefined();
      expect(helpers.formatTableValue).toBeDefined();
      expect(helpers.getListItemValue).toBeDefined();
      expect(helpers.formatMetadataValue).toBeDefined();
      expect(helpers.formatControlValue).toBeDefined();
    });

    it('should return the correct number of helpers', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const helperKeys = Object.keys(helpers);
      
      expect(helperKeys.length).toBe(8); // All CALM widget helpers
    });
  });

  describe('tableHelper', () => {
    const mockArchitecture = {
      nodes: [
        {
          'unique-id': 'service-1',
          'node-type': 'service',
          name: 'Test Service',
          description: 'A test service'
        },
        {
          'unique-id': 'db-1',
          'node-type': 'datastore',
          name: 'Test Database',
          description: 'A test database'
        }
      ]
    };

    it('should handle empty data', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.table(null);
      
      expect(result).toBe('_No data found._');
    });

    it('should handle undefined data', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.table(undefined);
      
      expect(result).toBe('_No data found._');
    });

    it('should handle empty array', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.table([]);
      
      expect(result).toBe('_No data found._');
    });

    it('should generate table for array data', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.table(mockArchitecture.nodes);
      
      expect(result).toContain('|');
      expect(result).toContain('Unique Id');
      expect(result).toContain('service-1');
      expect(result).toContain('Test Service');
    });

    it('should handle filtering', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const options = {
        hash: {
          filter: 'node-type:service'
        }
      };
      const result = helpers.table(mockArchitecture.nodes, options);
      
      expect(result).toContain('service-1');
      expect(result).not.toContain('db-1');
    });

    it('should handle column selection', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const options = {
        hash: {
          columns: 'unique-id,name'
        }
      };
      const result = helpers.table(mockArchitecture.nodes, options);
      
      expect(result).toContain('unique-id');
      expect(result).toContain('name');
      expect(result).not.toContain('description');
    });
  });

  describe('nodeHelper', () => {
    const mockArchitecture = {
      nodes: [
        {
          'unique-id': 'service-1',
          name: 'Test Service',
          description: 'A test service'
        },
        {
          'unique-id': 'db-1',
          name: 'Test Database',
          description: 'A test database'
        }
      ]
    };

    it('should find node by unique-id', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.node(mockArchitecture, 'service-1');
      
      expect(result).toBeDefined();
      expect(result['unique-id']).toBe('service-1');
      expect(result.name).toBe('Test Service');
    });

    it('should return null for non-existent node', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.node(mockArchitecture, 'non-existent');
      
      expect(result).toBeNull();
    });

    it('should handle null architecture', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.node(null, 'service-1');
      
      expect(result).toBeNull();
    });

    it('should handle architecture without nodes', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.node({}, 'service-1');
      
      expect(result).toBeNull();
    });

    it('should handle architecture with non-array nodes', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.node({ nodes: 'not-an-array' }, 'service-1');
      
      expect(result).toBeNull();
    });
  });


});
