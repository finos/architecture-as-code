import { describe, it, expect } from 'vitest';
import * as CalmWidgets from './index.js';

describe('CALM Widgets Index', () => {
  it('should export registerCalmWidgets function', () => {
    expect(CalmWidgets.registerCalmWidgets).toBeDefined();
    expect(typeof CalmWidgets.registerCalmWidgets).toBe('function');
  });

  it('should export registerCalmWidgetsWithInstance function', () => {
    expect(CalmWidgets.registerCalmWidgetsWithInstance).toBeDefined();
    expect(typeof CalmWidgets.registerCalmWidgetsWithInstance).toBe('function');
  });

  it('should export CalmWidgetHelpers class', () => {
    expect(CalmWidgets.CalmWidgetHelpers).toBeDefined();
    expect(typeof CalmWidgets.CalmWidgetHelpers).toBe('function'); // constructor function
  });

  it('should export TableFormatter class', () => {
    expect(CalmWidgets.TableFormatter).toBeDefined();
    expect(typeof CalmWidgets.TableFormatter).toBe('function'); // constructor function
  });

  it('should export PathExtractor class', () => {
    expect(CalmWidgets.PathExtractor).toBeDefined();
    expect(typeof CalmWidgets.PathExtractor).toBe('function'); // constructor function
  });

  it('should export all expected exports', () => {
    const expectedExports = [
      'registerCalmWidgets',
      'registerCalmWidgetsWithInstance', 
      'CalmWidgetHelpers',
      'TableFormatter',
      'PathExtractor'
    ];

    expectedExports.forEach(exportName => {
      expect(CalmWidgets).toHaveProperty(exportName);
    });
  });

  it('should have correct number of exports', () => {
    const exportKeys = Object.keys(CalmWidgets);
    expect(exportKeys.length).toBe(5);
  });
});
