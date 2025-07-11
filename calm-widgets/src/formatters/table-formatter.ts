import { TableColumn, TableOptions } from '../types/index.js';

/**
 * Utility class for formatting data as tables
 */
export class TableFormatter {
  /**
   * Format data as a markdown table
   */
  static formatMarkdownTable(data: any[], options: TableOptions = {}): string {
    if (!data || data.length === 0) {
      return options.emptyMessage || '_No data available_';
    }

    const columns = options.columns || this.inferColumns(data);
    const includeHeaders = options.includeHeaders !== false;

    let result = '';

    // Add headers
    if (includeHeaders) {
      const headers = columns.map(col => col.label || col.key).join(' | ');
      const separator = columns.map(() => '---').join(' | ');
      result += `| ${headers} |\n`;
      result += `| ${separator} |\n`;
    }

    // Add rows
    for (const item of data) {
      const row = columns.map(col => {
        const value = this.getValue(item, col.key);
        const formatted = col.formatter ? col.formatter(value) : this.formatValue(value);
        return formatted || '';
      }).join(' | ');
      result += `| ${row} |\n`;
    }

    return result;
  }

  /**
   * Format data as an HTML table
   */
  static formatHtmlTable(data: any[], options: TableOptions = {}): string {
    if (!data || data.length === 0) {
      return `<p><em>${options.emptyMessage || 'No data available'}</em></p>`;
    }

    const columns = options.columns || this.inferColumns(data);
    const includeHeaders = options.includeHeaders !== false;

    let result = '<table>\n';

    // Add headers
    if (includeHeaders) {
      result += '  <thead>\n    <tr>\n';
      for (const col of columns) {
        result += `      <th>${col.label || col.key}</th>\n`;
      }
      result += '    </tr>\n  </thead>\n';
    }

    // Add body
    result += '  <tbody>\n';
    for (const item of data) {
      result += '    <tr>\n';
      for (const col of columns) {
        const value = this.getValue(item, col.key);
        const formatted = col.formatter ? col.formatter(value) : this.formatValue(value);
        result += `      <td>${formatted || ''}</td>\n`;
      }
      result += '    </tr>\n';
    }
    result += '  </tbody>\n</table>';

    return result;
  }

  /**
   * Infer columns from data
   */
  private static inferColumns(data: any[]): TableColumn[] {
    if (!data || data.length === 0) return [];

    const firstItem = data[0];
    const keys = Object.keys(firstItem);

    return keys.map(key => ({
      key,
      label: this.keyToLabel(key)
    }));
  }

  /**
   * Convert a key to a human-readable label
   */
  private static keyToLabel(key: string): string {
    return key
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Get value from object using dot notation
   */
  private static getValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Format a value for display
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.map(v => this.formatValue(v)).join(', ');
    }

    if (typeof value === 'object') {
      // For objects, show key-value pairs
      const entries = Object.entries(value);
      if (entries.length <= 3) {
        return entries.map(([k, v]) => `${k}: ${this.formatValue(v)}`).join(', ');
      } else {
        return `{${entries.length} properties}`;
      }
    }

    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }

    return String(value);
  }
}
