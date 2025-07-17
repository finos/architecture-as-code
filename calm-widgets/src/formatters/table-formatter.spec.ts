import { describe, it, expect } from 'vitest';
import { TableFormatter } from './table-formatter.js';

describe('TableFormatter', () => {
  const mockData = [
    { id: '1', name: 'Service A', type: 'service', active: true },
    { id: '2', name: 'Service B', type: 'database', active: false },
    { id: '3', name: 'Service C', type: 'service', active: true }
  ];

  describe('formatMarkdownTable', () => {
    it('should format data as markdown table with headers', () => {
      const result = TableFormatter.formatMarkdownTable(mockData);
      
      expect(result).toContain('| Id | Name | Type | Active |');
      expect(result).toContain('| --- | --- | --- | --- |');
      expect(result).toContain('| 1 | Service A | service | ✓ |');
      expect(result).toContain('| 2 | Service B | database | ✗ |');
    });

    it('should format data without headers', () => {
      const result = TableFormatter.formatMarkdownTable(mockData, { includeHeaders: false });
      
      expect(result).not.toContain('| Id | Name | Type | Active |');
      expect(result).not.toContain('| --- | --- | --- | --- |');
      expect(result).toContain('| 1 | Service A | service | ✓ |');
    });

    it('should handle empty data', () => {
      const result = TableFormatter.formatMarkdownTable([]);
      expect(result).toBe('_No data available_');
    });

    it('should use custom empty message', () => {
      const result = TableFormatter.formatMarkdownTable([], { emptyMessage: 'No services found' });
      expect(result).toBe('No services found');
    });

    it('should use custom columns', () => {
      const columns = [
        { key: 'name', label: 'Service Name' },
        { key: 'type', label: 'Service Type' }
      ];
      const result = TableFormatter.formatMarkdownTable(mockData, { columns });
      
      expect(result).toContain('| Service Name | Service Type |');
      expect(result).toContain('| Service A | service |');
    });

    it('should format complex values', () => {
      const complexData = [
        { 
          id: '1', 
          metadata: { version: '1.0', tags: ['prod', 'api'] },
          config: null
        }
      ];
      
      const result = TableFormatter.formatMarkdownTable(complexData);
      expect(result).toContain('version: 1.0, tags: prod, api');
      expect(result).toContain('|  |'); // null value becomes empty
    });
  });

  describe('formatHtmlTable', () => {
    it('should format data as HTML table', () => {
      const result = TableFormatter.formatHtmlTable(mockData);
      
      expect(result).toContain('<table>');
      expect(result).toContain('<thead>');
      expect(result).toContain('<th>Id</th>');
      expect(result).toContain('<tbody>');
      expect(result).toContain('<td>Service A</td>');
      expect(result).toContain('</table>');
    });

    it('should handle empty data', () => {
      const result = TableFormatter.formatHtmlTable([]);
      expect(result).toBe('<p><em>No data available</em></p>');
    });

    it('should format without headers', () => {
      const result = TableFormatter.formatHtmlTable(mockData, { includeHeaders: false });
      
      expect(result).not.toContain('<thead>');
      expect(result).toContain('<tbody>');
    });
  });
});
