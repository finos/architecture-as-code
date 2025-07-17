import { describe, it, expect } from 'vitest';
import { PathExtractor } from './path-extractor.js';
import { CalmArchitecture } from '../types/index.js';

describe('PathExtractor', () => {
  const mockArchitecture: CalmArchitecture = {
    'unique-id': 'test-arch',
    metadata: [
      { name: 'Test Architecture', version: '1.0' }
    ],
    nodes: [
      {
        'unique-id': 'api-gateway',
        'node-type': 'service',
        name: 'API Gateway',
        description: 'Main API gateway',
        controls: {
          'security-control': { description: 'Security control' }
        }
      },
      {
        'unique-id': 'database',
        'node-type': 'database',
        name: 'Database',
        description: 'Main database'
      },
      {
        'unique-id': 'web-app',
        'node-type': 'service',
        name: 'Web Application',
        description: 'Frontend web app'
      }
    ],
    relationships: [
      {
        'unique-id': 'rel-1',
        'relationship-type': { 'connects': true },
        parties: {
          source: { node: 'api-gateway' },
          destination: { node: 'database' }
        },
        metadata: [{ protocol: 'HTTPS' }]
      }
    ]
  };

  describe('extract', () => {
    it('should extract simple properties', () => {
      const result = PathExtractor.extract(mockArchitecture, 'nodes');
      expect(result).toHaveLength(3);
      expect(result[0]['unique-id']).toBe('api-gateway');
    });

    it('should extract with filter', () => {
      const result = PathExtractor.extract(mockArchitecture, 'nodes[node-type==service]');
      expect(result).toHaveLength(2);
      expect(result[0]['unique-id']).toBe('api-gateway');
      expect(result[1]['unique-id']).toBe('web-app');
    });

    it('should extract specific node by id', () => {
      const result = PathExtractor.extract(mockArchitecture, "nodes['api-gateway']");
      expect(result).toHaveLength(1);
      expect(result[0]['unique-id']).toBe('api-gateway');
    });

    it('should extract nested properties', () => {
      const result = PathExtractor.extract(mockArchitecture, "nodes['api-gateway'].controls");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ 'security-control': { description: 'Security control' } });
    });

    it('should extract with wildcard', () => {
      const result = PathExtractor.extract(mockArchitecture, 'relationships[*].metadata');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual([{ protocol: 'HTTPS' }]);
    });

    it('should handle non-existent paths', () => {
      const result = PathExtractor.extract(mockArchitecture, 'nonexistent');
      expect(result).toEqual([]);
    });

    it('should apply sorting', () => {
      const result = PathExtractor.extract(mockArchitecture, 'nodes', { sort: 'name' });
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('API Gateway');
      expect(result[1].name).toBe('Database');
      expect(result[2].name).toBe('Web Application');
    });

    it('should apply limit', () => {
      const result = PathExtractor.extract(mockArchitecture, 'nodes', { limit: 2 });
      expect(result).toHaveLength(2);
    });

    it('should apply filter options', () => {
      const result = PathExtractor.extract(mockArchitecture, 'nodes', { 
        filter: { 'node-type': 'service' } 
      });
      expect(result).toHaveLength(2);
    });
  });
});
