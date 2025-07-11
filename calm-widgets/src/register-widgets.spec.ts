import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Handlebars from 'handlebars';
import { registerCalmWidgets, registerCalmWidgetsWithInstance } from './register-widgets.js';

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('registerCalmWidgets', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
    // Clear any existing helpers
    Object.keys(Handlebars.helpers).forEach(key => {
      if (key !== 'helperMissing' && key !== 'blockHelperMissing') {
        delete Handlebars.helpers[key];
      }
    });
  });

  it('should register CALM widget helpers with global Handlebars', () => {
    registerCalmWidgets();
    
    // Check that helpers are registered
    expect(Handlebars.helpers.table).toBeDefined();
    expect(Handlebars.helpers.node).toBeDefined();
    expect(typeof Handlebars.helpers.table).toBe('function');
    expect(typeof Handlebars.helpers.node).toBe('function');
  });

  it('should log the number of registered helpers', () => {
    registerCalmWidgets();
    
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/Registered \d+ CALM widget helpers/)
    );
  });

  it('should register all available CALM widget helpers', () => {
    registerCalmWidgets();
    
    // Check that all CALM widget helpers are registered
    expect(Handlebars.helpers.getColumns).toBeDefined();
    expect(Handlebars.helpers.getValue).toBeDefined();
    expect(Handlebars.helpers.formatTableValue).toBeDefined();
    expect(Handlebars.helpers.getListItemValue).toBeDefined();
    expect(Handlebars.helpers.formatMetadataValue).toBeDefined();
    expect(Handlebars.helpers.formatControlValue).toBeDefined();
  });
});

describe('registerCalmWidgetsWithInstance', () => {
  let mockHandlebars: any;

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockHandlebars = {
      registerHelper: vi.fn()
    };
  });

  it('should register CALM widget helpers with specific Handlebars instance', () => {
    registerCalmWidgetsWithInstance(mockHandlebars);
    
    // Check that registerHelper was called for each helper
    expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('table', expect.any(Function));
    expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('node', expect.any(Function));
    expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('getColumns', expect.any(Function));
    expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('getValue', expect.any(Function));
    expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('formatTableValue', expect.any(Function));
    expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('getListItemValue', expect.any(Function));
    expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('formatMetadataValue', expect.any(Function));
    expect(mockHandlebars.registerHelper).toHaveBeenCalledWith('formatControlValue', expect.any(Function));
  });

  it('should log the number of registered helpers with instance', () => {
    registerCalmWidgetsWithInstance(mockHandlebars);
    
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/Registered \d+ CALM widget helpers with instance/)
    );
  });

  it('should register the correct number of helpers', () => {
    registerCalmWidgetsWithInstance(mockHandlebars);
    
    // Should register all CALM widget helpers
    expect(mockHandlebars.registerHelper).toHaveBeenCalledTimes(8); // All CALM widget helpers
  });
});
