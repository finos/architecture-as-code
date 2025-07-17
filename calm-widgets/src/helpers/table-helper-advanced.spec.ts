import { describe, it, expect } from 'vitest';
import { CalmWidgetHelpers } from './calm-widget-helpers.js';

describe('CalmWidgetHelpers - Advanced Table Functions', () => {
  describe('isControlsObject', () => {
    it('should identify controls object with description', () => {
      const mockControls = {
        description: 'Security controls',
        requirements: []
      };
      const result = CalmWidgetHelpers['isControlsObject'](mockControls);
      expect(result).toBe(true);
    });

    it('should identify controls object with requirements', () => {
      const mockControls = {
        requirements: [{ 'control-requirement': 'test' }]
      };
      const result = CalmWidgetHelpers['isControlsObject'](mockControls);
      expect(result).toBe(true);
    });

    it('should identify controls object with cbom', () => {
      const mockControls = {
        cbom: { components: [] }
      };
      const result = CalmWidgetHelpers['isControlsObject'](mockControls);
      expect(result).toBe(true);
    });

    it('should identify controls object with nested control descriptions', () => {
      const mockControls = {
        security: { description: 'Security control' },
        compliance: { description: 'Compliance control' }
      };
      const result = CalmWidgetHelpers['isControlsObject'](mockControls);
      expect(result).toBe(true);
    });

    it('should return false for non-controls objects', () => {
      const mockObject = {
        name: 'test',
        id: 123
      };
      const result = CalmWidgetHelpers['isControlsObject'](mockObject);
      expect(result).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(CalmWidgetHelpers['isControlsObject'](null)).toBe(false);
      expect(CalmWidgetHelpers['isControlsObject'](undefined)).toBe(false);
    });
  });

  describe('isMetadataObject', () => {
    it('should identify array metadata', () => {
      const mockMetadata = [
        { key: 'environment', value: 'production' },
        { key: 'team', value: 'platform' }
      ];
      const result = CalmWidgetHelpers['isMetadataObject'](mockMetadata);
      expect(result).toBe(true);
    });

    it('should identify object metadata without control properties', () => {
      const mockMetadata = {
        environment: 'production',
        team: 'platform',
        version: '1.0.0'
      };
      const result = CalmWidgetHelpers['isMetadataObject'](mockMetadata);
      expect(result).toBe(true);
    });

    it('should return false for controls-like objects', () => {
      const mockObject = {
        description: 'Control description',
        requirements: []
      };
      const result = CalmWidgetHelpers['isMetadataObject'](mockObject);
      expect(result).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(CalmWidgetHelpers['isMetadataObject'](null)).toBe(false);
      expect(CalmWidgetHelpers['isMetadataObject'](undefined)).toBe(false);
    });
  });

  describe('isSingleControlRequirement', () => {
    it('should identify control requirement with control-requirement property', () => {
      const mockRequirement = {
        'control-requirement': 'https://example.com/requirement.json',
        'control-config': 'https://example.com/config.json'
      };
      const result = CalmWidgetHelpers['isSingleControlRequirement'](mockRequirement);
      expect(result).toBe(true);
    });

    it('should identify control requirement with control-config property', () => {
      const mockRequirement = {
        'control-config': 'https://example.com/config.json'
      };
      const result = CalmWidgetHelpers['isSingleControlRequirement'](mockRequirement);
      expect(result).toBe(true);
    });

    it('should identify resolved control requirement', () => {
      const mockRequirement = {
        _resolvedSchema: { properties: {} },
        _resolvedConfig: { values: {} }
      };
      const result = CalmWidgetHelpers['isSingleControlRequirement'](mockRequirement);
      expect(result).toBe(true);
    });

    it('should identify control requirement with schema properties and config values', () => {
      const mockRequirement = {
        _schemaProperties: ['prop1', 'prop2'],
        _configValues: ['val1', 'val2']
      };
      const result = CalmWidgetHelpers['isSingleControlRequirement'](mockRequirement);
      expect(result).toBe(true);
    });

    it('should return false for non-control-requirement objects', () => {
      const mockObject = {
        name: 'test',
        description: 'not a control requirement'
      };
      const result = CalmWidgetHelpers['isSingleControlRequirement'](mockObject);
      expect(result).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(CalmWidgetHelpers['isSingleControlRequirement'](null)).toBe(false);
      expect(CalmWidgetHelpers['isSingleControlRequirement'](undefined)).toBe(false);
    });
  });

  describe('formatSingleControlRequirementAsTable', () => {
    it('should format resolved requirement with schema data', () => {
      const mockRequirement = {
        _schemaProperties: ['control-id', 'name', 'description'],
        _configValues: ['SEC-001', 'Security Control', 'Basic security control']
      };
      const context = { format: 'markdown' };
      const result = CalmWidgetHelpers['formatSingleControlRequirementAsTable'](mockRequirement, context);
      
      expect(result).toContain('| Property | Value |');
      expect(result).toContain('| Control Id | N/A |');
      expect(result).toContain('| Name | N/A |');
      expect(result).toContain('| Description | N/A |');
    });

    it('should format basic requirement as key-value pairs', () => {
      const mockRequirement = {
        'control-requirement': 'https://example.com/requirement.json',
        'control-config': 'https://example.com/config.json'
      };
      const context = { format: 'markdown' };
      const result = CalmWidgetHelpers['formatSingleControlRequirementAsTable'](mockRequirement, context);
      
      expect(result).toContain('| Property | Value |');
      expect(result).toContain('| Control Requirement | https://example.com/requirement.json |');
      expect(result).toContain('| Control Config | https://example.com/config.json |');
    });

    it('should handle HTML format', () => {
      const mockRequirement = {
        'control-requirement': 'https://example.com/requirement.json'
      };
      const context = { format: 'html' };
      const result = CalmWidgetHelpers['formatSingleControlRequirementAsTable'](mockRequirement, context);
      
      expect(result).toContain('<table>');
      expect(result).toContain('<th>Property</th>');
      expect(result).toContain('<th>Value</th>');
      expect(result).toContain('</table>');
    });
  });

  describe('formatControlsAsTable', () => {
    it('should format multiple controls', () => {
      const mockControls = {
        security: {
          description: 'Security controls',
          requirements: [{ 'control-requirement': 'sec.json' }]
        },
        compliance: {
          description: 'Compliance controls',
          requirements: [{ 'control-requirement': 'comp.json' }]
        }
      };
      const context = { format: 'markdown' };
      const result = CalmWidgetHelpers['formatControlsAsTable'](mockControls, context);
      
      expect(result).toContain('| Control | Description | Requirements |');
      expect(result).toContain('| security | Security controls | 1 |');
      expect(result).toContain('| compliance | Compliance controls | 1 |');
    });

    it('should format single control with requirements', () => {
      const mockControl = {
        description: 'Security control',
        requirements: [
          { 'control-requirement': 'req1.json' },
          { 'control-requirement': 'req2.json' }
        ]
      };
      const context = { format: 'markdown' };
      const result = CalmWidgetHelpers['formatSingleControlAsTable'](mockControl, 'markdown', context);
      
      expect(result).toContain('| Requirement | Configuration | Description |');
      expect(result).toContain('| req1 | N/A | Security control |');
      expect(result).toContain('| req2 | N/A | Security control |');
    });

    it('should handle empty controls', () => {
      const context = { format: 'markdown', emptyMessage: 'No controls found' };
      const result = CalmWidgetHelpers['formatControlsAsTable']({}, context);
      
      expect(result).toBe('');
    });
  });

  describe('formatMetadataAsTable', () => {
    it('should format array metadata', () => {
      const mockMetadata = [
        { key: 'environment', value: 'production' },
        { key: 'team', value: 'platform' }
      ];
      const context = { format: 'markdown' };
      const result = CalmWidgetHelpers['formatMetadataAsTable'](mockMetadata, context);
      
      expect(result).toContain('- **key:** environment');
      expect(result).toContain('- **value:** production');
      expect(result).toContain('- **key:** team');
      expect(result).toContain('- **value:** platform');
    });

    it('should format object metadata', () => {
      const mockMetadata = {
        environment: 'production',
        team: 'platform',
        version: '1.0.0'
      };
      const context = { format: 'markdown' };
      const result = CalmWidgetHelpers['formatMetadataAsTable'](mockMetadata, context);
      
      expect(result).toContain('- **environment:** production');
      expect(result).toContain('- **team:** platform');
      expect(result).toContain('- **version:** 1.0.0');
    });

    it('should handle HTML format for array metadata', () => {
      const mockMetadata = [{ key: 'env', value: 'prod' }];
      const context = { format: 'html' };
      const result = CalmWidgetHelpers['formatMetadataAsTable'](mockMetadata, context);
      
      expect(result).toContain('<ul>');
      expect(result).toContain('<li><strong>key:</strong> env</li>');
      expect(result).toContain('<li><strong>value:</strong> prod</li>');
      expect(result).toContain('</ul>');
    });

    it('should handle empty metadata', () => {
      const context = { format: 'markdown', emptyMessage: 'No metadata found' };
      const result = CalmWidgetHelpers['formatMetadataAsTable']([], context);
      
      expect(result).toBe('No metadata found');
    });
  });

  describe('extractUrlFilename', () => {
    it('should extract filename from URL', () => {
      const url = 'https://example.com/path/to/file.json';
      const result = CalmWidgetHelpers['extractUrlFilename'](url);
      expect(result).toBe('file');
    });

    it('should handle URLs without extension', () => {
      const url = 'https://example.com/path/to/filename';
      const result = CalmWidgetHelpers['extractUrlFilename'](url);
      expect(result).toBe('filename');
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://example.com/file.json?version=1.0';
      const result = CalmWidgetHelpers['extractUrlFilename'](url);
      expect(result).toBe('file?version=1.0');
    });

    it('should handle simple filenames', () => {
      const filename = 'simple-file.json';
      const result = CalmWidgetHelpers['extractUrlFilename'](filename);
      expect(result).toBe('simple-file');
    });
  });

  describe('formatAsMarkdownTable', () => {
    it('should format markdown table with headers and rows', () => {
      const headers = ['Name', 'Type', 'Description'];
      const rows = [
        ['Service A', 'service', 'Main service'],
        ['Database B', 'datastore', 'Primary database']
      ];
      const result = CalmWidgetHelpers['formatAsMarkdownTable'](headers, rows, 'markdown');
      
      expect(result).toContain('| Name | Type | Description |');
      expect(result).toContain('| --- | --- | --- |');
      expect(result).toContain('| Service A | service | Main service |');
      expect(result).toContain('| Database B | datastore | Primary database |');
    });

    it('should format HTML table when format is html', () => {
      const headers = ['Name', 'Type'];
      const rows = [['Service A', 'service']];
      const result = CalmWidgetHelpers['formatAsMarkdownTable'](headers, rows, 'html');
      
      expect(result).toContain('<table>');
      expect(result).toContain('<thead>');
      expect(result).toContain('<th>Name</th>');
      expect(result).toContain('<th>Type</th>');
      expect(result).toContain('<tbody>');
      expect(result).toContain('<td>Service A</td>');
      expect(result).toContain('<td>service</td>');
      expect(result).toContain('</table>');
    });

    it('should handle empty rows', () => {
      const headers = ['Name', 'Type'];
      const rows: string[][] = [];
      const result = CalmWidgetHelpers['formatAsMarkdownTable'](headers, rows, 'markdown');
      
      expect(result).toContain('| Name | Type |');
      expect(result).toContain('| --- | --- |');
    });
  });
});
