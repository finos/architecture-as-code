import { describe, it, expect } from 'vitest';
import { CalmWidgetHelpers } from './calm-widget-helpers.js';

describe('CalmWidgetHelpers - Utility Functions', () => {
  describe('getColumnsHelper', () => {
    it('should return parsed columns when columns parameter provided', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockData = [{ id: 1, name: 'test' }];
      const result = helpers.getColumns(mockData, 'id,name');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should infer columns from data when no columns parameter', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockData = [{ id: 1, name: 'test', description: 'desc' }];
      const result = helpers.getColumns(mockData);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });

    it('should return empty array for empty data', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.getColumns([]);
      
      expect(result).toEqual([]);
    });

    it('should handle non-array data', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.getColumns(null);
      
      expect(result).toEqual([]);
    });
  });

  describe('getValueHelper', () => {
    it('should extract value from object using key', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockObject = { name: 'test', id: 123 };
      const result = helpers.getValue(mockObject, 'name');
      
      expect(result).toBe('test');
    });

    it('should extract nested value from object', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockObject = { user: { name: 'test', id: 123 } };
      const result = helpers.getValue(mockObject, 'user.name');
      
      expect(result).toBe('test');
    });

    it('should return undefined for non-existent key', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockObject = { name: 'test' };
      const result = helpers.getValue(mockObject, 'nonexistent');
      
      expect(result).toBeUndefined();
    });

    it('should handle null object', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.getValue(null, 'name');
      
      expect(result).toBeUndefined();
    });
  });

  describe('formatTableValueHelper', () => {
    it('should return empty string for null values', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.formatTableValue(null);
      
      expect(result).toBe('');
    });

    it('should return empty string for undefined values', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const result = helpers.formatTableValue(undefined);
      
      expect(result).toBe('');
    });

    it('should stringify object values', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockObject = { name: 'test', id: 123 };
      const result = helpers.formatTableValue(mockObject);
      
      expect(result).toBe(JSON.stringify(mockObject));
    });

    it('should convert primitive values to string', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers.formatTableValue('test')).toBe('test');
      expect(helpers.formatTableValue(123)).toBe('123');
      expect(helpers.formatTableValue(true)).toBe('true');
    });
  });

  describe('getListItemValueHelper', () => {
    it('should extract value using key when provided', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockItem = { name: 'test', id: 123 };
      const result = helpers.getListItemValue(mockItem, 'name');
      
      expect(result).toBe('test');
    });

    it('should return item name when no key provided', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockItem = { name: 'test', id: 123 };
      const result = helpers.getListItemValue(mockItem);
      
      expect(result).toBe('test');
    });

    it('should return unique-id when no name and no key', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockItem = { 'unique-id': 'test-id', id: 123 };
      const result = helpers.getListItemValue(mockItem);
      
      expect(result).toBe('test-id');
    });

    it('should return JSON string for complex objects when no key', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockItem = { complex: { nested: 'value' } };
      const result = helpers.getListItemValue(mockItem);
      
      expect(result).toBe(JSON.stringify(mockItem));
    });

    it('should return string representation for primitive values', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers.getListItemValue('test')).toBe('test');
      expect(helpers.getListItemValue(123)).toBe('123');
    });
  });

  describe('formatMetadataValueHelper', () => {
    it('should stringify object values', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockObject = { key: 'value', nested: { data: 'test' } };
      const result = helpers.formatMetadataValue(mockObject);
      
      expect(result).toBe(JSON.stringify(mockObject));
    });

    it('should convert primitive values to string', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers.formatMetadataValue('test')).toBe('test');
      expect(helpers.formatMetadataValue(123)).toBe('123');
      expect(helpers.formatMetadataValue(true)).toBe('true');
    });

    it('should handle null and undefined values', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers.formatMetadataValue(null)).toBe('null');
      expect(helpers.formatMetadataValue(undefined)).toBe('undefined');
    });
  });

  describe('formatControlValueHelper', () => {
    it('should stringify object values', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockObject = { requirement: 'test', config: { enabled: true } };
      const result = helpers.formatControlValue(mockObject);
      
      expect(result).toBe(JSON.stringify(mockObject));
    });

    it('should convert primitive values to string', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers.formatControlValue('enabled')).toBe('enabled');
      expect(helpers.formatControlValue(42)).toBe('42');
      expect(helpers.formatControlValue(false)).toBe('false');
    });

    it('should handle null and undefined values', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      
      expect(helpers.formatControlValue(null)).toBe('null');
      expect(helpers.formatControlValue(undefined)).toBe('undefined');
    });

    it('should handle arrays', () => {
      const helpers = CalmWidgetHelpers.getHelpers();
      const mockArray = ['item1', 'item2', 'item3'];
      const result = helpers.formatControlValue(mockArray);
      
      expect(result).toBe(JSON.stringify(mockArray));
    });
  });

  describe('keyToLabel', () => {
    it('should convert kebab-case to title case', () => {
      const result = CalmWidgetHelpers['keyToLabel']('unique-id');
      expect(result).toBe('Unique Id');
    });

    it('should convert snake_case to title case', () => {
      const result = CalmWidgetHelpers['keyToLabel']('node_type');
      expect(result).toBe('Node Type');
    });

    it('should convert camelCase to title case', () => {
      const result = CalmWidgetHelpers['keyToLabel']('nodeType');
      expect(result).toBe('Node Type');
    });

    it('should handle single words', () => {
      const result = CalmWidgetHelpers['keyToLabel']('name');
      expect(result).toBe('Name');
    });

    it('should handle mixed formats', () => {
      const result = CalmWidgetHelpers['keyToLabel']('control-requirement_url');
      expect(result).toBe('Control Requirement Url');
    });
  });

  describe('parseColumns', () => {
    it('should parse comma-separated string columns', () => {
      const result = CalmWidgetHelpers['parseColumns']('id,name,description');
      expect(result).toEqual([
        { key: 'id', label: 'id' },
        { key: 'name', label: 'name' },
        { key: 'description', label: 'description' }
      ]);
    });

    it('should handle array input', () => {
      const input = ['id', 'name'];
      const result = CalmWidgetHelpers['parseColumns'](input);
      expect(result).toEqual(['id', 'name']);
    });

    it('should handle empty string', () => {
      const result = CalmWidgetHelpers['parseColumns']('');
      expect(result).toEqual([{ key: '', label: '' }]);
    });

    it('should handle null input', () => {
      const result = CalmWidgetHelpers['parseColumns'](null);
      expect(result).toBeNull();
    });

    it('should trim whitespace from column names', () => {
      const result = CalmWidgetHelpers['parseColumns'](' id , name , description ');
      expect(result).toEqual([
        { key: 'id', label: 'id' },
        { key: 'name', label: 'name' },
        { key: 'description', label: 'description' }
      ]);
    });
  });
});
